/**
 * @ggame/backpack —— 定价与货币核心（零依赖，可独立单元测试）。
 *
 * 约定：金币=元，银币=角，铜币=分（1 金 = 100 银 = 10000 铜）。
 * 定价：DeepSeek 官方动态定价（元/百万 tokens）：
 *   https://api-docs.deepseek.com/zh-cn/quick_start/pricing/
 */

/** 现行价（2026-08-17 前）：缓存命中输入 / 未命中输入 / 输出 */
export const PRICES = {
  'deepseek-v4-flash': { hit: 0.02, miss: 1, out: 2 },
  'deepseek-v4-pro': { hit: 0.025, miss: 3, out: 6 },
  // 旧版模型（legacy 价目，若再次出现按此计）
  'deepseek-chat': { hit: 0.5, miss: 2, out: 8 },
  'deepseek-reasoner': { hit: 0.5, miss: 2, out: 8 },
}

/** 未识别模型的保守默认：取 flash 现行价 */
export const DEFAULT_PRICE = { hit: 0.02, miss: 1, out: 2 }

/** 2026-08-17 00:00 北京时间起实行峰谷定价（高峰时段价格为闲时的 2 倍；闲时 = 高峰 × 0.5） */
export const PEAK_PRICES = {
  'deepseek-v4-flash': { hit: 0.1, miss: 3, out: 9 },
  'deepseek-v4-pro': { hit: 0.3, miss: 9, out: 27 },
  'deepseek-chat': { hit: 0.5, miss: 2, out: 8 },
  'deepseek-reasoner': { hit: 0.5, miss: 2, out: 8 },
}

export const PEAK_EFFECTIVE_MS = Date.UTC(2026, 7, 16, 16, 0, 0) // 2026-08-17 00:00 北京时间

/** 定价规则修订号：修改定价/规则后 +1，触发一次全量重建账本 */
export const PRICE_REV = 'v5-dayledger-20260815'

/**
 * 归一化货币（1 金 = 100 银 = 10000 铜），负值归零。
 * @param {any} m - { gold, silver, copper } 或任意可转数字的对象。
 * @returns {{gold: number, silver: number, copper: number}}
 */
export function moneyOf(m) {
  const g = Math.max(0, Math.floor(Number(m && m.gold) || 0))
  const s = Math.max(0, Math.floor(Number(m && m.silver) || 0))
  const c = Math.max(0, Math.floor(Number(m && m.copper) || 0))
  const total = g * 10000 + s * 100 + c
  return { gold: Math.floor(total / 10000), silver: Math.floor((total % 10000) / 100), copper: total % 100 }
}

/**
 * 按模型 + 请求时间取单价（元/百万 tokens）。
 * @param {string} model - 模型名。
 * @param {number} [ts] - 请求时间戳（ms）。8/17 前用现行平坦价；之后按北京时间高峰/闲时。
 * @param {{prices?: any, modelPrices?: any, peakPricing?: boolean}} cfg - 设置。
 * @returns {{hit: number, miss: number, out: number}}
 */
export function priceOf(model, ts, cfg) {
  const over = cfg && cfg.modelPrices && model && cfg.modelPrices[model]
  if (over) return { hit: over.hit, miss: over.miss, out: over.out }
  const flat = (model && PRICES[model]) || (cfg && cfg.prices) || DEFAULT_PRICE
  if (!cfg || !cfg.peakPricing || !ts || ts < PEAK_EFFECTIVE_MS) return { hit: flat.hit, miss: flat.miss, out: flat.out }
  // 高峰 9-12、14-18（北京时间），闲时 = 高峰 × 0.5
  const peak = (model && PEAK_PRICES[model]) || flat
  const d = new Date(ts + 8 * 3600 * 1000)
  const m = d.getUTCHours() * 60 + d.getUTCMinutes()
  const isPeak = (m >= 9 * 60 && m < 12 * 60) || (m >= 14 * 60 && m < 18 * 60)
  return isPeak ? { hit: peak.hit, miss: peak.miss, out: peak.out } : { hit: peak.hit / 2, miss: peak.miss / 2, out: peak.out / 2 }
}

/**
 * 由 TokenUsage 计算费用（铜币=分；1 元 = 10000 铜币 的约定）。
 * @param {{inputTokens?: number, cacheWriteTokens?: number, cacheReadTokens?: number, outputTokens?: number, reasoningTokens?: number}} u - TokenUsage。
 * @param {string} model - 模型名。
 * @param {number} [evTime] - 事件时间戳（ms）。
 * @param {{prices?: any, modelPrices?: any, peakPricing?: boolean}} cfg - 设置。
 * @returns {{miss: number, hit: number, out: number, costCu: number}}
 */
export function costOfUsage(u, model, evTime, cfg) {
  const miss = (u.inputTokens || 0) + (u.cacheWriteTokens || 0)
  const hit = u.cacheReadTokens || 0
  const out = (u.outputTokens || 0) + (u.reasoningTokens || 0)
  const p = priceOf(model, evTime, cfg)
  const costCu = Math.round(((miss * p.miss + hit * p.hit + out * p.out) / 1e6) * 10000)
  return { miss, hit, out, costCu }
}
