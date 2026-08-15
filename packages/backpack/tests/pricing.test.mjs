// 定价与货币核心单元测试（零依赖，可独立运行：node tests/pricing.test.mjs 或 pnpm test）
import assert from 'node:assert/strict'
import { PRICES, PEAK_PRICES, DEFAULT_PRICE, PEAK_EFFECTIVE_MS, PRICE_REV, moneyOf, priceOf, costOfUsage } from '../lib/pricing.js'

// ── 官方定价表（元/百万 tokens） ──
assert.deepEqual(PRICES['deepseek-v4-flash'], { hit: 0.02, miss: 1, out: 2 })
assert.deepEqual(PRICES['deepseek-v4-pro'], { hit: 0.025, miss: 3, out: 6 })
assert.deepEqual(PEAK_PRICES['deepseek-v4-flash'], { hit: 0.1, miss: 3, out: 9 })
assert.deepEqual(PEAK_PRICES['deepseek-v4-pro'], { hit: 0.3, miss: 9, out: 27 })
assert.equal(DEFAULT_PRICE.hit, 0.02)
assert.equal(typeof PEAK_EFFECTIVE_MS, 'number')
assert.ok(PRICE_REV.length > 0)

// ── 货币归一化（1 金 = 100 银 = 10000 铜，负值归零，进位） ──
assert.deepEqual(moneyOf({ gold: 1, silver: 27, copper: 8 }), { gold: 1, silver: 27, copper: 8 })
assert.deepEqual(moneyOf({ gold: 0, silver: 0, copper: 100 }), { gold: 0, silver: 1, copper: 0 }) // 100铜=1银
assert.deepEqual(moneyOf({ gold: 1, silver: 100, copper: 0 }), { gold: 2, silver: 0, copper: 0 }) // 100银=1金
assert.deepEqual(moneyOf({ gold: -5, silver: 0, copper: -3 }), { gold: 0, silver: 0, copper: 0 })
assert.deepEqual(moneyOf(undefined), { gold: 0, silver: 0, copper: 0 })
assert.deepEqual(moneyOf({ gold: 0.5, silver: 0.5, copper: 0.5 }), { gold: 0, silver: 0, copper: 0 }) // 全部向下取整

// ── 单价：8/17 前现行平坦价 ──
const cfg = { prices: { hit: 0.02, miss: 1, out: 2 }, modelPrices: {}, peakPricing: true }
const before = Date.UTC(2026, 7, 15, 6, 30) // 2026-08-15 14:30 北京时间
assert.deepEqual(priceOf('deepseek-v4-flash', before, cfg), { hit: 0.02, miss: 1, out: 2 })
assert.deepEqual(priceOf('deepseek-v4-pro', before, cfg), { hit: 0.025, miss: 3, out: 6 })

// ── 单价：8/17 起峰谷（高峰 9-12、14-18 北京时间；闲时 = 高峰 × 0.5） ──
const peak10 = Date.UTC(2026, 7, 17, 2, 0) // 2026-08-17 10:00 北京时间 → 高峰
const off22 = Date.UTC(2026, 7, 17, 14, 0) // 2026-08-17 22:00 北京时间 → 闲时
assert.deepEqual(priceOf('deepseek-v4-flash', peak10, cfg), { hit: 0.1, miss: 3, out: 9 })
assert.deepEqual(priceOf('deepseek-v4-flash', off22, cfg), { hit: 0.05, miss: 1.5, out: 4.5 })
assert.deepEqual(priceOf('deepseek-v4-pro', peak10, cfg), { hit: 0.3, miss: 9, out: 27 })
assert.deepEqual(priceOf('deepseek-v4-pro', off22, cfg), { hit: 0.15, miss: 4.5, out: 13.5 })

// ── 覆盖配置 ──
const over = { prices: { hit: 0.02, miss: 1, out: 2 }, modelPrices: { 'deepseek-v4-flash': { hit: 0.5, miss: 2, out: 8 } }, peakPricing: true }
assert.deepEqual(priceOf('deepseek-v4-flash', peak10, over), { hit: 0.5, miss: 2, out: 8 })

// ── peakPricing 关闭 ──
const flatCfg = { prices: { hit: 0.02, miss: 1, out: 2 }, modelPrices: {}, peakPricing: false }
assert.deepEqual(priceOf('deepseek-v4-flash', peak10, flatCfg), { hit: 0.02, miss: 1, out: 2 })

// ── 未知模型回落默认价 ──
assert.deepEqual(priceOf('some-unknown-model', before, cfg), { hit: 0.02, miss: 1, out: 2 })

// ── 费用计算：缓存写按未命中计、reasoning 计入输出，铜币=分 ──
const u = { inputTokens: 1000, cacheWriteTokens: 500, cacheReadTokens: 20000, outputTokens: 300, reasoningTokens: 200 }
const r = costOfUsage(u, 'deepseek-v4-flash', before, cfg)
assert.equal(r.miss, 1500)   // input + cacheWrite
assert.equal(r.hit, 20000)   // cacheRead
assert.equal(r.out, 500)     // output + reasoning
// (1500×1 + 20000×0.02 + 500×2) / 1e6 × 10000 = (1500 + 400 + 1000) / 1e6 × 10000 = 0.0029 × 10000 = 29 分
assert.equal(r.costCu, 29)

// 空 usage
const empty = costOfUsage({}, 'deepseek-v4-flash', before, cfg)
assert.deepEqual([empty.miss, empty.hit, empty.out, empty.costCu], [0, 0, 0, 0])

console.log('pricing tests passed ✔')
