/**
 * @ggame/quest —— 任务数据模型核心（零依赖，可独立单元测试）。
 */

export const LEVEL_SET = [1, 2, 3, 4, 5]
export const STATUS_SET = ['active', 'tracked', 'completed', 'abandoned']
export const RECUR_SET = ['', 'daily', 'weekly']
export const CATEGORY_MAX = 40
export const QUEST_MAX = 2000
export const OBJECTIVE_MAX = 50
export const TEXT_MAX = 4096

export function plainObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v) }
export function clampInt(v, lo, hi, dflt) { const n = Math.floor(Number(v)); return isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt }
export function numberOr(v, dflt) { const n = Number(v); return isFinite(n) ? n : dflt }

export function uid() { return 'q-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) }
export function objectiveId() { return 'o-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6) }

/** 归一化一个目标（缺省字段补默认值；空文本返回 null）。 */
export function makeObjective(spec, fallbackId) {
  if (!plainObj(spec)) return null
  const text = String(spec.text || '').trim()
  if (!text) return null
  return {
    id: String(spec.id || fallbackId || objectiveId()).slice(0, 64),
    text: text.slice(0, TEXT_MAX),
    target: Math.max(1, clampInt(spec.target, 1, 99999, 1)),
    current: Math.max(0, clampInt(spec.current, 0, 99999, 0)),
  }
}

export function objectiveDone(o) { return !!o && o.current >= o.target }
export function questDone(q) { return !!q && q.objectives.length > 0 && q.objectives.every(objectiveDone) }

/** 到期时间归一化：接受时间戳(ms)或 ISO 字符串；0 = 无到期日。 */
export function dueAtOf(v) {
  if (v === undefined || v === null || v === '') return 0
  const n = Number(v)
  if (isFinite(n) && n > 0) return Math.floor(n)
  if (typeof v === 'string') {
    const t = Date.parse(v)
    if (isFinite(t)) return t
  }
  return 0
}

/** 首次运行的示例数据。 */
export function seed() {
  const now = Date.now()
  return {
    version: 1,
    categories: ['主线', '支线', '日常'],
    quests: [
      {
        id: uid(), title: '新手向导', level: 1, category: '主线', status: 'tracked',
        description: '欢迎来到任务面板！按 L 开合面板，右键任务可操作；左下角卷轴按钮打开追踪条。让 Agent「把 XXX 记成任务」即可联动建任务。',
        objectives: [
          makeObjective({ text: '浏览任务面板', target: 1, current: 0 }),
          makeObjective({ text: '追踪一个任务', target: 1, current: 0 }),
        ],
        rewards: '经验 +50', order: 0, icon: '', createdAt: now, updatedAt: now,
      },
      {
        id: uid(), title: '学习 Agent 联动', level: 3, category: '日常', status: 'active',
        description: '在对话里说：把「写周报」记成任务，或 quest_complete「学习 Agent 联动」。',
        objectives: [
          makeObjective({ text: '调用 quest_add 创建任务', target: 1, current: 0 }),
        ],
        rewards: '成就：自动化', order: 1, icon: '', createdAt: now, updatedAt: now,
      },
    ],
  }
}

/** 清洗并裁剪外部状态（防脏数据）。 */
export function sanitize(raw) {
  const categories = Array.isArray(raw.categories)
    ? raw.categories.slice(0, CATEGORY_MAX).map((c) => String(c).trim().slice(0, 32)).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i)
    : []
  const quests = []
  const seen = new Set()
  const rawQuests = Array.isArray(raw.quests) ? raw.quests.slice(0, QUEST_MAX) : []
  rawQuests.forEach((q) => {
    if (!plainObj(q)) return
    const id = String(q.id || '')
    if (!id || seen.has(id)) return
    const objectives = Array.isArray(q.objectives) ? q.objectives.slice(0, OBJECTIVE_MAX).map((o) => makeObjective(o)).filter(Boolean) : []
    seen.add(id)
    quests.push({
      id: id,
      title: String(q.title || '未命名任务').slice(0, 200),
      level: LEVEL_SET.indexOf(clampInt(q.level, 1, 5, 1)) >= 0 ? clampInt(q.level, 1, 5, 1) : 1,
      category: String(q.category || '').slice(0, 32),
      status: STATUS_SET.indexOf(q.status) >= 0 ? q.status : 'active',
      description: String(q.description || '').slice(0, TEXT_MAX),
      objectives: objectives,
      rewards: String(q.rewards || '').slice(0, 500),
      order: numberOr(q.order, quests.length),
      icon: typeof q.icon === 'string' ? q.icon.slice(0, 1024 * 1024) : '',
      dueAt: dueAtOf(q.dueAt),
      recur: RECUR_SET.indexOf(q.recur) >= 0 ? q.recur : '',
      createdAt: numberOr(q.createdAt, Date.now()),
      updatedAt: numberOr(q.updatedAt, Date.now()),
      completedAt: numberOr(q.completedAt, 0),
    })
  })
  return { version: 1, categories: categories, quests: quests }
}

/** D2 重复任务：完成后重置目标与状态，推进到下一周期（每日/每周）。 */
export function applyRecur(q) {
  if (!q || !q.recur) return false
  q.objectives.forEach((o) => { o.current = 0 })
  q.status = 'tracked'
  q.completedAt = 0
  const now = Date.now()
  const base = q.dueAt && q.dueAt > now ? q.dueAt : now
  q.dueAt = base + (q.recur === 'daily' ? 86400000 : 7 * 86400000)
  q.updatedAt = now
  return true
}

/** 按 id 或 title 精确查找任务。 */
export function findQuest(data, ref) {
  if (!data || !Array.isArray(data.quests)) return null
  const id = ref && typeof ref.id === 'string' ? ref.id.trim() : ''
  const title = ref && typeof ref.title === 'string' ? ref.title.trim() : ''
  if (id) return data.quests.find((q) => q.id === id) || null
  if (title) return data.quests.find((q) => q.title === title) || null
  return null
}

/** 新建任务并写入 data（自动补分类）；返回新任务。 */
export function newQuest(data, spec) {
  const now = Date.now()
  const objectives = Array.isArray(spec.objectives) ? spec.objectives.slice(0, OBJECTIVE_MAX).map((o) => makeObjective(o)).filter(Boolean) : []
  const quest = {
    id: uid(),
    title: String(spec.title || '未命名任务').slice(0, 200),
    level: clampInt(spec.level, 1, 5, 1),
    category: String(spec.category || (data.categories[0] || '')).slice(0, 32),
    status: STATUS_SET.indexOf(spec.status) >= 0 ? spec.status : 'tracked',
    description: String(spec.description || '').slice(0, TEXT_MAX),
    objectives: objectives,
    rewards: String(spec.rewards || '').slice(0, 500),
    order: data.quests.length,
    icon: String(spec.icon || '').slice(0, 1024 * 1024),
    dueAt: dueAtOf(spec.dueAt),
    recur: RECUR_SET.indexOf(spec.recur) >= 0 ? (spec.recur || '') : '',
    createdAt: now,
    updatedAt: now,
    completedAt: 0,
  }
  if (quest.category && data.categories.indexOf(quest.category) < 0) data.categories.push(quest.category)
  data.quests.push(quest)
  return quest
}
