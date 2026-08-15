/**
 * @ggame/quest — 常驻版 DSH 任务插件（host half）。
 *
 * 仿魔兽世界任务系统：任务面板（L 键）、总体任务看板、任务追踪条、任务维护，
 * 以及与 Agent 的联动工具（quest_add / quest_update / quest_complete / quest_progress / quest_list）。
 * 所有状态持久化在 ~/.dsh/quest-state.json（可在设置中修改路径）。
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import { promises as fsp } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LEVEL_SET, STATUS_SET, RECUR_SET, CATEGORY_MAX, QUEST_MAX, OBJECTIVE_MAX, TEXT_MAX, plainObj, clampInt, numberOr, seed, sanitize, findQuest, newQuest, dueAtOf, objectiveId, applyRecur } from './model.js'

export const name = '@ggame/quest'

export const QUEST_SETTINGS_NAMESPACE = settingsNamespace('quest')

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TYPE_ICON_DIR = join(PACKAGE_ROOT, 'icons')

/** 插件设置：设置 → 插件 → 插件配置 中展示的表单。 */
export const Config = z.object({
  /** 状态文件路径；留空使用默认 ~/.dsh/quest-state.json */
  statePath: z.string().default(''),
}).default({})

export function resolveConfig(config = {}) {
  return { statePath: String((config && config.statePath) || '').trim() }
}

export const inject = ['tools', 'settings']

/** Plugin entry: register settings, load state, mount tools and Web routes. */
export async function apply(ctx, config = {}) {
  const settings = ctx.settings.register(QUEST_SETTINGS_NAMESPACE, Config, {
    base: config,
    applies: 'live',
    validate: (value) => { resolveConfig(value) },
  })

  let data = null
  let statePath = ''
  let ready = false
  let readyWaiters = []
  let persistChain = Promise.resolve()
  const mediaAllowed = new Set()

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
      ctx.logger?.error('dsh-quest load failed: %s', String((e && e.message) || e))
      data = seed()
      try { await persist() } catch (e2) { /* ignore */ }
      notifyReady()
    }
  }

  function resolveStatePath(cfg) {
    const custom = (cfg.statePath || '').trim()
    return custom ? custom : join(homedir(), '.dsh', 'quest-state.json')
  }

  async function load() {
    statePath = resolveStatePath(resolveConfig(settings.get()))
    try {
      const txt = await fsp.readFile(statePath, 'utf8')
      const parsed = JSON.parse(txt)
      if (parsed && Array.isArray(parsed.quests)) {
        data = sanitize(parsed)
        return
      }
    } catch (e) { /* fallthrough to seed */ }
    data = seed()
    await persist()
  }

  async function persist() {
    const target = statePath || resolveStatePath(resolveConfig(settings.get()))
    if (!data) return { ok: false, error: '数据未初始化' }
    const run = async () => {
      try {
        const tmp = target + '.tmp-' + Date.now()
        await fsp.writeFile(tmp, JSON.stringify(data), 'utf8')
        await fsp.rename(tmp, target)
        statePath = target
        return { ok: true, path: target }
      } catch (e) {
        return { ok: false, error: String((e && e.message) || e) }
      }
    }
    const p = persistChain.then(run, run)
    persistChain = p.then(() => {}, () => {})
    return p
  }

  // 图标/图片白名单：包内 icons 目录 + 任务自定义图标路径
  const normPath = (p) => String(p).replace(/\\/g, '/')
  async function rebuildAllowed() {
    mediaAllowed.clear()
    try {
      const entries = await fsp.readdir(TYPE_ICON_DIR)
      entries.forEach((e) => { if (/\.png$/i.test(e)) mediaAllowed.add(normPath(join(TYPE_ICON_DIR, e))) })
    } catch (e) { /* icons dir unavailable */ }
    if (!data) return
    data.quests.forEach((q) => {
      const ic = String(q.icon || '')
      if (ic && /^(?:[A-Za-z]:[\\/]|~[\\/]|[\\/]|\.{1,2}[\\/])/.test(ic)) mediaAllowed.add(normPath(ic))
    })
  }

  // ── 任务操作（供 Web API 与 Agent 工具共用；数据模型见 ./model.js） ──
  function touch(q) { q.updatedAt = Date.now() }
  function objectiveDone(o) { return o.current >= o.target }
  function questDone(q) { return q.objectives.length > 0 && q.objectives.every(objectiveDone) }
  function afterMutate() {
    touchData()
    void persist()
  }
  function touchData() {
    if (data.categories.length > CATEGORY_MAX) data.categories = data.categories.slice(0, CATEGORY_MAX)
    if (data.quests.length > QUEST_MAX) data.quests = data.quests.slice(0, QUEST_MAX)
    void rebuildAllowed()
  }

  // ── Web API：浏览器客户端通过 fetch 调用 ──
  async function dispatch(method, args) {
    switch (method) {
      case 'get-state': {
        await ensureLoaded()
        return { ok: true, data: data }
      }
      case 'get-quest': {
        // E1 轮询瘦身：只返回单个任务，客户端处理中轮询用
        await ensureLoaded()
        const q = findQuest(data, args)
        if (!q) return { ok: false, error: '任务不存在' }
        return { ok: true, quest: q }
      }
      case 'persist': {
        await ensureLoaded()
        if (!plainObj(args) || !plainObj(args.data)) return { ok: false, error: '无效请求' }
        let json
        try { json = JSON.stringify(args.data) } catch (e) { return { ok: false, error: '数据无法序列化' } }
        if (json.length > 8 * 1024 * 1024) return { ok: false, error: '数据过大' }
        data = sanitize(args.data)
        try { await rebuildAllowed() } catch (e) { /* ignore */ }
        const res = await persist()
        return { ok: res.ok, error: res.error || null, path: res.path || null }
      }
      case 'add-category': {
        await ensureLoaded()
        const name = String((args && args.name) || '').slice(0, 32).trim()
        if (!name) return { ok: false, error: '分类名不能为空' }
        if (data.categories.indexOf(name) >= 0) return { ok: true, data: data }
        data.categories.push(name)
        await persist()
        return { ok: true, data: data }
      }
      case 'delete-category': {
        await ensureLoaded()
        const name = String((args && args.name) || '')
        data.categories = data.categories.filter((c) => c !== name)
        data.quests.forEach((q) => { if (q.category === name) q.category = '' })
        await persist()
        return { ok: true, data: data }
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
  function mimeOf(p) {
    const ext = String(p).toLowerCase().match(/\.[a-z0-9]{1,8}$/)
    const e = ext ? ext[0] : ''
    const map = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' }
    return map[e] || 'application/octet-stream'
  }

  // 可选 Web 路由（webServer 存在时挂载）
  ctx.inject(['webServer'], (webCtx) => {
    webCtx.effect(() => {
      const disposeApi = webCtx.webServer.register({
        kind: 'exact',
        path: '/_dsh/quest/api',
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
            ctx.logger?.warn('dsh-quest api %s failed: %s', method, String((e && e.message) || e))
            respond(res, 500, { ok: false, error: String((e && e.message) || e) })
          }
        },
      })
      const disposeMedia = webCtx.webServer.register({
        kind: 'exact',
        path: '/_dsh/quest/media',
        handler: async (req, res) => {
          try {
            const u = new URL(req.url || '/', 'http://x')
            const p = u.searchParams.get('p') || ''
            const pn = p.replace(/\\/g, '/')
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
            const bytes = await fsp.readFile(p)
            res.writeHead(200, { 'Content-Type': mimeOf(p), 'Content-Length': String(bytes.length), 'Cache-Control': 'private, max-age=3600' })
            res.end(bytes)
          } catch (e) {
            try { res.writeHead(500, { 'Content-Type': 'text/plain' }); res.end('read failed') } catch (e2) { /* ignore */ }
          }
        },
      })
      return () => { disposeMedia(); disposeApi() }
    }, 'dsh-quest: Web routes')
  })

  // ── Agent 工具 ──
  const disposers = []
  const textOutput = {
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        ok: { type: 'boolean', required: true },
        message: { type: 'string', required: true },
      },
    },
    render: (args, value) => [{ type: 'text', text: String((value && value.message) || '') }],
  }

  const objectiveSpec = {
    text: { type: 'string', description: '目标内容' },
    target: { type: 'integer', description: '目标数量（默认 1）' },
  }
  const questRefSpec = {
    id: { type: 'string', description: '任务 id（与 title 二选一，优先 id）' },
    title: { type: 'string', description: '任务标题（与 id 二选一，精确匹配）' },
  }

  try {
    disposers.push(ctx.tools.register(defineTool({
      name: 'quest_add',
      description: '创建一个新任务（魔兽世界风格任务系统）。当用户说「记成任务」「新建任务」「把 XXX 设为任务」时使用。可带等级 1-5、分类、描述、目标清单（objectives: [{text, target}]）与奖励。创建后默认进入追踪。',
      parameters: {
        title: { type: 'string', description: '任务标题', required: true },
        level: { type: 'integer', enum: [1, 2, 3, 4, 5], description: '难度等级 1-5（灰/绿/黄/橙/红），默认 1' },
        category: { type: 'string', description: '分类（主线/支线/日常 或自定义）' },
        description: { type: 'string', description: '任务描述' },
        objectives: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { text: { type: 'string', required: true }, target: { type: 'integer' } } }, description: '目标清单：[{text, target}]，target 默认 1' },
        rewards: { type: 'string', description: '奖励描述' },
        dueAt: { type: 'string', description: '到期时间：时间戳(ms)或 ISO 日期字符串（如 2026-08-20T18:00），可省略' },
        recur: { type: 'string', enum: RECUR_SET, description: '重复周期：空=不重复，daily=每日，weekly=每周（完成后自动重置）' },
        status: { type: 'string', enum: STATUS_SET, description: '初始状态，默认 tracked' },
      },
      output: textOutput,
      execute: async (args) => {
        await ensureLoaded()
        const title = String(args.title || '').trim()
        // 工具按 title 精确定位，重名会造成歧义 → 拒绝重复标题
        if (title && data.quests.some((q) => q.title === title)) {
          return { ok: false, message: '已存在同名任务「' + title + '」，请换一个标题，或改用 quest_update 更新原任务' }
        }
        const quest = newQuest(data, args)
        afterMutate()
        const obj = quest.objectives.length ? ' 目标 ' + quest.objectives.length + ' 个' : ''
        return { ok: true, message: '已创建任务：' + quest.title + '（等级 ' + quest.level + ' / ' + (quest.category || '未分类') + '）' + obj + '，id=' + quest.id }
      },
    })))
  } catch (e) {
    ctx.logger?.error('dsh-quest quest_add register failed: %s', String((e && e.message) || e))
  }

  try {
    disposers.push(ctx.tools.register(defineTool({
      name: 'quest_update',
      description: '更新一个已有任务的字段（标题/等级/分类/描述/奖励/状态/目标清单整体替换）。通过 id 或 title 定位任务。',
      parameters: {
        ...questRefSpec,
        newTitle: { type: 'string', description: '新的标题（改标题用这个；title 只用于定位）' },
        level: { type: 'integer', enum: [1, 2, 3, 4, 5], description: '难度等级 1-5' },
        category: { type: 'string', description: '分类' },
        description: { type: 'string', description: '任务描述' },
        rewards: { type: 'string', description: '奖励' },
        dueAt: { type: 'string', description: '到期时间：时间戳(ms)或 ISO 日期字符串；传 0/空 清除' },
        recur: { type: 'string', enum: RECUR_SET, description: '重复周期：空=不重复，daily=每日，weekly=每周' },
        status: { type: 'string', enum: STATUS_SET, description: '状态' },
        objectives: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { text: { type: 'string', required: true }, target: { type: 'integer' }, current: { type: 'integer' } } }, description: '整体替换目标清单：[{text, target, current}]' },
      },
      output: textOutput,
      execute: async (args) => {
        await ensureLoaded()
        const q = findQuest(data, args)
        if (!q) return { ok: false, message: '未找到任务（id 或 title 均无匹配）' }
        if (args.newTitle !== undefined) q.title = String(args.newTitle).slice(0, 200)
        if (args.level !== undefined) q.level = clampInt(args.level, 1, 5, q.level)
        if (args.category !== undefined) { q.category = String(args.category).slice(0, 32); if (q.category && data.categories.indexOf(q.category) < 0) data.categories.push(q.category) }
        if (args.description !== undefined) q.description = String(args.description).slice(0, TEXT_MAX)
        if (args.rewards !== undefined) q.rewards = String(args.rewards).slice(0, 500)
        if (args.dueAt !== undefined) q.dueAt = dueAtOf(args.dueAt)
        if (args.recur !== undefined) q.recur = RECUR_SET.indexOf(args.recur) >= 0 ? (args.recur || '') : q.recur
        if (args.status !== undefined && STATUS_SET.indexOf(args.status) >= 0) { q.status = args.status; if (args.status === 'completed') q.completedAt = Date.now() }
        if (Array.isArray(args.objectives)) {
          q.objectives = args.objectives.slice(0, OBJECTIVE_MAX).map((o) => {
            if (!plainObj(o)) return null
            const text = String(o.text || '').trim()
            // 文本未变的目标保留原 id，客户端引用（勾选/+1）不会失效
            const existing = text ? q.objectives.find((x) => x.text === text) : null
            return {
              id: existing ? existing.id : objectiveId(),
              text: text.slice(0, TEXT_MAX),
              target: Math.max(1, clampInt(o.target, 1, 99999, 1)),
              current: Math.max(0, clampInt(o.current, 0, 99999, 0)),
            }
          }).filter(Boolean)
        }
        touch(q)
        afterMutate()
        return { ok: true, message: '已更新任务：' + q.title }
      },
    })))
  } catch (e) {
    ctx.logger?.error('dsh-quest quest_update register failed: %s', String((e && e.message) || e))
  }

  try {
    disposers.push(ctx.tools.register(defineTool({
      name: 'quest_complete',
      description: '完成一个任务（状态置为 completed）或推进某个目标到完成。通过 id 或 title 定位任务；给出 objective（目标文本或序号 1 起）则只完成该目标。注意：任务一旦完成即返回提示，无需重复调用同一任务的 quest_complete。',
      parameters: {
        ...questRefSpec,
        objective: { type: 'string', description: '目标文本或序号（1 起）；省略则完成整个任务' },
      },
      output: textOutput,
      execute: async (args) => {
        await ensureLoaded()
        const q = findQuest(data, args)
        if (!q) return { ok: false, message: '未找到任务' }
        if (args.objective === undefined || args.objective === null || args.objective === '') {
          q.objectives.forEach((o) => { o.current = o.target })
          q.status = 'completed'
          q.completedAt = Date.now()
          touch(q)
          afterMutate()
          // D2：重复任务完成后自动重置到下一周期
          if (applyRecur(q)) {
            afterMutate()
            return { ok: true, message: '任务已完成：' + q.title + '（重复任务，已重置为下一周期：' + (q.recur === 'daily' ? '每日' : '每周') + '）' }
          }
          return { ok: true, message: '任务已完成：' + q.title }
        }
        const raw = String(args.objective).trim()
        const idx = /^\d+$/.test(raw) ? Number(raw) - 1 : -1
        const o = idx >= 0 && q.objectives[idx] ? q.objectives[idx] : q.objectives.find((x) => x.text === raw)
        if (!o) return { ok: false, message: '未找到该目标' }
        o.current = o.target
        touch(q)
        afterMutate()
        const done = questDone(q)
        if (done) { q.status = 'completed'; q.completedAt = Date.now(); afterMutate() }
        return { ok: true, message: '目标已完成：' + o.text + (done ? '；任务已全部完成：' + q.title : '') }
      },
    })))
  } catch (e) {
    ctx.logger?.error('dsh-quest quest_complete register failed: %s', String((e && e.message) || e))
  }

  try {
    disposers.push(ctx.tools.register(defineTool({
      name: 'quest_progress',
      description: '推进一个任务的某个目标进度（当前值 +n，默认 +1；也可直接设为指定值）。通过 id 或 title 定位任务，用 objective 指定目标（文本或序号 1 起）。',
      parameters: {
        ...questRefSpec,
        objective: { type: 'string', description: '目标文本或序号（1 起）', required: true },
        by: { type: 'integer', description: '推进数量，默认 1' },
        set: { type: 'integer', description: '直接设为该进度（与 by 二选一，优先 set）' },
      },
      output: textOutput,
      execute: async (args) => {
        await ensureLoaded()
        const q = findQuest(data, args)
        if (!q) return { ok: false, message: '未找到任务' }
        const raw = String((args && args.objective) || '').trim()
        const idx = /^\d+$/.test(raw) ? Number(raw) - 1 : -1
        const o = idx >= 0 && q.objectives[idx] ? q.objectives[idx] : q.objectives.find((x) => x.text === raw)
        if (!o) return { ok: false, message: '未找到该目标' }
        if (args.set !== undefined && Number.isFinite(Number(args.set))) o.current = Math.max(0, Math.min(o.target, Math.floor(Number(args.set))))
        else o.current = Math.max(0, Math.min(o.target, o.current + (Math.max(0, Math.floor(numberOr(args && args.by, 1))))))
        touch(q)
        afterMutate()
        const done = questDone(q)
        const msg = '目标进度：' + o.text + ' ' + o.current + '/' + o.target + (objectiveDone(o) ? '（已完成）' : '')
        if (done) { q.status = 'completed'; q.completedAt = Date.now(); afterMutate(); return { ok: true, message: msg + '；任务已全部完成：' + q.title } }
        return { ok: true, message: msg }
      },
    })))
  } catch (e) {
    ctx.logger?.error('dsh-quest quest_progress register failed: %s', String((e && e.message) || e))
  }

  try {
    disposers.push(ctx.tools.register(defineTool({
      name: 'quest_list',
      description: '列出当前所有任务（标题、等级、分类、状态、目标进度）。可只列追踪中的或按分类过滤。',
      parameters: {
        status: { type: 'string', enum: STATUS_SET, description: '按状态过滤' },
        category: { type: 'string', description: '按分类过滤' },
      },
      output: {
        schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, message: { type: 'string', required: true } } },
        render: (args, value) => [{ type: 'text', text: String((value && value.message) || '') }],
      },
      execute: async (args) => {
        await ensureLoaded()
        let list = data.quests.slice()
        if (args && args.status) list = list.filter((q) => q.status === args.status)
        if (args && args.category) list = list.filter((q) => q.category === args.category)
        list.sort((a, b) => a.order - b.order)
        if (!list.length) return { ok: true, message: '暂无任务' }
        const lines = list.map((q) => {
          const objs = q.objectives.map((o) => '    - ' + o.text + ' ' + Math.min(o.current, o.target) + '/' + o.target).join('\n')
          return '[' + q.level + '][' + (q.category || '未分类') + '][' + q.status + '] ' + q.title + ' (id=' + q.id + ')\n' + objs
        })
        return { ok: true, message: '共 ' + list.length + ' 个任务：\n' + lines.join('\n') }
      },
    })))
  } catch (e) {
    ctx.logger?.error('dsh-quest quest_list register failed: %s', String((e && e.message) || e))
  }

  // D8：quest_search —— Agent 按关键词/状态/分类搜索任务
  try {
    disposers.push(ctx.tools.register(defineTool({
      name: 'quest_search',
      description: '在任务列表中搜索（关键词匹配标题/描述/目标内容，可叠加状态与分类过滤）。当用户想找到某个历史任务或按内容检索时使用。',
      parameters: {
        query: { type: 'string', description: '关键词（匹配标题/描述/目标）' },
        status: { type: 'string', enum: STATUS_SET, description: '按状态过滤' },
        category: { type: 'string', description: '按分类过滤' },
        limit: { type: 'integer', description: '最多返回条数，默认 10' },
      },
      output: {
        schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, message: { type: 'string', required: true } } },
        render: (args, value) => [{ type: 'text', text: String((value && value.message) || '') }],
      },
      execute: async (args) => {
        await ensureLoaded()
        const q = String((args && args.query) || '').toLowerCase().trim()
        const limit = Math.max(1, Math.min(50, clampInt(args && args.limit, 1, 50, 10)))
        let list = data.quests.slice()
        if (args && args.status) list = list.filter((x) => x.status === args.status)
        if (args && args.category) list = list.filter((x) => x.category === args.category)
        if (q) {
          list = list.filter((x) => x.title.toLowerCase().indexOf(q) >= 0 || String(x.description || '').toLowerCase().indexOf(q) >= 0 || x.objectives.some((o) => o.text.toLowerCase().indexOf(q) >= 0))
        }
        list.sort((a, b) => a.order - b.order)
        if (!list.length) return { ok: true, message: '没有匹配的任务' }
        const lines = list.slice(0, limit).map((x) => {
          const objs = x.objectives.map((o) => '    - ' + o.text + ' ' + Math.min(o.current, o.target) + '/' + o.target).join('\n')
          return '[' + x.level + '][' + (x.category || '未分类') + '][' + x.status + '] ' + x.title + ' (id=' + x.id + ')\n' + objs
        })
        return { ok: true, message: '匹配 ' + list.length + ' 个任务（显示前 ' + Math.min(limit, list.length) + '）：\n' + lines.join('\n') }
      },
    })))
  } catch (e) {
    ctx.logger?.error('dsh-quest quest_search register failed: %s', String((e && e.message) || e))
  }

  return () => {
    for (const dispose of disposers.reverse()) { try { dispose() } catch (e) { /* ignore */ } }
  }
}
