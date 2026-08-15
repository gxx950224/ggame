// 任务数据模型单元测试（零依赖，可独立运行：node tests/quest.test.mjs 或 pnpm test）
import assert from 'node:assert/strict'
import { seed, sanitize, findQuest, newQuest, makeObjective, objectiveDone, questDone, LEVEL_SET, STATUS_SET } from '../lib/model.js'

// ── seed / sanitize ──
const s = seed()
assert.equal(s.categories.length >= 3, true)
assert.ok(s.quests.length >= 2)
assert.ok(s.quests.every((q) => q.id && q.title && LEVEL_SET.includes(q.level)))

const clean = sanitize(s)
assert.equal(clean.quests.length, s.quests.length)
assert.equal(clean.quests[0].title, s.quests[0].title)

// 脏数据裁剪：非法状态回落 active、等级钳制、无 payload 目标被滤掉
const dirty = sanitize({
  categories: ['主线', '主线', '  '],
  quests: [
    { id: 'a', title: 'A', level: 99, status: 'weird', objectives: [{ text: 'x', target: 3, current: 2 }, null, {}] },
    { id: 'b', title: 'B' },
    { id: 'a', title: '重复id' },
  ],
})
assert.equal(dirty.quests.length, 2)
assert.equal(dirty.categories.length, 1)
assert.equal(dirty.quests[0].level, 5)
assert.equal(dirty.quests[0].status, 'active')
assert.equal(dirty.quests[0].objectives.length, 1)
assert.equal(dirty.quests[0].objectives[0].target, 3)
assert.equal(dirty.quests[0].objectives[0].current, 2)

// ── findQuest：id 优先，title 精确匹配 ──
const d = sanitize({ categories: ['主线'], quests: [{ id: 'q1', title: '任务甲' }] })
assert.equal(findQuest(d, { id: 'q1' }).title, '任务甲')
assert.equal(findQuest(d, { title: '任务甲' }).id, 'q1')
assert.equal(findQuest(d, { title: '不存在' }), null)
assert.equal(findQuest(d, {}), null)

// ── newQuest：默认 tracked、自动补分类 ──
const q = newQuest(d, { title: '新任务', level: 3, objectives: [{ text: '目标1', target: 5 }] })
assert.equal(q.status, 'tracked')
assert.equal(q.level, 3)
assert.equal(q.objectives.length, 1)
assert.equal(q.objectives[0].target, 5)
assert.equal(d.quests.length, 2)
assert.equal(d.categories.includes('主线'), true)

// 自定义分类自动加入 categories
const q2 = newQuest(d, { title: '支线任务', category: '支线', objectives: [] })
assert.equal(d.categories.includes('支线'), true)
assert.equal(q2.objectives.length, 0)

// ── 目标/任务完成判定 ──
const o1 = makeObjective({ text: 't', target: 3, current: 3 })
const o2 = makeObjective({ text: 't2', target: 1, current: 0 })
assert.equal(objectiveDone(o1), true)
assert.equal(objectiveDone(o2), false)
assert.equal(questDone({ objectives: [o1, o2] }), false)
assert.equal(questDone({ objectives: [o1, { ...o2, current: 1 }] }), true)
assert.equal(questDone({ objectives: [] }), false)

// ── 常量完整性 ──
assert.deepEqual(LEVEL_SET, [1, 2, 3, 4, 5])
assert.deepEqual(STATUS_SET, ['active', 'tracked', 'completed', 'abandoned'])

// ── 到期时间 ──
import { dueAtOf } from '../lib/model.js'
assert.equal(dueAtOf(0), 0)
assert.equal(dueAtOf(undefined), 0)
assert.equal(dueAtOf(''), 0)
assert.equal(dueAtOf(1786723329685), 1786723329685)
assert.equal(dueAtOf('2026-08-20T18:00:00+08:00'), Date.parse('2026-08-20T18:00:00+08:00'))
assert.equal(dueAtOf('乱写的'), 0)
const withDue = sanitize({ categories: [], quests: [{ id: 'd1', title: 'D', dueAt: '2026-08-20T18:00' }] })
assert.equal(withDue.quests[0].dueAt, Date.parse('2026-08-20T18:00'))
const noDue = sanitize({ categories: [], quests: [{ id: 'd2', title: 'E' }] })
assert.equal(noDue.quests[0].dueAt, 0)

// ── D2 重复任务 ──
import { applyRecur } from '../lib/model.js'
const daily = sanitize({ categories: [], quests: [{ id: 'r1', title: '每日打卡', recur: 'daily', dueAt: Date.now() + 3600000, objectives: [{ id: 'o1', text: '打卡', target: 1, current: 1 }], status: 'completed' }] }).quests[0]
assert.equal(applyRecur(daily), true)
assert.equal(daily.status, 'tracked')
assert.equal(daily.objectives[0].current, 0)
assert.equal(daily.completedAt, 0)
assert.ok(daily.dueAt > Date.now())
const plain = sanitize({ categories: [], quests: [{ id: 'r2', title: '普通', recur: '' }] }).quests[0]
assert.equal(applyRecur(plain), false)
assert.equal(plain.status, 'active')

console.log('quest model tests passed ✔')
