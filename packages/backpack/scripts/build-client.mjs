// 把 src/client.js（可读工厂体）包装为 __ModuleLoader__ bundle → lib/client.js
// 运行：node scripts/build-client.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const repo = new URL('../', import.meta.url)
// 剥离 src 顶部的文档注释块（仅供人读，不进入发布 bundle）
let body = readFileSync(new URL('src/client.js', repo), 'utf8')
body = body.replace(/^\/\*\*[\s\S]*?\*\/\s*\n?/, '')

const preamble = `window.__ModuleLoader__.load({
	id: "@ggame/backpack",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const React = require("react");
		/** 样式注入：与动态版 styles.insert 同 API。 */
		const styles = {
			insert(css) {
				const tag = document.createElement("style");
				tag.dataset.plugin = "@ggame/backpack";
				tag.dataset.pluginCss = "@ggame/backpack/client";
				tag.textContent = css;
				document.head.appendChild(tag);
				return () => { tag.remove(); };
			}
		};
		/** 原生定时器（常驻 bundle 拥有全部浏览器全局）。 */
		const defer = (fn, ms) => { const t = setTimeout(fn, ms); return () => clearTimeout(t) };
`

const tail = `
exports.apply = apply;
return module.exports;
	}
});
`

const out = preamble + body + tail
writeFileSync(new URL('lib/client.js', repo), out, 'utf8')
console.log('lib/client.js written,', out.length, 'chars')
