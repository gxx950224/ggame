// 从 lib/client.js（__ModuleLoader__ bundle）解包出可读工厂体 → src/client.js
// 反向操作见 scripts/build-client.mjs；本脚本用于首次提取，此后以 src/client.js 为源码。
import { readFileSync, writeFileSync } from 'node:fs'

const repo = new URL('../', import.meta.url)
const raw = readFileSync(new URL('lib/client.js', repo), 'utf8')

const startMarker = 'const TYPES = {'
const endMarker = '\nexports.apply = apply;'
const si = raw.indexOf(startMarker)
const ei = raw.indexOf(endMarker)
if (si < 0 || ei < 0 || ei <= si) throw new Error('无法定位 bundle 工厂体边界')

const body = raw.slice(si, ei).replace(/\s+$/, '') + '\n'

const header = `/**
 * @ggame/backpack —— 浏览器端源码（可读工厂体）。
 *
 * 本文件不是独立可运行的模块：scripts/build-client.mjs 会把它包装成
 * __ModuleLoader__ bundle（lib/client.js）后在 DSH Web shell 中加载。
 * 包装器提供以下符号：
 *   - React  ：shell 平台种子模块（PLATFORM_MODULES 注入 require('react')）
 *   - styles ：<style data-plugin> 注入器，返回移除函数
 *   - defer  ：setTimeout 包装，返回 clearTimeout 清理函数
 * 包内其余代码只使用浏览器全局（fetch / window / document / FileReader…）。
 */

`
writeFileSync(new URL('src/client.js', repo), header + body, 'utf8')
console.log('src/client.js written,', (header + body).length, 'chars')
