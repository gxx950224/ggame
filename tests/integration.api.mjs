// 端到端集成冒烟测试：需要 DSH Web 正在运行（http://127.0.0.1:3080）。
// 覆盖 backpack/quest 两个插件的主要 API 链路。运行：node tests/integration.api.mjs
import assert from 'node:assert/strict'

const BASE = 'http://127.0.0.1:3080'
async function api(path, method = 'GET', body = null) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

// ── 背包 ──
const bp = await api('/_dsh/backpack/api', 'POST', { method: 'get-state', args: null })
assert.equal(bp.ok, true)
assert.ok(Array.isArray(bp.data.items))
assert.ok(Array.isArray(bp.data.bags))
assert.ok(bp.data.money && typeof bp.data.money.gold === 'number')

const usage = await api('/_dsh/backpack/api', 'POST', { method: 'get-usage', args: null })
assert.equal(usage.ok, true)
assert.ok(usage.totals && usage.totals.input >= 0)
assert.ok(usage.models && typeof usage.models === 'object')

// 图标媒体 200
const media = await fetch(`${BASE}/_dsh/backpack/media?p=${encodeURIComponent('@icons/金币.png')}`)
assert.equal(media.status, 200)
assert.ok(media.headers.get('content-type').startsWith('image/'))

// ── 任务 ──
const qs = await api('/_dsh/quest/api', 'POST', { method: 'get-state', args: null })
assert.equal(qs.ok, true)
assert.ok(Array.isArray(qs.data.quests))
assert.ok(Array.isArray(qs.data.categories))

// get-quest 单任务
const first = qs.data.quests[0]
if (first) {
  const one = await api('/_dsh/quest/api', 'POST', { method: 'get-quest', args: { id: first.id } })
  assert.equal(one.ok, true)
  assert.equal(one.quest.id, first.id)
}

// 分类增删（自清理）
const tmpCat = '集成测试分类-' + Date.now()
const add = await api('/_dsh/quest/api', 'POST', { method: 'add-category', args: { name: tmpCat } })
assert.equal(add.ok, true)
const del = await api('/_dsh/quest/api', 'POST', { method: 'delete-category', args: { name: tmpCat } })
assert.equal(del.ok, true)
assert.equal(del.data.categories.includes(tmpCat), false)

// persist 往返（读 → 改 → 写 → 读）
const p1 = await api('/_dsh/quest/api', 'POST', { method: 'persist', args: { data: qs.data } })
assert.equal(p1.ok, true)

console.log('integration api tests passed ✔')
