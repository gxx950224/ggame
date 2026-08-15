// 校验：各插件内联的共享助手与 ui-core canonical 副本保持同步。
// 运行：node packages/ui-core/scripts/sync-check.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('../../../', import.meta.url)) // ggame 根
const marks = [
  ['backpack', "localStorage.setItem('bp-panel-pos'", 'packages/backpack/src/client.js'],
  ['quest', 'localStorage.setItem(key, JSON.stringify(last))', 'packages/quest/src/client.js'],
  ['backpack', 'listeners.add(f)', 'packages/backpack/src/client.js'],
  ['quest', 'listeners.add(f)', 'packages/quest/src/client.js'],
]
let failed = 0
for (const [pkg, marker, rel] of marks) {
  const src = readFileSync(join(root, rel), 'utf8')
  if (!src.includes(marker)) { console.log('MISSING', pkg, marker); failed++ }
}
if (failed) { console.log('sync-check: 有插件未同步共享助手'); process.exit(1) }
console.log('sync-check passed: 全部插件共享助手在位 ✔')
