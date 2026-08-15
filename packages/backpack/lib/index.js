/**
 * @ggame/backpack — 常驻版 DSH 背包插件（host half）。
 *
 * 魔兽世界风格物品栏：物品 / 袋子 / 货币（金币·银币·铜币 = 元·角·分），
 * 以及基于 sessionQuery 的全会话 token 费用记账（含已归档会话，按 seq 增量扫描）。
 * 所有业务状态持久化在 ~/.dsh/backpack-state.json（可在设置中修改路径）。
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import { promises as fsp } from 'node:fs'
import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { moneyOf, priceOf, costOfUsage, PRICE_REV } from './pricing.js'

export const name = '@ggame/backpack'

export const BACKPACK_SETTINGS_NAMESPACE = settingsNamespace('backpack')

const TYPE_SET = ['link', 'prompt', 'note', 'skill', 'file', 'image', 'video', 'mcp', 'plugin', 'bundle', 'command', 'other']
const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico']
const VIDEO_EXT = ['.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v']
const TEXT_EXT = ['.txt', '.md', '.markdown', '.json', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.yml', '.yaml', '.toml', '.csv', '.html', '.htm', '.css', '.xml', '.log', '.ini', '.conf', '.sh', '.py', '.java', '.go', '.rs', '.c', '.cpp', '.h', '.sql', '.vue', '.svelte']
const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TYPE_ICON_DIR = join(PACKAGE_ROOT, 'icons')

/** 插件设置：设置 → 插件 → 插件配置 中展示的表单。 */
export const Config = z.object({
  /** 状态文件路径；留空使用默认 ~/.dsh/backpack-state.json */
  statePath: z.string().default(''),
  /** 是否开启定时扫描会话日志记账（重启 DSH 后生效的常驻能力）。 */
  autoScan: z.boolean().default(true),
  /** 扫描间隔（秒）。 */
  scanIntervalSec: z.number().default(60),
  /** 是否启用峰谷定价（2026-08-17 起官方按请求时段计费：高峰 9-12、14-18 点，闲时为一半）。 */
  peakPricing: z.boolean().default(true),
  /** 默认动态定价（元/百万 tokens），适用于未单独配置的模型。 */
  prices: z.object({
    hit: z.number().default(0.02),
    miss: z.number().default(1),
    out: z.number().default(2),
  }).default({ hit: 0.02, miss: 1, out: 2 }),
  /** 按模型覆盖定价（元/百万 tokens），如 {"deepseek-v4-flash": {"hit": 0.02, "miss": 1, "out": 2}} */
  modelPrices: z.dict(z.object({
    hit: z.number(),
    miss: z.number(),
    out: z.number(),
  })).default({}),
}).default({})

export function resolveConfig(config = {}) {
  const statePath = String(config.statePath || '').trim()
  const scanIntervalSec = config.scanIntervalSec ?? 60
  if (!Number.isFinite(scanIntervalSec) || scanIntervalSec < 10 || scanIntervalSec > 86400) {
    throw new Error('backpack: scanIntervalSec must be a number between 10 and 86400')
  }
  const prices = config.prices ?? {}
  const p = {
    hit: Number.isFinite(prices.hit) && prices.hit >= 0 ? prices.hit : 0.02,
    miss: Number.isFinite(prices.miss) && prices.miss >= 0 ? prices.miss : 1,
    out: Number.isFinite(prices.out) && prices.out >= 0 ? prices.out : 2,
  }
  const modelPrices = {}
  if (config.modelPrices && typeof config.modelPrices === 'object') {
    Object.keys(config.modelPrices).slice(0, 40).forEach((k) => {
      const v = config.modelPrices[k]
      if (v && typeof v === 'object') {
        modelPrices[String(k).slice(0, 64)] = {
          hit: Number.isFinite(v.hit) && v.hit >= 0 ? v.hit : p.hit,
          miss: Number.isFinite(v.miss) && v.miss >= 0 ? v.miss : p.miss,
          out: Number.isFinite(v.out) && v.out >= 0 ? v.out : p.out,
        }
      }
    })
  }
  return {
    statePath,
    autoScan: config.autoScan !== false,
    scanIntervalSec,
    peakPricing: config.peakPricing !== false,
    prices: p,
    modelPrices,
  }
}

export const inject = ['tools', 'settings', 'sessionQuery']

/** Plugin entry: register settings, load state, mount tools and Web routes, start the scan loop. */
export async function apply(ctx, config = {}) {
  const settings = ctx.settings.register(BACKPACK_SETTINGS_NAMESPACE, Config, {
    base: config,
    applies: 'live',
    validate: (value) => { resolveConfig(value) },
  })

  let data = null
  let money = { gold: 0, silver: 0, copper: 0 }
  let usageLog = []
  let archivedUsage = []
  let sessionUsage = { input: 0, output: 0, hit: 0 }
  let totalUsage = { input: 0, output: 0, hit: 0 }
  let modelUsage = {}
  let modelCostCu = {}
  let dayCostCu = {}
  let scanState = {}
  let scanBusy = false
  let statePath = ''
  let activePath = ''
  let diag = { statePath: '', activePath: '', lastError: '' }
  let ready = false
  let readyWaiters = []
  const mediaAllowed = new Set()

  const uid = () => 'it-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) + '-' + randomUUID().slice(0, 6)
  const clampInt = (v, lo, hi, dflt) => { const n = Math.floor(Number(v)); return isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt }
  const numberOr = (v, dflt) => { const n = Number(v); return isFinite(n) ? n : dflt }
  const plainObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
  const extOf = (p) => { const m = String(p).toLowerCase().match(/\.[a-z0-9]{1,8}$/); return m ? m[0] : '' }

  function seed() {
    const now = Date.now()
    return {
      version: 1,
      tags: [],
      money: { gold: 0, silver: 0, copper: 0 },
      usageLog: [],
      totalUsage: { input: 0, output: 0, hit: 0 },
      modelUsage: {},
      modelCostCu: {},
      dayCostCu: {},
      scanState: {},
      bags: [
        { id: 'bag-main', name: '主背包', cols: 6, rows: 4, order: 0, fixed: true },
        { id: 'bag-vault', name: '虚空仓库', cols: 8, rows: 36, order: 1, vault: true, fixed: true },
      ],
      items: [
        { id: uid(), bagId: 'bag-main', slot: 0, type: 'note', name: '新手卷轴', rarity: 2, payload: '# 背包使用指南\n\n欢迎来到 **ggame 背包**！这份指南会把每个操作讲清楚。\n\n## 一、开合与面板\n\n- 打开 / 关闭：按键盘 **B 键**，或点击右下角的 🎒 背包按钮；按 **Esc** 也可关闭。\n- 面板可以按住**顶部标题栏**拖动，松手后位置会被记住。\n\n## 二、添加物品（三种方式）\n\n1. **粘贴内容**：打开背包 → 工具栏「＋ 添加物品」→ 把链接 / 提示词 / 本地路径 / MCP JSON / 插件 ID 粘贴到输入框 → 自动识别类型 → 点「放入背包」。\n2. **选择本地文件**：添加弹窗里点「📁 选择本地文件」→ 选中的文件会填进面板（名字自动等于文件名）→ 点「放入背包」。\n3. **拖入文件**：把文件直接从资源管理器拖进背包面板。\n\n## 三、查看与使用（双击 = 使用）\n\n**双击物品** = 执行该物品的默认动作：\n\n| 物品类型 | 双击（使用）会做什么 |\n| --- | --- |\n| 链接 | 在浏览器新标签页打开该网址 |\n| 提示词 / 笔记 | 把内容填入对话输入框，按 Enter 发给 Agent |\n| 技能 | 填入「请加载并使用技能：xxx」并发给 Agent |\n| 插件 | 填入「@插件ID 请查看并激活」并发给 Agent |\n| MCP 配置 | 把配置以代码块发到对话，让 Agent 接入 |\n| 文件 | 打开预览弹窗（可查看内容 / 复制路径） |\n| 图片 | 打开大图预览 |\n| 视频 | 打开播放器预览 |\n| 组合包 | 直接解包到当前袋子 |\n| 命令 | 填入对话执行（危险，执行前请确认内容） |\n\n**右键物品** = 打开菜单：查看（按内容渲染：链接卡片 / Markdown / HTML / 图片 / 视频 / 纯文本）、发送到对话、复制、固定、编辑、移动、摧毁；本地路径物品还有「打开文件所在位置」。\n\n## 四、一键拾取（把 Agent 回复存为笔记）\n\n每条 Agent 回复的**操作区**都有一个 **⚡「拾取到背包」** 按钮（常驻显示，无需悬浮）。\n\n- **点击它**：直接把这条回复的完整内容保存为一条**笔记**，自动放入当前背包。\n- 无论回复里有没有链接 / 路径，都只做这一件事，不会弹出选择窗口。\n\n## 五、费用记账\n\n- 面板底部的 **金币 / 银币 / 铜币** = 元 / 角 / 分，来自全会话 token 费用（DeepSeek 官方动态定价 + 峰谷计价）。\n- **鼠标悬浮金额**：金额上方弹出卡片，显示近 7 天每天总花费与每个模型花费，鼠标移开自动关闭。\n\n## 六、Agent 工具\n\n- `backpack_add`：让 Agent 把内容放入背包\n- `backpack_money`：记录费用\n- `backpack_search`：Agent 检索背包\n\n祝冒险愉快！', flavor: '阅读后绑定', count: 1, createdAt: now, lastUsed: 0, useCount: 0, extra: {}, icon: '' },
        { id: uid(), bagId: 'bag-main', slot: 1, type: 'link', name: 'DeepSeek GitHub', rarity: 1, payload: 'https://github.com/deepseek-ai', flavor: '艾泽拉斯通讯录', count: 1, createdAt: now, lastUsed: 0, useCount: 0, extra: {}, icon: '' },
        { id: uid(), bagId: 'bag-main', slot: 2, type: 'skill', name: 'cordis-plugin-development', rarity: 3, payload: 'cordis-plugin-development', flavor: '插件开发技能书', count: 1, createdAt: now, lastUsed: 0, useCount: 0, extra: {}, icon: '' },
        { id: uid(), bagId: 'bag-main', slot: 3, type: 'prompt', name: '代码审查大师', rarity: 2, payload: '你是一位资深代码审查专家。请审查以下代码，指出潜在 bug、性能问题与安全隐患，并给出改进建议。', flavor: '老练的匠人之魂', count: 1, createdAt: now, lastUsed: 0, useCount: 0, extra: {}, icon: '' },
      ],
    }
  }

  // G1 结构化迁移链：未来状态结构变更时按 version 逐级迁移，不丢数据。
  // 每个迁移函数接收上一版状态对象，返回下一版；新字段缺省由 sanitize 兜底。
  const STATE_MIGRATIONS = {
    // 1: (raw) => { /* 示例：raw.newField = ...; raw.version = 2 */ return raw },
  }
  function migrateState(raw) {
    if (!raw || typeof raw !== 'object') return raw
    let d = raw
    let v = Number(d.version) || 0
    let guard = 0
    while (v < 1 && guard++ < 16) {
      const next = STATE_MIGRATIONS[v]
      if (!next) break
      d = next(d)
      v = Number(d.version) || v
    }
    return d
  }

  function sanitize(raw) {
    const tags = Array.isArray(raw.tags) ? raw.tags.slice(0, 64).map((t) => String(t).slice(0, 32)).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i) : []
    const bags = []
    const seenBags = new Set()
    const rawBags = Array.isArray(raw.bags) ? raw.bags.slice(0, 64) : []
    rawBags.forEach((b) => {
      if (!plainObj(b)) return
      const id = String(b.id || '').slice(0, 64)
      if (!id || seenBags.has(id)) return
      seenBags.add(id)
      const vault = !!b.vault
      const rawCols = clampInt(b.cols, 1, 12, vault ? 8 : 6)
      const rawRows = clampInt(b.rows, 1, 36, 4)
      const cols = vault ? rawCols : 6
      const rows = vault ? rawRows : Math.min(36, Math.max(4, Math.ceil(rawRows / 4) * 4))
      bags.push({
        id: id,
        name: String(b.name || '袋子').slice(0, 64),
        cols: cols,
        rows: rows,
        order: numberOr(b.order, bags.length),
        vault: vault,
        fixed: !!b.fixed || id === 'bag-main' || id === 'bag-vault',
      })
    })
    if (!bags.some((b) => b.vault)) bags.push({ id: 'bag-vault', name: '虚空仓库', cols: 8, rows: 36, order: 999, vault: true, fixed: true })
    const bagIds = new Set(bags.map((b) => b.id))
    const items = []
    const seenItems = new Set()
    const rawItems = Array.isArray(raw.items) ? raw.items.slice(0, 2000) : []
    rawItems.forEach((it) => {
      if (!plainObj(it)) return
      const id = String(it.id || '')
      if (!id || seenItems.has(id)) return
      const type = TYPE_SET.indexOf(it.type) >= 0 || tags.indexOf(it.type) >= 0 ? it.type : 'note'
      const payload = typeof it.payload === 'string' ? it.payload.slice(0, 2 * 1024 * 1024) : ''
      if (!payload) return
      seenItems.add(id)
      const bagId = bagIds.has(it.bagId) ? it.bagId : 'bag-vault'
      items.push({
        id: id,
        bagId: bagId,
        slot: clampInt(it.slot, -1, 4096, -1),
        type: type,
        name: String(it.name || '未命名').slice(0, 200),
        rarity: clampInt(it.rarity, 0, 5, 1),
        payload: payload,
        flavor: String(it.flavor || '').slice(0, 300),
        count: clampInt(it.count, 1, 999, 1),
        createdAt: numberOr(it.createdAt, Date.now()),
        lastUsed: numberOr(it.lastUsed, 0),
        useCount: numberOr(it.useCount, 0),
        icon: typeof it.icon === 'string' ? it.icon.slice(0, 2 * 1024 * 1024) : '',
        tag: typeof it.tag === 'string' ? it.tag.slice(0, 32) : '',
        fav: it.fav ? 1 : 0,
        extra: plainObj(it.extra) ? it.extra : {},
      })
    })
    const usageLog = Array.isArray(raw.usageLog) ? raw.usageLog.slice(-500).map((e) => (plainObj(e) ? { ts: numberOr(e.ts, Date.now()), model: String((e && e.model) || '').slice(0, 64), input: Math.max(0, numberOr(e.input, 0)), hit: Math.max(0, numberOr(e.hit, 0)), output: Math.max(0, numberOr(e.output, 0)), costCu: Math.max(0, Math.round(numberOr(e.costCu, 0))) } : null)).filter(Boolean) : []
    const sum3 = (v) => ({ input: Math.max(0, numberOr(v && v.input, 0)), output: Math.max(0, numberOr(v && v.output, 0)), hit: Math.max(0, numberOr(v && v.hit, 0)) })
    const totalUsage = sum3(raw.totalUsage)
    const modelUsage = {}
    if (plainObj(raw.modelUsage)) {
      Object.keys(raw.modelUsage).slice(0, 40).forEach((k) => { const v = raw.modelUsage[k]; if (plainObj(v)) modelUsage[String(k).slice(0, 64)] = sum3(v) })
    }
    const scanState = {}
    if (plainObj(raw.scanState)) {
      Object.keys(raw.scanState).slice(0, 200).forEach((k) => { const v = Number(raw.scanState[k]); if (isFinite(v)) scanState[String(k).slice(0, 128)] = Math.max(0, Math.floor(v)) })
    }
    const modelCostCu = {}
    if (plainObj(raw.modelCostCu)) {
      Object.keys(raw.modelCostCu).slice(0, 40).forEach((k) => { const v = Number(raw.modelCostCu[k]); if (isFinite(v)) modelCostCu[String(k).slice(0, 64)] = Math.max(0, Math.round(v)) })
    }
    const dayCostCu = {}
    if (plainObj(raw.dayCostCu)) {
      Object.keys(raw.dayCostCu).slice(0, 60).forEach((k) => { const v = Number(raw.dayCostCu[k]); if (isFinite(v) && /^\d{4}-\d{2}-\d{2}$/.test(String(k))) dayCostCu[String(k)] = Math.max(0, Math.round(v)) })
    }
    return { version: 1, tags: tags, money: moneyOf(raw.money), usageLog: usageLog, totalUsage: totalUsage, modelUsage: modelUsage, modelCostCu: modelCostCu, dayCostCu: dayCostCu, scanState: scanState, bags: bags, items: items }
  }

  function localDayKey(ts) {
    const d = new Date(numberOr(ts, Date.now()))
    const p = (n) => (n < 10 ? '0' : '') + n
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
  }

  function tallyUsage(u, model, cfg, evTime) {
    const { miss, hit, out, costCu } = costOfUsage(u, model, evTime, cfg)
    sessionUsage.input += miss
    sessionUsage.hit += hit
    sessionUsage.output += out
    totalUsage.input += miss
    totalUsage.hit += hit
    totalUsage.output += out
    const mm = modelUsage[model] || { input: 0, output: 0, hit: 0 }
    mm.input += miss; mm.hit += hit; mm.output += out
    modelUsage[model] = mm
    // 模型花费（铜币）累计：费用明细按模型展示用
    modelCostCu[model] = Math.round((modelCostCu[model] || 0) + costCu)
    // 按自然日累计（本地时区）：近 7 天每日总花费与账本严格一致
    const dk = localDayKey(evTime)
    dayCostCu[dk] = Math.round((dayCostCu[dk] || 0) + costCu)
    usageLog.push({ ts: numberOr(evTime, Date.now()), model: model, input: miss, hit: hit, output: out, costCu: costCu })
    // B6 usageLog 归档：超出 500 条的旧明细进归档缓冲区，随持久化追加到归档文件（费用审计不丢）
    if (usageLog.length > 500) {
      const dropped = usageLog.splice(0, usageLog.length - 500)
      for (const e of dropped) archivedUsage.push(e)
    }
    money = moneyOf({ gold: money.gold, silver: money.silver, copper: money.copper + costCu })
    void persist()
  }

  function notifyReady() {
    ready = true
    const w = readyWaiters
    readyWaiters = []
    w.forEach((fn) => { try { fn() } catch (e) { /* ignore */ } })
  }
  async function ensureLoaded() {
    if (ready) return
    if (readyWaiters.length > 0) return new Promise((resolve) => { readyWaiters.push(resolve) })
    readyWaiters.push(() => {})
    try {
      await load()
      notifyReady()
    } catch (e) {
      ctx.logger?.error('dsh-backpack load failed: %s', String((e && e.message) || e))
      data = seed()
      money = moneyOf(data.money)
      usageLog = data.usageLog
      totalUsage = data.totalUsage
      modelUsage = data.modelUsage
      scanState = data.scanState
      try { await rebuildAllowed() } catch (e2) { /* ignore */ }
      try { await persist() } catch (e2) { /* ignore */ }
      notifyReady()
    }
  }

  function resolveStatePath(cfg) {
    const custom = (cfg.statePath || '').trim()
    return custom ? custom : join(homedir(), '.dsh', 'backpack-state.json')
  }

  async function load() {
    const cfg = resolveConfig(settings.get())
    statePath = resolveStatePath(cfg)
    // 清理上次崩溃遗留的临时文件（best effort）
    try {
      const dir = dirname(statePath)
      const base = basename(statePath)
      for (const e of await fsp.readdir(dir)) {
        if (e.startsWith(base + '.tmp-')) { try { await fsp.unlink(join(dir, e)) } catch (e2) { /* ignore */ } }
      }
    } catch (e) { /* ignore */ }
    try {
      const txt = await fsp.readFile(statePath, 'utf8')
      const parsed = migrateState(JSON.parse(txt))
      if (parsed && Array.isArray(parsed.bags) && Array.isArray(parsed.items)) {
        data = sanitize(parsed)
        money = moneyOf(data.money)
        usageLog = data.usageLog
        totalUsage = data.totalUsage
        modelUsage = data.modelUsage
        modelCostCu = data.modelCostCu || {}
        // 旧状态无 modelCostCu 时，从保留的 usageLog 按模型回填（近 500 条近似）
        if (Object.keys(modelCostCu).length === 0 && usageLog.length) {
          const m = {}
          usageLog.forEach((e) => { if (e && e.model) m[e.model] = Math.round((m[e.model] || 0) + (e.costCu || 0)) })
          modelCostCu = m
        }
        dayCostCu = data.dayCostCu || {}
        // 旧状态无 dayCostCu 时，从保留的 usageLog 按自然日回填（近 500 条近似）
        if (Object.keys(dayCostCu).length === 0 && usageLog.length) {
          const d = {}
          usageLog.forEach((e) => { if (e && e.ts) { const k = localDayKey(e.ts); d[k] = Math.round((d[k] || 0) + (e.costCu || 0)) } })
          dayCostCu = d
        }
        scanState = data.scanState
        await rebuildAllowed()
        activePath = statePath
        diag = { statePath: statePath, activePath: activePath, lastError: '' }
        return
      }
    } catch (e) { /* fallthrough to seed */ }
    data = seed()
    money = moneyOf(data.money)
    usageLog = data.usageLog
    totalUsage = data.totalUsage
    modelUsage = data.modelUsage
    modelCostCu = data.modelCostCu || {}
    dayCostCu = data.dayCostCu || {}
    scanState = data.scanState
    await rebuildAllowed()
    await persist()
  }

  async function persist() {
    const target = statePath || resolveStatePath(resolveConfig(settings.get()))
    if (!data) return { ok: false, error: '数据未初始化' }
    const run = async () => {
      try {
        // B6：先把归档缓冲区的旧明细追加到归档文件（审计保留）
        if (archivedUsage.length > 0) {
          const archPath = target.replace(/\.json$/i, '-usage-archive.jsonl')
          const lines = archivedUsage.map((e) => JSON.stringify(e)).join('\n') + '\n'
          await fsp.appendFile(archPath, lines, 'utf8')
          archivedUsage = []
        }
        data.money = moneyOf(money)
        data.usageLog = usageLog
        data.totalUsage = totalUsage
        data.modelUsage = modelUsage
        data.modelCostCu = modelCostCu
        // 剪枝：只保留近 30 天的日账本（yyyy-mm-dd 字典序可直接比较）
        const dayCut = localDayKey(Date.now() - 30 * 86400000)
        Object.keys(dayCostCu).forEach((k) => { if (k < dayCut) delete dayCostCu[k] })
        data.dayCostCu = dayCostCu
        data.scanState = scanState
        const tmp = target + '.tmp-' + Date.now()
        await fsp.writeFile(tmp, JSON.stringify(data), 'utf8')
        // 覆盖前把上一份备份为 .bak（防一次坏写入丢光账本）
        try { await fsp.copyFile(target, target + '.bak') } catch (e) { /* 首次无旧文件 */ }
        await fsp.rename(tmp, target)
        statePath = target
        activePath = target
        diag = { statePath: statePath, activePath: activePath, lastError: '' }
        return { ok: true, path: target }
      } catch (e) {
        diag = { statePath: statePath, activePath: activePath, lastError: String((e && e.message) || e) }
        return { ok: false, error: String((e && e.message) || e) }
      }
    }
    // 串行化写入，避免并发 tmp+rename 交错
    const p = persistChain.then(run, run)
    persistChain = p.then(() => {}, () => {})
    return p
  }
  let persistChain = Promise.resolve()

  const normPath = (p) => String(p).replace(/\\/g, '/')
  async function rebuildAllowed() {
    mediaAllowed.clear()
    try {
      const entries = await fsp.readdir(TYPE_ICON_DIR)
      entries.forEach((e) => { if (/\.png$/i.test(e)) mediaAllowed.add(normPath(join(TYPE_ICON_DIR, e))) })
    } catch (e) { /* icons dir unavailable */ }
    if (!data) return
    data.items.forEach((it) => {
      const p = String(it.payload || '')
      if (/^(?:[A-Za-z]:[\\/]|~[\\/]|[\\/]|\.{1,2}[\\/])/.test(p)) mediaAllowed.add(normPath(p))
      const ic = String(it.icon || '')
      if (ic && /^(?:[A-Za-z]:[\\/]|~[\\/]|[\\/]|\.{1,2}[\\/])/.test(ic)) mediaAllowed.add(normPath(ic))
    })
  }

  // ── 用量记账：扫描会话日志（sessionQuery），覆盖全部会话（含已归档），首次全量回填后按 seq 增量 ──
  const scanDiag = { lastRun: 0, sessions: 0, batch: 0, tallied: 0, lastError: '' }
  // C1 扫描旋转批次：每 tick 处理的会话数（常规轮次轮转，fresh 全量）
  const SCAN_BATCH = 2
  let scanCursor = 0
  async function scanSessions() {
    if (scanBusy) return
    scanBusy = true
    try {
      const cfg = resolveConfig(settings.get())
      const sq = ctx.sessionQuery
      if (!sq || typeof sq.listSessions !== 'function' || (typeof sq.readSession !== 'function' && typeof sq.listEvents !== 'function')) {
        scanDiag.lastError = 'sessionQuery 不可用或缺少 readSession/listEvents'
        return
      }
      await ensureLoaded()
      // 定价规则修订（PRICE_REV 变化）或首次运行：以日志为准重建账本
      const fresh = !scanState.__init || scanState.__priceRev !== PRICE_REV
      if (fresh) {
        money = { gold: 0, silver: 0, copper: 0 }
        totalUsage = { input: 0, output: 0, hit: 0 }
        modelUsage = {}
        modelCostCu = {}
        dayCostCu = {}
        usageLog = []
        // 清空按会话的 seq 游标，让全量回填重算（同时清掉旧 __priceRev）
        const next = {}
        next.__init = 1
        next.__priceRev = PRICE_REV
        scanState = next
      }
      let sessions = []
      try { sessions = await sq.listSessions() } catch (e) { scanDiag.lastError = 'listSessions: ' + String((e && e.message) || e); return }
      // 记录形状为 { header, live, persisted }，会话 id 在 header.id
      const idOf = (s) => {
        if (!s || typeof s !== 'object') return ''
        if (s.header && typeof s.header.id === 'string' && s.header.id) return s.header.id
        if (typeof s.id === 'string' && s.id) return s.id
        if (typeof s.sessionId === 'string' && s.sessionId) return s.sessionId
        return ''
      }
      const ids = []
      sessions.forEach((s) => { const id = idOf(s); if (id && ids.indexOf(id) < 0) ids.push(id) })
      scanDiag.sessions = ids.length
      // C1 旋转批次：常规轮次每 tick 只处理 BATCH 个会话（轮转），
      // 避免每 60s 全量解压大会话日志；fresh 全量重建时一次性扫完所有会话
      let batchIds = ids
      if (!fresh) {
        if (scanCursor >= ids.length) scanCursor = 0
        const next = []
        for (let i = 0; i < SCAN_BATCH && scanCursor + i < ids.length; i++) next.push(ids[scanCursor + i])
        scanCursor += next.length
        batchIds = next
      } else {
        scanCursor = ids.length
      }
      scanDiag.batch = batchIds.length
      let changed = false
      // 遍历本轮批次（fresh 时为全部会话；常规轮次为旋转窗口，不截断不漏扫）
      for (const id of batchIds) {
        // listEvents 只带 {seq,type,time,surface}；要用 readSession 取完整事件（含 data.header / data.usage）
        let events = []
        try {
          if (typeof sq.readSession === 'function') {
            const loaded = await sq.readSession(id)
            events = loaded && Array.isArray(loaded.events) ? loaded.events : []
          } else {
            const list = await sq.listEvents(id)
            events = Array.isArray(list) ? list : []
          }
        } catch (e) { scanDiag.lastError = 'readSession ' + id + ': ' + String((e && e.message) || e); continue }
        if (!Array.isArray(events)) continue
        const last = scanState[id] || 0
        let maxSeq = last
        let model = 'unknown'
        for (const ev of events) {
          if (!ev || typeof ev !== 'object') continue
          const seq = Math.max(0, Math.floor(Number(ev.seq) || 0))
          const evData = ev.data && typeof ev.data === 'object' ? ev.data : null
          if (seq <= last) {
            if (ev.type === 'request/header' && evData && evData.header) model = modelOf(evData.header)
            continue
          }
          if (seq > maxSeq) maxSeq = seq
          if (ev.type === 'request/header' && evData && evData.header) model = modelOf(evData.header)
          else if (ev.type === 'assistant/message' && evData && evData.usage) { try { tallyUsage(evData.usage, model, cfg, ev.time) } catch (e) { ctx.logger?.warn('dsh-backpack tally failed: %s', String((e && e.message) || e)) } changed = true; scanDiag.tallied += 1 }
        }
        if (maxSeq > last) scanState[id] = maxSeq
      }
      scanDiag.lastRun = Date.now()
      if (changed) await persist()
    } finally {
      scanBusy = false
    }
  }
  function modelOf(header) {
    try {
      if (!header) return 'unknown'
      if (typeof header.model === 'string' && header.model) return header.model
      if (header.config && typeof header.config.model === 'string' && header.config.model) return header.config.model
    } catch (e) { /* ignore */ }
    return 'unknown'
  }

  function urlName(url) {
    try {
      const s = String(url)
      const i = s.indexOf('://')
      const rest = i >= 0 ? s.slice(i + 3) : s
      const slash = rest.indexOf('/')
      const host = slash >= 0 ? rest.slice(0, slash) : rest
      const pathPart = slash >= 0 ? rest.slice(slash + 1) : ''
      const seg = pathPart.split(/[\\/]/).filter(Boolean).pop() || ''
      return (host + (seg ? '/' + seg.slice(0, 24) : '')).slice(0, 80)
    } catch (e) { return String(url).slice(0, 80) }
  }

  async function detect(raw) {
    const text = String(raw || '').trim()
    if (!text) return { error: '内容为空' }
    if (/^https?:\/\/\S+$/i.test(text)) {
      return { type: 'link', name: urlName(text), rarity: 1, payload: text, extra: {} }
    }
    if (/^@?[a-z][a-z0-9-]{2,40}$/i.test(text) && /\d/.test(text)) {
      const p = text.replace(/^@/, '')
      return { type: 'plugin', name: '@' + p, rarity: 4, payload: p, extra: {} }
    }
    if (text.charAt(0) === '{' || text.charAt(0) === '[') {
      try {
        const obj = JSON.parse(text)
        if (obj && typeof obj === 'object' && !Array.isArray(obj) && obj.mcpServers && typeof obj.mcpServers === 'object') {
          const keys = Object.keys(obj.mcpServers)
          const nm = keys.length ? String(keys[0]) : 'mcp'
          return { type: 'mcp', name: nm + ' (MCP)', rarity: 4, payload: text, extra: {} }
        }
        if (Array.isArray(obj) && obj.length && obj.every((o) => o && typeof o === 'object' && typeof o.name === 'string' && 'payload' in o)) {
          return { type: 'bundle', name: '组合包 (' + obj.length + ' 件)', rarity: 5, payload: text, extra: {} }
        }
        return { type: 'note', name: 'JSON 数据', rarity: 1, payload: text, extra: {} }
      } catch (e) { /* not json */ }
    }
    if (/^(?:[A-Za-z]:[\\/]|~[\\/]|[\\/]{2}|[\\/]|\.{1,2}[\\/])/.test(text) && text.length <= 1024) {
      const base = text.split(/[\\/]/).filter(Boolean).pop() || text
      try {
        const st = await fsp.stat(text)
        const ext = extOf(text)
        const size = typeof st.size === 'number' ? st.size : 0
        if (IMAGE_EXT.indexOf(ext) >= 0) return { type: 'image', name: base, rarity: 3, payload: text, extra: { size: size } }
        if (VIDEO_EXT.indexOf(ext) >= 0) return { type: 'video', name: base, rarity: 4, payload: text, extra: { size: size } }
        const isText = TEXT_EXT.indexOf(ext) >= 0
        return { type: 'file', name: base, rarity: isText ? 2 : 1, payload: text, extra: { size: size, text: !!isText } }
      } catch (e) { /* missing */ }
      return { type: 'file', name: base, rarity: 1, payload: text, extra: { size: 0, missing: true } }
    }
    if (/^[>$]\s+/.test(text) || text.indexOf('&&') >= 0 || /\|\s*$/.test(text)) {
      return { type: 'command', name: text.slice(0, 24), rarity: 5, payload: text, extra: {} }
    }
    if (text.length > 120 || text.indexOf('\n') >= 0) {
      return { type: 'prompt', name: text.slice(0, 24).replace(/\s+/g, ' '), rarity: 2, payload: text, extra: {} }
    }
    return { type: 'note', name: text.slice(0, 24), rarity: 1, payload: text, extra: {} }
  }

  function mimeOf(p) {
    const ext = extOf(p)
    const map = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bmp': 'image/bmp', '.ico': 'image/x-icon',
      '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska', '.m4v': 'video/x-m4v',
      '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
      '.pdf': 'application/pdf', '.zip': 'application/zip', '.gz': 'application/gzip',
    }
    return map[ext] || (TEXT_EXT.indexOf(ext) >= 0 ? 'text/plain; charset=utf-8' : 'application/octet-stream')
  }

  // ── Web API：浏览器客户端通过 fetch 调用（与动态版 host.call 一一对应） ──
  async function dispatch(method, args) {
    switch (method) {
      case 'get-state': {
        await ensureLoaded()
        return { ok: true, data: data, diag: diag, scan: scanDiag }
      }
      case 'scan-debug': {
        await ensureLoaded()
        const sq = ctx.sessionQuery
        const out = { has: !!sq, methods: {}, sessions: [], samples: [] }
        if (sq) {
          out.methods = { listSessions: typeof sq.listSessions === 'function', readSession: typeof sq.readSession === 'function', listEvents: typeof sq.listEvents === 'function' }
          const idOf = (s) => {
            if (!s || typeof s !== 'object') return ''
            if (s.header && typeof s.header.id === 'string' && s.header.id) return s.header.id
            if (typeof s.id === 'string' && s.id) return s.id
            if (typeof s.sessionId === 'string' && s.sessionId) return s.sessionId
            return ''
          }
          try {
            const s = await sq.listSessions()
            out.sessionCount = (s || []).length
            for (const rec of (s || []).slice(0, 3)) {
              const id = idOf(rec)
              const row = { id: id, recordKeys: Object.keys(rec || {}) }
              try {
                const loaded = await sq.readSession(id)
                row.loadKeys = Object.keys(loaded || {})
                const evs = loaded && Array.isArray(loaded.events) ? loaded.events : []
                row.eventCount = evs.length
                const ev0 = evs[0]
                row.event0Keys = ev0 ? Object.keys(ev0) : null
                row.event0 = ev0 ? JSON.stringify(ev0).slice(0, 300) : null
                let withUsage = 0
                let maxSeq = -1
                for (const ev of evs) {
                  if (!ev || typeof ev !== 'object') continue
                  const seq = Math.max(0, Math.floor(Number(ev.seq) || 0))
                  if (seq > maxSeq) maxSeq = seq
                  if (ev.data && ev.data.usage) withUsage++
                }
                row.withUsage = withUsage
                row.maxSeq = maxSeq
              } catch (e) { row.loadErr = String((e && e.message) || e) }
              out.samples.push(row)
            }
          } catch (e) { out.listErr = String((e && e.message) || e) }
        }
        return { ok: true, debug: out }
      }
      case 'persist': {
        await ensureLoaded()
        if (!plainObj(args) || !plainObj(args.data)) return { ok: false, error: '无效请求' }
        let json
        try { json = JSON.stringify(args.data) } catch (e) { return { ok: false, error: '数据无法序列化' } }
        if (json.length > 8 * 1024 * 1024) return { ok: false, error: '数据过大' }
        data = sanitize(args.data)
        data.money = moneyOf(money)
        try { await rebuildAllowed() } catch (e) { /* ignore */ }
        const res = await persist()
        return { ok: res.ok, error: res.error || null, path: res.path || null }
      }
      case 'detect':
        return detect(args && args.text)
      case 'read-reply': {
        // 从会话事件日志读取指定 assistant 消息的正文（权威数据，与 UI 渲染一致）
        const sid = String((args && args.sessionId) || '').slice(0, 128)
        const mid = String((args && args.messageId) || '').slice(0, 128)
        const sq = ctx.sessionQuery
        if (!sq || typeof sq.readSession !== 'function') return { ok: false, error: 'sessionQuery 不可用' }
        try {
          const loaded = await sq.readSession(sid)
          const events = loaded && Array.isArray(loaded.events) ? loaded.events : []
          for (const ev of events) {
            if (!ev || ev.type !== 'assistant/message' || !ev.data || typeof ev.data !== 'object') continue
            const msg = ev.data.message
            if (!msg || typeof msg !== 'object' || String(msg.id) !== mid) continue
            const content = Array.isArray(msg.content) ? msg.content : []
            const parts = content
              .filter((b) => b && (b.type === 'text' || b.type === 'reasoning') && typeof b.text === 'string' && b.text.trim())
              .map((b) => b.text)
            const text = parts.join('\n').trim()
            return { ok: true, text: text, model: (msg.source && typeof msg.source === 'object' && msg.source.model) || '' }
          }
          return { ok: false, error: '未找到该回复' }
        } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
      }
      case 'detect-many': {
        const cands = Array.isArray(args && args.candidates) ? args.candidates.slice(0, 50) : []
        const out = []
        for (let i = 0; i < cands.length; i++) {
          const value = String((cands[i] && cands[i].value) || '').trim()
          if (!value) continue
          const spec = await detect(value)
          if (!spec.error) out.push(spec)
        }
        return { ok: true, specs: out }
      }
      case 'list-icons': {
        try {
          const entries = await fsp.readdir(TYPE_ICON_DIR)
          const icons = entries.filter((e) => /\.png$/i.test(e)).map((e) => ({ name: e, path: join(TYPE_ICON_DIR, e) })).sort((a, b) => (a.name < b.name ? -1 : 1))
          return { ok: true, dir: TYPE_ICON_DIR, icons: icons }
        } catch (e) { return { ok: false, icons: [] } }
      }
      case 'get-money': {
        await ensureLoaded()
        return { ok: true, money: moneyOf(money) }
      }
      case 'open-file-location': {
        // 打开本地路径物品所在位置（Windows 资源管理器选中该文件）
        const p = String((args && args.path) || '').trim().slice(0, 1024)
        if (!/^(?:[A-Za-z]:[\\/]|[\\/]{2})/.test(p)) return { ok: false, error: '仅支持 Windows 本地路径' }
        try {
          const st = await fsp.stat(p)
          if (!st) return { ok: false, error: '文件不存在' }
        } catch (e) { return { ok: false, error: '文件不存在' } }
        try {
          const child = spawn('explorer.exe', ['/select,' + p], { detached: true, stdio: 'ignore' })
          child.unref()
          return { ok: true, path: p }
        } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
      }
      case 'get-usage': {
        await ensureLoaded()
        // 每个模型的累计花费（铜币），并入模型清单
        const models = {}
        Object.keys(modelUsage).forEach((m) => {
          const src = modelUsage[m] || {}
          models[m] = { input: src.input || 0, hit: src.hit || 0, output: src.output || 0, costCu: modelCostCu[m] || 0 }
        })
        // 近 7 个自然日（含今天）每天总花费（铜币）：直接取账本 dayCostCu，与 money/modelCostCu 严格一致
        const nowMs = Date.now()
        const days = []
        for (let i = 6; i >= 0; i--) {
          const k = localDayKey(nowMs - i * 86400000)
          days.push({ date: k, costCu: dayCostCu[k] || 0 })
        }
        return { ok: true, session: Object.assign({}, sessionUsage), totals: Object.assign({}, totalUsage), models: models, days: days, log: usageLog.slice(-50) }
      }
      case 'scan-now': {
        await ensureLoaded()
        await scanSessions()
        return { ok: true, session: Object.assign({}, sessionUsage), totals: Object.assign({}, totalUsage), models: modelUsage, scanState: scanState }
      }
      case 'add-money': {
        await ensureLoaded()
        const add = moneyOf(args)
        money = moneyOf({ gold: money.gold + add.gold, silver: money.silver + add.silver, copper: money.copper + add.copper })
        await persist()
        return { ok: true, money: moneyOf(money) }
      }
      case 'list-skills': {
        try {
          const skillsSvc = ctx.get('skills')
          if (!skillsSvc || typeof skillsSvc.list !== 'function') return { ok: true, skills: [] }
          const list = await skillsSvc.list()
          const skills = (list || []).map((s) => (s && typeof s.name === 'string' ? s.name : null)).filter(Boolean).slice(0, 500)
          return { ok: true, skills: skills }
        } catch (e) { return { ok: true, skills: [] } }
      }
      case 'read-text': {
        try {
          const path = String((args && args.path) || '').slice(0, 1024)
          if (!/^(?:[A-Za-z]:[\\/]|[\\/]|~)/.test(path)) return { ok: false, error: '路径无效' }
          const real = path.replace(/^~[\\/]/, homedir() + '\\')
          const st = await fsp.stat(real)
          if (!st) return { ok: false, error: '文件不存在' }
          const maxBytes = Math.min(512 * 1024, Math.max(1024, numberOr(args && args.maxBytes, 64 * 1024)))
          const txt = await fsp.readFile(real, 'utf8')
          const truncated = txt.length > maxBytes
          return { ok: true, text: truncated ? txt.slice(0, maxBytes) : txt, truncated: truncated, size: typeof st.size === 'number' ? st.size : null }
        } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
      }
      default:
        return { ok: false, error: '未知方法: ' + String(method) }
    }
  }

  function respond(res, status, body) {
    try {
      const bytes = Buffer.from(JSON.stringify(body))
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Content-Length', String(bytes.length))
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.writeHead(status)
      res.end(bytes)
    } catch (e) { /* client gone */ }
  }

  function sameOrigin(req) {
    const origin = req.headers.origin
    if (!origin) return true
    try {
      const host = req.headers.host || ''
      const o = new URL(origin)
      return o.host === host || o.hostname === '127.0.0.1' || o.hostname === 'localhost'
    } catch (e) { return false }
  }

  async function readBody(req, maxBytes) {
    const chunks = []
    let bytes = 0
    for await (const chunk of req) {
      const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      bytes += part.length
      if (bytes > maxBytes) throw new RangeError('request body too large')
      chunks.push(part)
    }
    return Buffer.concat(chunks).toString('utf8')
  }

  const disposers = []

  // 可选 Web 路由（webServer 存在时挂载）
  ctx.inject(['webServer'], (webCtx) => {
    webCtx.effect(() => {
      const disposeApi = webCtx.webServer.register({
        kind: 'exact',
        path: '/_dsh/backpack/api',
        handler: async (req, res) => {
          if (req.method === 'GET') {
            const value = await dispatch('get-state', null)
            respond(res, 200, value)
            return
          }
          if (req.method !== 'POST') {
            res.setHeader('Allow', 'GET, POST')
            respond(res, 405, { ok: false, error: 'method not allowed' })
            return
          }
          if (!sameOrigin(req)) {
            respond(res, 403, { ok: false, error: 'origin rejected' })
            return
          }
          let body = null
          try {
            const text = await readBody(req, 8 * 1024 * 1024)
            body = JSON.parse(text || '{}')
          } catch (e) {
            respond(res, 400, { ok: false, error: 'invalid request body' })
            return
          }
          const method = typeof body.method === 'string' ? body.method : 'get-state'
          try {
            const value = await dispatch(method, body.args === undefined ? null : body.args)
            respond(res, 200, value)
          } catch (e) {
            ctx.logger?.warn('dsh-backpack api %s failed: %s', method, String((e && e.message) || e))
            respond(res, 500, { ok: false, error: String((e && e.message) || e) })
          }
        },
      })
      const disposeMedia = webCtx.webServer.register({
        kind: 'exact',
        path: '/_dsh/backpack/media',
        handler: async (req, res) => {
          try {
            const u = new URL(req.url || '/', 'http://x')
            const p = u.searchParams.get('p') || ''
            const pn = p.replace(/\\/g, '/')
            // 内置图标库：@icons/<name>.png → 包内 icons 目录（白名单按文件名）
            if (pn.startsWith('@icons/')) {
              const nm = pn.slice(7)
              if (!nm || nm.indexOf('/') >= 0 || nm.indexOf('\\') >= 0 || !/\.png$/i.test(nm)) {
                res.writeHead(404, { 'Content-Type': 'text/plain' })
                res.end('not found')
                return
              }
              const fp = join(TYPE_ICON_DIR, nm)
              const bytes = await fsp.readFile(fp)
              res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': String(bytes.length), 'Cache-Control': 'private, max-age=3600' })
              res.end(bytes)
              return
            }
            if (!pn || !mediaAllowed.has(pn)) {
              res.writeHead(404, { 'Content-Type': 'text/plain' })
              res.end('not found')
              return
            }
            // 展开 ~ 到用户主目录；限制单文件大小，避免大文件读爆内存
            const real = String(p).replace(/^~[\\/]/, homedir() + '\\')
            const st = await fsp.stat(real)
            if (st.size > 40 * 1024 * 1024) {
              res.writeHead(413, { 'Content-Type': 'text/plain' })
              res.end('too large')
              return
            }
            const bytes = await fsp.readFile(real)
            res.writeHead(200, { 'Content-Type': mimeOf(p), 'Content-Length': String(bytes.length), 'Cache-Control': 'private, max-age=3600' })
            res.end(bytes)
          } catch (e) {
            try { res.writeHead(500, { 'Content-Type': 'text/plain' }); res.end('read failed') } catch (e2) { /* ignore */ }
          }
        },
      })
      return () => { disposeMedia(); disposeApi() }
    }, 'dsh-backpack: Web routes')
  })

  // 工具
  try {
    const toolAdd = defineTool({
      name: 'backpack_add',
      description: '把一件物品放进 DSH 背包（魔兽世界风格物品栏）。当用户说「放进背包」「收藏这个链接」「把这段提示词收起来」「存到背包」时使用。payload 填物品内容（链接 URL、提示词文本、技能名、文件路径、MCP 配置 JSON、插件 ID 等），type 可省略（自动识别）。',
      parameters: {
        name: { type: 'string', description: '物品名称' },
        payload: { type: 'string', description: '物品内容：链接、提示词文本、技能名、文件路径、MCP 配置 JSON、插件 ID 等', required: true },
        type: { type: 'string', enum: TYPE_SET, description: '物品类型，可省略由系统自动识别' },
        rarity: { type: 'integer', description: '品质 0粗糙-5传说，可省略' },
        flavor: { type: 'string', description: '黄字风味描述，可省略' },
        icon: { type: 'string', description: '物品图标：本地图片路径或 data: 图片，可省略' },
        tag: { type: 'string', description: '自定义分类标签，可省略' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean', required: true },
            message: { type: 'string', required: true },
          },
        },
        render: (args, value) => [{ type: 'text', text: String((value && value.message) || '') }],
      },
      execute: async (args) => {
        await ensureLoaded()
        const spec = await detect(String((args && args.payload) || ''))
        const type = TYPE_SET.indexOf(args && args.type) >= 0 ? args.type : (spec.type || 'note')
        const payload = String((args && args.payload) || '')
        const name = String((args && args.name) || spec.name || '未命名').slice(0, 200)
        let rarity = numberOr(args && args.rarity, NaN)
        if (!(rarity >= 0 && rarity <= 5)) rarity = typeof spec.rarity === 'number' ? spec.rarity : 1
        const now = Date.now()
        const dup = data.items.find((it) => it.type === type && it.name === name && it.payload === payload && it.count < 999)
        if (dup) {
          dup.count += 1
          dup.lastUsed = now
        } else {
          const bag = data.bags.find((b) => !b.vault) || data.bags[0]
          const cap = bag ? bag.cols * bag.rows : 0
          const used = new Set(data.items.filter((it) => it.bagId === (bag ? bag.id : '') && it.slot >= 0).map((it) => it.slot))
          let free = -1
          for (let i = 0; i < cap; i++) if (!used.has(i)) { free = i; break }
          data.items.push({
            id: uid(),
            bagId: free >= 0 ? bag.id : 'bag-vault',
            slot: free,
            type: type,
            name: name,
            rarity: clampInt(rarity, 0, 5, 1),
            payload: payload.slice(0, 2 * 1024 * 1024),
            flavor: String((args && args.flavor) || '').slice(0, 300),
            icon: String((args && args.icon) || '').slice(0, 2 * 1024 * 1024),
            tag: String((args && args.tag) || '').slice(0, 32),
            count: 1,
            createdAt: now,
            lastUsed: 0,
            useCount: 0,
            extra: spec.extra || {},
          })
        }
        try { await rebuildAllowed() } catch (e) { /* ignore */ }
        const res = await persist()
        if (!res.ok) return { ok: false, message: '存入失败: ' + (res.error || '') + ' (path: ' + (activePath || '') + ')' }
        return { ok: true, message: '已放入背包: ' + name + (dup ? '（堆叠 ×' + dup.count + '）' : '') + ' → ' + (activePath || '') }
      },
    })
    disposers.push(ctx.tools.register(toolAdd))
  } catch (e) {
    ctx.logger?.error('dsh-backpack backpack_add tool register failed: %s', String((e && e.message) || e))
  }

  try {
    const toolMoney = defineTool({
      name: 'backpack_money',
      description: '记录 DSH 使用产生的 token 费用到背包货币栏（金币=元，银币=角，铜币=分，1 金=100 银=10000 铜）。当用户说「记录费用」「花了多少 token」或需要累计 DSH 使用开销时调用，传入本次消费的金银铜数量。',
      parameters: {
        gold: { type: 'integer', description: '金币（元），可省略' },
        silver: { type: 'integer', description: '银币（角），可省略' },
        copper: { type: 'integer', description: '铜币（分），可省略' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean', required: true },
            message: { type: 'string', required: true },
          },
        },
        render: (args, value) => [{ type: 'text', text: String((value && value.message) || '') }],
      },
      execute: async (args) => {
        await ensureLoaded()
        const add = moneyOf(args)
        money = moneyOf({ gold: money.gold + add.gold, silver: money.silver + add.silver, copper: money.copper + add.copper })
        const res = await persist()
        const m = moneyOf(money)
        if (!res.ok) return { ok: false, message: '记录失败: ' + (res.error || '') }
        return { ok: true, message: '已记录费用：金 ' + m.gold + ' 银 ' + m.silver + ' 铜 ' + m.copper }
      },
    })
    disposers.push(ctx.tools.register(toolMoney))
  } catch (e) {
    ctx.logger?.error('dsh-backpack backpack_money tool register failed: %s', String((e && e.message) || e))
  }

  // B1：backpack_search —— 让 Agent 检索背包（长期记忆库）
  try {
    disposers.push(ctx.tools.register(defineTool({
      name: 'backpack_search',
      description: '在背包中搜索物品（按名称/内容/类型/标签），返回匹配物品清单。当用户想从背包里找出之前收藏的链接、提示词、技能、文件路径或 MCP 配置时使用。',
      parameters: {
        query: { type: 'string', description: '搜索关键词（匹配名称/内容/类型标签）', required: true },
        type: { type: 'string', enum: TYPE_SET, description: '按物品类型过滤' },
        tag: { type: 'string', description: '按自定义分类标签过滤' },
        limit: { type: 'integer', description: '最多返回条数，默认 10' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean', required: true },
            message: { type: 'string', required: true },
          },
        },
        render: (args, value) => [{ type: 'text', text: String((value && value.message) || '') }],
      },
      execute: async (args) => {
        await ensureLoaded()
        const q = String((args && args.query) || '').toLowerCase().trim()
        const type = String((args && args.type) || '')
        const tag = String((args && args.tag) || '')
        const limit = Math.max(1, Math.min(50, clampInt(args && args.limit, 1, 50, 10)))
        let list = data.items.slice()
        if (q) list = list.filter((it) => it.name.toLowerCase().indexOf(q) >= 0 || String(it.payload || '').toLowerCase().indexOf(q) >= 0 || (it.tag || '').toLowerCase().indexOf(q) >= 0)
        if (type && TYPE_SET.indexOf(type) >= 0) list = list.filter((it) => it.type === type)
        if (tag) list = list.filter((it) => (it.tag || '') === tag)
        list.sort((a, b) => (b.rarity - a.rarity) || (a.createdAt - b.createdAt))
        if (!list.length) return { ok: true, message: '背包中没有匹配的物品' }
        const lines = list.slice(0, limit).map((it) => {
          const payload = String(it.payload || '').replace(/\s+/g, ' ').slice(0, 60)
          return '[' + (it.type || 'note') + '·' + it.rarity + '] ' + it.name + ' (id=' + it.id + ')' + (it.tag ? ' 分类:' + it.tag : '') + '\n    ' + payload
        })
        return { ok: true, message: '找到 ' + list.length + ' 件物品（显示前 ' + Math.min(limit, list.length) + '）：\n' + lines.join('\n') }
      },
    })))
  } catch (e) {
    ctx.logger?.error('dsh-backpack backpack_search tool register failed: %s', String((e && e.message) || e))
  }

  // 定时扫描
  let scanTimer = null
  function scheduleScan(cfg) {
    if (scanTimer) { clearInterval(scanTimer); scanTimer = null }
    if (!cfg.autoScan) return
    scanTimer = setInterval(() => { void scanSessions() }, Math.max(10, cfg.scanIntervalSec) * 1000)
  }
  scheduleScan(resolveConfig(settings.get()))
  disposers.push(settings.watch(async (next) => {
    try {
      const cfg = resolveConfig(next)
      scheduleScan(cfg)
      // statePath 变化：重新加载
      if (cfg.statePath.trim() && resolveStatePath(cfg) !== statePath) {
        await load()
      }
    } catch (e) {
      ctx.logger?.error('dsh-backpack settings watch failed: %s', String((e && e.message) || e))
    }
  }))
  void scanSessions()

  return () => {
    if (scanTimer) clearInterval(scanTimer)
    for (const dispose of disposers.reverse()) { try { dispose() } catch (e) { /* ignore */ } }
  }
}
