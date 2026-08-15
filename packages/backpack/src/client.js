/**
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

const TYPES = {
  link: { label: '链接', icon: 'chain', rarity: 1, use: '打开链接' },
  prompt: { label: '提示词', icon: 'scroll', rarity: 2, use: '发送到对话' },
  note: { label: '笔记', icon: 'parchment', rarity: 1, use: '查看内容' },
  skill: { label: '技能', icon: 'book', rarity: 3, use: '发送到对话并触发技能' },
  file: { label: '文件', icon: 'file', rarity: 2, use: '预览 / 复制路径' },
  image: { label: '图片', icon: 'frame', rarity: 3, use: '预览大图' },
  plugin: { label: '插件', icon: 'rune', rarity: 4, use: '发送到对话控制插件' },
  command: { label: '命令', icon: 'hammer', rarity: 5, use: '发送到对话执行（危险）' },
  other: { label: '其他', icon: 'box', rarity: 1, use: '查看内容' },
}
const RARITIES = [
  { id: 0, label: '粗糙', color: '#9d9d9d' },
  { id: 1, label: '普通', color: '#ffffff' },
  { id: 2, label: '优秀', color: '#1eff00' },
  { id: 3, label: '精良', color: '#0070dd' },
  { id: 4, label: '史诗', color: '#a335ee' },
  { id: 5, label: '传说', color: '#ff8000' },
]
const TYPE_ORDER = ['link', 'note', 'file', 'prompt', 'skill', 'image', 'plugin', 'command', 'other']
const TYPE_ICONS = {
  link: '金色铁链.png',
  prompt: '魔法卷轴.png',
  note: '笔记.png',
  skill: '斧头技能.png',
  file: '蓝色矿石.png',
  image: '相框.png',
  plugin: '紫色符文石.png',
  command: '雷电技能.png',
  other: '金币.png',
}
const TYPE_ICON_DIR = '@icons'

exports.inject = ['slots'];
function apply(ctx) {
    const slotsSvc = ctx.slots

    const disposeCss = styles.insert(
      '.bp-root{pointer-events:none}' +
      '.bp-fab{pointer-events:auto;position:fixed;right:20px;bottom:20px;width:48px;height:48px;border-radius:12px;background:linear-gradient(160deg,#312b23,#1b1712);border:1px solid #4a4338;color:#c7b68c;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,.5);z-index:9060;transition:all .15s}' +
      '.bp-fab:hover{border-color:#6f6857;box-shadow:0 0 12px rgba(133,127,103,.3);transform:translateY(-2px)}' +
      '.bp-panel{pointer-events:auto;position:fixed;right:0;top:60px;z-index:9100;width:max(400px,30vw);height:min(80vh,calc(100vh - 80px));display:flex;flex-direction:column;background:linear-gradient(175deg,#2b2620,#15110d);border:1px solid #3b352c;border-radius:14px;box-shadow:0 14px 48px rgba(0,0,0,.7),inset 0 1px 0 rgba(133,127,103,.08);color:#d6d2c8;font-size:14px;user-select:none;overflow:hidden}' +
      '.bp-head{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #332d25;background:linear-gradient(180deg,rgba(133,127,103,.08),rgba(133,127,103,0))}' +
      '.bp-head .t{font-size:18px;font-weight:700;color:#c7b68c;letter-spacing:1px}' +
      '.bp-head .s{flex:1;font-size:13px;color:#a49c8c}' +
      '.bp-close{cursor:pointer;background:none;border:1px solid #443d31;color:#b9b4a8;border-radius:6px;width:32px;height:32px;line-height:1;font-size:18px}' +
      '.bp-close:hover{color:#e8e2d4;border-color:#6f6857}' +
      '.bp-toolbar{display:flex;flex-wrap:wrap;gap:6px;padding:10px 14px;border-bottom:1px solid #332d25;align-items:center}' +
      '.bp-input,.bp-select{background:#0f0c0a;border:1px solid #3b352c;color:#e0ddd4;border-radius:6px;padding:6px 10px;font-size:14px;outline:none}' +
      '.bp-input{flex:1;min-width:140px}' +
      '.bp-input:focus,.bp-select:focus{border-color:#6f6857}' +
      '.bp-select{max-width:190px}' +
      '.bp-btn{background:#221d16;border:1px solid #443d31;color:#d3cec2;border-radius:6px;padding:6px 12px;font-size:14px;cursor:pointer;white-space:nowrap}' +
      '.bp-btn:hover{border-color:#6f6857;color:#efe9da}' +
      '.bp-main{display:flex;flex:1;min-height:0;overflow:hidden}' +
      '.bp-side{width:clamp(140px,26%,240px);flex:none;border-right:1px solid #332d25;overflow-y:auto;padding:8px 0;background:rgba(0,0,0,.12)}' +
      '.bp-side-item{display:flex;align-items:center;gap:8px;padding:8px 16px;cursor:pointer;font-size:14px;color:#b9b4a8;white-space:nowrap}' +
      '.bp-side-item:hover{background:rgba(199,182,140,.08)}' +
      '.bp-side-item.active{background:rgba(199,182,140,.16);color:#e8e2d4;box-shadow:inset 3px 0 0 #c7b68c}' +
      '.bp-side-item .cnt{margin-left:auto;font-size:12px;color:#a49c8c}' +
      '.bp-side-item.active .cnt{color:#c7b68c}' +
      '.bp-side-sep{height:1px;background:#332d25;margin:7px 10px}' +
      '.bp-side-add{display:flex;align-items:center;gap:8px;padding:8px 16px;cursor:pointer;font-size:14px;color:#a49c8c}' +
      '.bp-side-add:hover{color:#c7b68c}' +
      '.bp-side-add input{background:#0f0c0a;border:1px solid #3b352c;color:#e0ddd4;border-radius:4px;font-size:13px;padding:4px 8px;width:100%;outline:none}' +
      '.bp-body{overflow-y:auto;overflow-x:hidden;padding:10px;flex:1}' +
      '.bp-grid{display:grid;gap:4px}' +
      '.bp-slot{position:relative;width:80px;height:80px;border:1px solid #37312a;border-radius:6px;background:linear-gradient(150deg,#29241e,#201b16);box-shadow:inset 0 1px 0 rgba(255,255,255,.04),inset 0 0 4px rgba(0,0,0,.5);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:border-color .1s}' +
      '.bp-slot:hover{border-color:#5a5345;box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 0 7px rgba(133,127,103,.25)}' +
      '.bp-slot.selected{border-color:#c7b68c;box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 0 0 1px #c7b68c,0 0 14px rgba(199,182,140,.55)}' +
      '.bp-selmark{position:absolute;right:-5px;bottom:-5px;background:#c7b68c;color:#0f0c0a;border-radius:6px;font-size:11px;padding:1px 5px;font-weight:700;z-index:3;box-shadow:0 0 6px rgba(199,182,140,.6)}' +
      '.bp-slot.dragover{border-color:#c7b68c;box-shadow:0 0 0 1px #c7b68c,0 0 12px rgba(199,182,140,.45)}' +
      '.bp-block-head.dragover{background:rgba(199,182,140,.18);border-color:#c7b68c}' +
      '.bp-slot.stale{opacity:.62}' +
      '.bp-slot-empty{border-style:dashed;color:#453e32;opacity:.55;font-size:26px}' +
      '.bp-slot-empty:hover{opacity:.85}' +
      '.bp-slot-name{position:absolute;bottom:2px;left:4px;right:4px;font-size:11px;line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#d8d4cc;text-shadow:0 1px 1px rgba(0,0,0,.85);pointer-events:none}' +
      '.bp-icon-wrap{display:flex;align-items:center;justify-content:center;border-radius:8px}' +
      '.bp-count{position:absolute;top:-4px;right:-4px;background:#0f0c0a;color:#d8b558;border:1px solid #4a4338;border-radius:8px;font-size:12px;padding:0 7px;font-weight:700;z-index:2}' +
      '.bp-fav{position:absolute;top:-4px;left:-4px;font-size:14px;z-index:2;color:#ffd98a}' +
      '.bp-group-head{grid-column:1/-1;display:flex;align-items:center;gap:8px;padding:10px 6px 5px;font-size:14px;color:#c7b68c;border-bottom:1px solid #332d25;margin:2px 0 6px}' +
      '.bp-group-head .gcnt{margin-left:auto;color:#a49c8c}' +
      '.bp-addrow{grid-column:1/-1;display:flex;align-items:center;justify-content:center;gap:8px;padding:14px;margin-top:8px;border:1px dashed #3b352c;border-radius:8px;color:#a49c8c;cursor:pointer;font-size:15px}' +
      '.bp-addrow:hover{color:#c7b68c;border-color:#6f6857}' +
      '.bp-block{margin-bottom:16px}' +
      '.bp-block-head{display:flex;align-items:center;gap:8px;padding:8px 12px;font-size:15px;color:#c7b68c;border:1px solid #332d25;border-bottom:none;border-radius:8px 8px 0 0;background:#221d16}' +
      '.bp-block-head .cap{margin-left:auto;font-size:12px;color:#a49c8c}' +
      '.bp-block .bp-grid{padding:8px;background:linear-gradient(175deg,#1f1a15,#17120e);border:1px solid #332d25;border-radius:0 0 8px 8px;justify-content:center}' +
      '.bp-status{display:flex;gap:18px;padding:9px 16px;border-top:1px solid #332d25;font-size:14px;color:#a49c8c;background:rgba(133,127,103,.05)}' +
      '.bp-status b{color:#c7b68c;font-weight:600}' +
      '.bp-tip{pointer-events:none;position:fixed;z-index:9600;width:290px;background:rgba(12,10,8,.96);border:1px solid #4a4338;border-radius:6px;padding:9px 11px;box-shadow:0 4px 18px rgba(0,0,0,.8);font-size:12px}' +
      '.bp-tip .name{font-size:14px;font-weight:700;margin-bottom:3px}' +
      '.bp-tip .sub{color:#9a9386;font-size:11px}' +
      '.bp-tip .stat{color:#b9b4a8;font-size:11px}' +
      '.bp-tip .use{color:#1eff00;font-size:12px;margin-top:4px}' +
      '.bp-tip .flavor{color:#c7b68c;font-style:italic;font-size:11px;margin-top:3px}' +
      '.bp-menu-backdrop{position:fixed;inset:0;z-index:9700;pointer-events:auto;background:transparent}' +
      '.bp-menu{position:fixed;z-index:9701;background:rgba(14,11,9,.97);border:1px solid #4a4338;border-radius:6px;padding:4px 0;box-shadow:0 6px 24px rgba(0,0,0,.8);min-width:190px;animation:bp-menu-in .12s ease}' +
      '@keyframes bp-menu-in{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}' +
      '.bp-menu-item{padding:6px 14px;cursor:pointer;font-size:12.5px;color:#d6d2c8;display:flex;align-items:center;gap:7px}' +
      '.bp-menu-item:hover{background:rgba(199,182,140,.14)}' +
      '.bp-menu-item.danger{color:#ff6b5e}' +
      '.bp-menu-sep{height:1px;background:#332d25;margin:4px 6px}' +
      '.bp-backdrop{position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;pointer-events:auto}' +
      '.bp-modal{background:linear-gradient(175deg,#2b2620,#15110d);border:1px solid #443d31;border-radius:10px;box-shadow:0 16px 48px rgba(0,0,0,.75);padding:22px;width:min(1000px,92vw);max-height:88vh;overflow:auto;color:#d6d2c8}' +
      '.bp-modal .mt{font-size:14px;font-weight:700;color:#c7b68c;margin-bottom:12px;display:flex;align-items:center;gap:8px}' +
      '.bp-modal .mt .x{margin-left:auto;cursor:pointer;color:#a49c8c;font-size:16px}' +
      '.bp-modal .mt .x:hover{color:#e8e2d4}' +
      '.bp-field{margin-bottom:10px}' +
      '.bp-field label{display:block;font-size:11px;color:#a49c8c;margin-bottom:3px}' +
      '.bp-field .in{width:100%;box-sizing:border-box}' +
      '.bp-ta{width:100%;box-sizing:border-box;min-height:160px;background:#0f0c0a;border:1px solid #3b352c;color:#e0ddd4;border-radius:6px;padding:9px 12px;font-size:14px;outline:none;resize:vertical;font-family:inherit}' +
      '.bp-ta:focus{border-color:#6f6857}' +
      '.bp-pre{background:#0f0c0a;border:1px solid #332d25;border-radius:6px;padding:10px;font-size:12px;white-space:pre-wrap;word-break:break-all;max-height:52vh;overflow:auto;color:#cfc7b4;font-family:ui-monospace,Consolas,monospace}' +
      '.bp-md{max-height:52vh;overflow:auto;padding:12px 14px;font-size:13px;line-height:1.7;color:#d6d2c8;background:#0f0c0a;border:1px solid #332d25;border-radius:6px;word-break:break-word}' +
      '.bp-md h1{font-size:20px;color:#c7b68c;border-bottom:1px solid #332d25;padding-bottom:6px;margin:12px 0 8px}' +
      '.bp-md h2{font-size:17px;color:#c7b68c;margin:14px 0 6px}' +
      '.bp-md h3,.bp-md h4{font-size:15px;color:#d8b558;margin:10px 0 4px}' +
      '.bp-md h5,.bp-md h6{font-size:13px;color:#d8b558;margin:8px 0 4px}' +
      '.bp-md p{margin:6px 0}' +
      '.bp-md code{background:#241d15;border:1px solid #332d25;border-radius:4px;padding:1px 5px;font-size:12px;font-family:ui-monospace,Consolas,monospace;color:#e8c87a}' +
      '.bp-md pre{background:#0a0806;border:1px solid #332d25;border-radius:6px;padding:10px;overflow:auto;font-size:12px}' +
      '.bp-md pre code{border:0;background:none;padding:0}' +
      '.bp-md a{color:#6ab0ff;text-decoration:underline;cursor:pointer}' +
      '.bp-md ul,.bp-md ol{margin:6px 0;padding-left:22px}' +
      '.bp-md li{margin:3px 0}' +
      '.bp-md blockquote{border-left:3px solid #c7b68c;margin:8px 0;padding:2px 12px;color:#a49c8c;background:#1a1510}' +
      '.bp-md hr{border:0;border-top:1px solid #332d25;margin:10px 0}' +
      '.bp-md strong{color:#e8e2d4}' +
      '.bp-md table{border-collapse:collapse;margin:8px 0}' +
      '.bp-md th,.bp-md td{border:1px solid #332d25;padding:4px 10px;font-size:12px}' +
      '.bp-md th{background:#241d15;color:#c7b68c}' +
      '.bp-md img{max-width:100%;border-radius:6px}' +
      '.bp-link-box{background:#0f0c0a;border:1px solid #332d25;border-radius:6px;padding:12px;word-break:break-all}' +
      '.bp-link-box a{color:#6ab0ff;font-size:14px;text-decoration:underline}' +
      '.bp-usage-card{position:absolute;bottom:calc(100% + 10px);right:0;width:300px;background:rgba(16,13,10,.98);border:1px solid #4a4338;border-radius:10px;box-shadow:0 10px 32px rgba(0,0,0,.75);padding:10px 12px;z-index:9800;font-size:11px;color:#d6d2c8;animation:bp-menu-in .12s ease}' +
      '.bp-usage-card .uc-head{font-size:12px;font-weight:700;color:#c7b68c;margin-bottom:6px;border-bottom:1px solid #332d25;padding-bottom:5px}' +
      '.bp-usage-card .uc-sec{font-size:10.5px;color:#a49c8c;margin:7px 0 3px}' +
      '.bp-usage-card .uc-line{display:flex;align-items:center;gap:6px;margin:2px 0}' +
      '.bp-usage-card .uc-date{width:34px;flex:none;color:#9a9386;text-align:right}' +
      '.bp-usage-card .uc-name{width:88px;flex:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#9a9386}' +
      '.bp-usage-card .uc-bar{flex:1;height:7px;background:#0f0c0a;border:1px solid #332d25;border-radius:3px;overflow:hidden;display:block}' +
      '.bp-usage-card .uc-bar i{display:block;height:100%;background:#c7b68c;border-radius:2px}' +
      '.bp-usage-card .uc-bar.blue i{background:#0070dd}' +
      '.bp-usage-card .uc-yuan{width:56px;flex:none;text-align:right;color:#d8b558}' +
      '.bp-modal .row{display:flex;gap:8px;align-items:center;margin-bottom:8px}' +
      '.bp-modal .row .grow{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px}' +
      '.bp-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:9800;background:rgba(12,10,8,.96);border:1px solid #6f6857;color:#d8b558;padding:8px 18px;border-radius:20px;font-size:12.5px;box-shadow:0 4px 16px rgba(0,0,0,.7);pointer-events:none;max-width:80vw}' +
      '.bp-toast[data-type=success]{color:#1eff00;border-color:#2f6b2f}' +
      '.bp-toast[data-type=error]{color:#ff6b5e;border-color:#7a3a34}' +
      '.bp-composer-btn{display:inline-flex;align-items:center;justify-content:center;background:none;border:1px solid rgba(199,182,140,.35);color:#c7b68c;border-radius:6px;width:26px;height:26px;cursor:pointer;padding:0}' +
      '.bp-composer-btn:hover{border-color:#c7b68c;color:#e8e2d4}' +
      '.bp-media{max-width:100%;max-height:56vh;border-radius:6px;display:block}' +
      '.bp-danger{color:#ff6b5e;font-size:11px;margin-top:6px}'
    )
    ctx.effect(() => disposeCss)

    let store = { open: false, data: null, activeBag: null, viewMode: 'unified', category: 'all', search: '', rarityFilter: 'all', sortMode: 'type', tooltip: null, menu: null, modal: null, toast: null, insert: null, collapsedBags: {}, money: null, usage: null, loading: true, dragOver: null, savedAt: 0, saveFailed: false, sel: [], usageOpen: false }
    let tipTimer = null
    const listeners = new Set()
    function patch(p) { store = Object.assign({}, store, p); listeners.forEach((f) => { try { f() } catch (e) {} }) }
    function getStore() { return store }
    function useStore() {
      const [s, setS] = React.useState(store)
      React.useEffect(() => {
        const f = () => setS(store)
        listeners.add(f)
        return () => { listeners.delete(f) }
      }, [])
      return s
    }
    const rpc = (method, args) => fetch('/_dsh/backpack/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method: method, args: args || null }), credentials: 'same-origin' }).then((r) => r.json()).catch((e) => ({ ok: false, error: String((e && e.message) || e) }))
    // 皮肤：把背景图应用到 DSH 网页，并覆盖 DSH 主题 CSS 变量为深色半透明，让背景图透出且文字保持可读
    const SKIN_VARS = ['--dsw-alias-bg-base', '--dsw-alias-bg-layer-1', '--dsw-alias-bg-layer-2', '--dsw-alias-bg-overlay', '--dsw-alias-label-primary', '--dsw-alias-label-secondary', '--dsw-alias-border-l1', '--dsw-alias-border-l2', '--dsw-specific-sidebar-fill']
    const SKIN_VALUES = {
      '--dsw-alias-bg-base': 'rgba(10, 8, 6, 0.72)',
      '--dsw-alias-bg-layer-1': 'rgba(16, 12, 9, 0.86)',
      '--dsw-alias-bg-layer-2': 'rgba(20, 16, 11, 0.92)',
      '--dsw-alias-bg-overlay': 'rgba(12, 9, 7, 0.97)',
      '--dsw-alias-label-primary': '#ece6d8',
      '--dsw-alias-label-secondary': '#b9b0a0',
      '--dsw-alias-border-l1': 'rgba(133,127,103,.28)',
      '--dsw-alias-border-l2': 'rgba(133,127,103,.42)',
      '--dsw-specific-sidebar-fill': 'rgba(12, 10, 8, 0.6)',
    }
    let skinPrev = null
    function skinCover() {
      // 把覆盖视口 ≥85% 的不透明背景容器改为半透明深色，透出皮肤图（小卡片/输入框保留自身背景）
      try {
        const vw = window.innerWidth, vh = window.innerHeight
        const queue = [document.body]
        let seen = 0
        for (let i = 0; i < queue.length && seen < 500; i++) {
          const el = queue[i]
          for (const c of el.children) {
            if (!c || typeof c.getBoundingClientRect !== 'function') continue
            seen++
            if (c.children && c.children.length) queue.push(c)
            const r = c.getBoundingClientRect()
            if (r.width >= vw * 0.85 && r.height >= vh * 0.85) {
              const s = getComputedStyle(c)
              if (s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent') {
                c.setAttribute('data-ggame-skin', '1')
                c.style.setProperty('background-color', 'rgba(10, 8, 6, 0.72)', 'important')
              }
            }
          }
        }
      } catch (e) { /* ignore */ }
    }
    function skinRestore() {
      try {
        document.querySelectorAll('[data-ggame-skin]').forEach((el) => {
          try { el.style.removeProperty('background-color') } catch (e) { /* ignore */ }
          el.removeAttribute('data-ggame-skin')
        })
        if (skinPrev) {
          SKIN_VARS.forEach((v) => { try { document.documentElement.style.setProperty(v, skinPrev[v] || '') } catch (e) { /* ignore */ } })
          skinPrev = null
        }
        document.body.style.background = ''
      } catch (e) { /* ignore */ }
    }
    function applySkin() {
      try {
        rpc('get-config').then((res) => {
          try {
            const root = document && document.documentElement
            const bg = res && res.ok ? String((res.config && res.config.backgroundImage) || '').trim() : ''
            if (!bg || !document || !document.body || !root) { skinRestore(); return }
            const src = /^https?:\/\//i.test(bg) ? bg : '/_dsh/backpack/media?p=' + enc(bg)
            document.body.style.background = 'rgba(8,6,4,.72) url("' + src + '") no-repeat center/cover fixed'
            document.body.style.backgroundSize = 'cover'
            document.body.style.backgroundAttachment = 'fixed'
            // 覆盖 DSH 主题变量：深色半透明 + 亮字（记录原值便于还原）
            if (!skinPrev) {
              skinPrev = {}
              SKIN_VARS.forEach((v) => { try { skinPrev[v] = root.style.getPropertyValue(v) } catch (e) { skinPrev[v] = '' } })
            }
            SKIN_VARS.forEach((v) => { try { root.style.setProperty(v, SKIN_VALUES[v]) } catch (e) { /* ignore */ } })
            // 覆盖全屏不透明容器（DSH 浅色框架）
            skinCover()
          } catch (e) { /* ignore */ }
        })
      } catch (e) { /* ignore */ }
    }
    applySkin()
    function toast(text, type) { patch({ toast: { text: text, type: type || 'info', seq: Date.now() } }) }
    const enc = (s) => (typeof encodeURIComponent === 'function') ? encodeURIComponent(s) : String(s)
    const clamp = (v, lo, hi) => { const n = Math.floor(Number(v)); return isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo }
    function isPath(p) { return /^(?:[A-Za-z]:[\\/]|~[\\/]|[\\/]|\.{1,2}[\\/])/.test(String(p)) }
    function iconSrc(item) {
      const ic = String((item && item.icon) || '')
      if (!ic) return ''
      if (ic.indexOf('data:') === 0) return ic
      return '/_dsh/backpack/media?p=' + enc(ic)
    }
    function fmtTime(t) {
      if (!t) return '-'
      const d = new Date(t)
      if (isNaN(d.getTime())) return '-'
      const pad2 = (n) => (n < 10 ? '0' : '') + n
      return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
    }

    async function loadData() {
      const res = await rpc('get-state')
      if (res && res.ok && res.data) patch({ data: res.data, money: res.data.money || { gold: 0, silver: 0, copper: 0 }, loading: false })
      else patch({ loading: false, toast: { text: '背包加载失败: ' + ((res && res.error) || ''), seq: Date.now() } })
      rpc('get-usage').then((ur) => { if (ur && ur.session) patch({ usage: { session: ur.session, log: ur.log || [], models: ur.models || {}, totals: ur.totals || {}, days: ur.days || [] } }) })
    }
    function commit(nextData, toastText) {
      patch({ data: nextData })
      rpc('persist', { data: nextData }).then((res) => {
        if (!res || !res.ok) { patch({ saveFailed: true }); toast('保存失败: ' + ((res && res.error) || ''), 'error'); loadData() }
        else {
          // F2 保存指示
          patch({ savedAt: Date.now(), saveFailed: false })
          if (toastText) toast(toastText, 'success')
          rpc('get-money').then((mr) => { if (mr && mr.money) patch({ money: mr.money }) })
          rpc('get-usage').then((ur) => { if (ur && ur.session) patch({ usage: { session: ur.session, log: ur.log || [], models: ur.models || {}, totals: ur.totals || {}, days: ur.days || [] } }) })
        }
      })
    }
    function findItem(id) { const d = store.data; return d ? (d.items.find((i) => i.id === id) || null) : null }
    function upsertItem(item) { const d = store.data; if (!d) return; commit(Object.assign({}, d, { items: d.items.map((i) => (i.id === item.id ? item : i)) })) }
    function removeItem(id) { const d = store.data; if (!d) return; commit(Object.assign({}, d, { items: d.items.filter((i) => i.id !== id) }), '物品已摧毁') }
    function toggleFav(id) { const d = store.data; if (!d) return; const it = d.items.find((i) => i.id === id); if (!it) return; upsertItem(Object.assign({}, it, { fav: it.fav ? 0 : 1 })) }
    function toggleCollapse(bagId) {
      const m = Object.assign({}, getStore().collapsedBags || {})
      m[bagId] = m[bagId] ? 0 : 1
      patch({ collapsedBags: m })
    }
    function addPage(bagId) {
      const d = store.data
      if (!d) return
      const bag = d.bags.find((b) => b.id === bagId)
      if (!bag) return
      const next = Math.min(36, bag.rows + 4)
      if (next === bag.rows) { toast('已达到最大页数'); return }
      commit(Object.assign({}, d, { bags: d.bags.map((b) => (b.id === bagId ? Object.assign({}, b, { rows: next }) : b)) }), '已加 1 页（24 格）')
    }
    function subPage(bagId) {
      const d = store.data
      if (!d) return
      const bag = d.bags.find((b) => b.id === bagId)
      if (!bag) return
      const next = Math.max(4, bag.rows - 4)
      if (next === bag.rows) { toast('已是第 1 页'); return }
      const newCap = bag.cols * next
      let moved = 0
      const items = d.items.map((it) => {
        if (it.bagId === bagId && it.slot >= 0 && it.slot >= newCap) { moved += 1; return Object.assign({}, it, { bagId: 'bag-vault', slot: -1 }) }
        return it
      })
      commit(Object.assign({}, d, { bags: d.bags.map((b) => (b.id === bagId ? Object.assign({}, b, { rows: next }) : b)), items: items }), moved ? ('已减 1 页，' + moved + ' 件物品移入虚空仓库') : '已减 1 页')
    }

    function addItems(specs, bagId) {
      const d = store.data
      if (!d) return
      const items = d.items.slice()
      const now = Date.now()
      const targetBag = d.bags.find((b) => b.id === bagId) || d.bags.find((b) => !b.vault) || d.bags[0]
      const cap = targetBag ? targetBag.cols * targetBag.rows : 0
      const used = new Set()
      items.forEach((it) => { if (it.bagId === targetBag.id && it.slot >= 0) used.add(it.slot) })
      const messages = []
      specs.forEach((spec) => {
        if (!spec || !spec.payload) return
        const type = TYPES[spec.type] ? spec.type : 'note'
        const name = String(spec.name || '未命名').slice(0, 200)
        const payload = String(spec.payload)
        const dup = items.find((it) => it.type === type && it.name === name && it.payload === payload && it.count < 999)
        if (dup) { dup.count += 1; dup.lastUsed = now; messages.push(name + ' ×' + dup.count); return }
        let free = -1
        for (let i = 0; i < cap; i++) if (!used.has(i)) { free = i; break }
        items.push({
          id: 'it-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
          bagId: free >= 0 ? targetBag.id : 'bag-vault',
          slot: free,
          type: type,
          name: name,
          rarity: clamp(spec.rarity, 0, 5),
          payload: payload,
          flavor: String(spec.flavor || '').slice(0, 300),
          icon: String(spec.icon || ''),
          tag: String(spec.tag || '').slice(0, 32),
          fav: spec.fav ? 1 : 0,
          count: 1,
          createdAt: now,
          lastUsed: 0,
          useCount: 0,
          extra: spec.extra || {},
        })
        if (free >= 0) used.add(free)
        messages.push(name)
      })
      commit(Object.assign({}, d, { items: items }), messages.length ? '已拾取: ' + messages.join('、') : null)
    }

    function moveItem(id, bagId, slot) {
      const d = store.data
      if (!d) return
      const me = d.items.find((i) => i.id === id)
      if (!me) return
      const oldBag = me.bagId
      const oldSlot = me.slot
      const other = d.items.find((i) => i.id !== id && i.bagId === bagId && i.slot === slot) || null
      const items = d.items.map((i) => {
        if (i.id === id) return Object.assign({}, i, { bagId: bagId, slot: slot })
        if (other && i.id === other.id) return Object.assign({}, i, { bagId: oldBag, slot: oldSlot })
        return i
      })
      commit(Object.assign({}, d, { items: items }))
    }

    function moveToBag(id, bagId) {
      const d = store.data
      if (!d) return
      const bag = d.bags.find((b) => b.id === bagId)
      if (!bag) return
      const cap = bag.cols * bag.rows
      const used = new Set()
      d.items.forEach((it) => { if (it.bagId === bagId && it.slot >= 0) used.add(it.slot) })
      let free = -1
      for (let i = 0; i < cap; i++) if (!used.has(i)) { free = i; break }
      if (free < 0) { toast('目标袋已满，请先整理'); return }
      moveItem(id, bagId, free)
    }

    function tidy() {
      const d = store.data
      if (!d) return
      const items = d.items.slice()
      const normal = d.bags.slice().sort((a, b) => a.order - b.order).filter((b) => !b.vault)
      // 1) 各袋内按 品质→类型→名称 排序，溢出进虚空仓库
      normal.forEach((bag) => {
        const inBag = items.filter((it) => it.bagId === bag.id && it.slot >= 0)
          .sort((a, b) => (b.rarity - a.rarity) || (TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)) || (a.name < b.name ? -1 : 1))
        const cap = bag.cols * bag.rows
        inBag.slice(0, cap).forEach((it, idx) => { it.slot = idx })
        inBag.slice(cap).forEach((it) => { it.bagId = 'bag-vault'; it.slot = -1 })
      })
      // 2) 虚空仓库物品按类别拉回：同类袋子优先 → 主背包 → 任一有空位的袋子
      const used = {}
      normal.forEach((bag) => { used[bag.id] = new Set(items.filter((it) => it.bagId === bag.id && it.slot >= 0).map((it) => it.slot)) })
      const freeSlot = (bag) => { const cap = bag.cols * bag.rows; const u = used[bag.id]; for (let i = 0; i < cap; i++) if (!u.has(i)) return i; return -1 }
      const vaultItems = items.filter((it) => it.bagId === 'bag-vault').sort((a, b) => (b.rarity - a.rarity) || (a.name < b.name ? -1 : 1))
      vaultItems.forEach((it) => {
        const typeIn = (bag) => items.some((x) => x.id !== it.id && x.bagId === bag.id && x.slot >= 0 && x.type === it.type)
        let target = normal.find((bag) => typeIn(bag) && freeSlot(bag) >= 0)
        if (!target) target = normal.find((bag) => bag.id === 'bag-main' && freeSlot(bag) >= 0)
        if (!target) target = normal.find((bag) => freeSlot(bag) >= 0)
        if (target) { const s = freeSlot(target); it.bagId = target.id; it.slot = s; used[target.id].add(s) }
      })
      commit(Object.assign({}, d, { items: items }), '背包已整理')
    }

    function sendToComposer(text) {
      clearTip()
      patch({ insert: { seq: Date.now(), text: text }, open: false, menu: null })
      toast('已放入输入框，按 Enter 发送')
    }

    function copyText(text) {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(() => toast('已复制到剪贴板'), () => toast('复制失败'))
          return
        }
      } catch (e) { /* fallthrough */ }
      toast('当前环境不支持剪贴板')
    }

    function copyItem(item) {
      if (!item) return
      const p = String(item.payload || '')
      if (item.type === 'plugin') { copyText('@' + p.replace(/^@/, '')); return }
      copyText(p)
    }

    function useItem(item) {
      if (!item) return
      const bumped = Object.assign({}, item, { lastUsed: Date.now(), useCount: (item.useCount || 0) + 1 })
      upsertItem(bumped)
      const p = String(item.payload || '')
      switch (item.type) {
        case 'link':
          if (typeof window !== 'undefined' && window.open) window.open(p, '_blank', 'noopener')
          else toast(p)
          break
        case 'prompt': case 'note': case 'command':
          sendToComposer(p)
          break
        case 'skill':
          sendToComposer('请加载并使用技能：' + p)
          break
        case 'plugin':
          sendToComposer('@' + p.replace(/^@/, '') + ' 请帮我查看并激活这个插件')
          break
        case 'file': case 'image':
          patch({ modal: { kind: 'preview', itemId: item.id } })
          break
        default:
          toast('该物品没有默认动作，试试右键菜单')
      }
    }

    function Icon(kind, color, size) {
      const s = size || 18
      const sp = { fill: 'none', stroke: color || '#cbb98f', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }
      const kids = []
      const addP = (d) => kids.push(React.createElement('path', Object.assign({ key: kids.length, d: d }, sp)))
      const addC = (cx, cy, r) => kids.push(React.createElement('circle', Object.assign({ key: kids.length, cx: cx, cy: cy, r: r }, sp)))
      switch (kind) {
        case 'bag': addP('M4 7h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z'); addP('M8 7a4 4 0 0 1 8 0'); break
        case 'chain': addC(7, 12, 3.4); addC(17, 12, 3.4); addP('M10.4 12h3.2'); break
        case 'scroll': addP('M6 4h9a2 2 0 0 1 2 2v13a1.5 1.5 0 0 1-1.5 1.5H8a2.5 2.5 0 0 0 2.5 2.5H17a1.5 1.5 0 0 0 1.5-1.5V7'); addP('M9 9h5'); addP('M9 13h5'); break
        case 'parchment': addP('M5 4h14v16H5Z'); addP('M8 9h8'); addP('M8 13h8'); addP('M8 17h5'); break
        case 'book': addP('M4 5a2 2 0 0 1 2-2h13v17H6a2 2 0 0 0-2 2V5Z'); addP('M19 3v17'); addP('M8 8h7'); addP('M8 12h7'); break
        case 'file': addP('M6 3h8l5 5v13H6Z'); addP('M14 3v5h5'); addP('M9 12h6'); addP('M9 16h6'); break
        case 'frame': addP('M4 5h16v14H4Z'); addP('M8 15l3-4 2 3 2-2 2 3'); addC(9, 9, 1.3); break
        case 'film': addP('M4 4h16v16H4Z'); addP('M8 4v16'); addP('M16 4v16'); addP('M4 9h4'); addP('M4 15h4'); addP('M16 9h4'); addP('M16 15h4'); break
        case 'gear': addC(12, 12, 3); addP('M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1'); addC(12, 12, 6.2); break
        case 'rune': addP('M12 3 21 12 12 21 3 12Z'); addP('M12 8l4 4-4 4-4-4Z'); break
        case 'hammer': addP('M13.5 3.5l7 7-6 6-7-7Z'); addP('M10.5 10.5l-6.5 6.5'); addP('M5 20h14'); break
        case 'chest': addP('M3 8h18v11H3Z'); addP('M3 8a9 9 0 0 1 18 0'); addP('M12 12v5'); addC(12, 13.5, 0.9); break
        case 'loot': addP('M12 3l2.2 5 5 2.2-5 2.2L12 17.5l-2.2-5.1-5-2.2 5-2.2Z'); break
        case 'plus': addP('M12 5v14M5 12h14'); break
        case 'trash': addP('M5 6h14M9 6V4h6v2M6 6l1 14h10l1-14'); break
        case 'search': addC(10.5, 10.5, 5.5); addP('M15 15l5 5'); break
        case 'sort': addP('M7 4v16M4 7l3-3 3 3'); addP('M17 20V4m3 3-3-3-3 3'); break
        case 'close': addP('M6 6l12 12M18 6L6 18'); break
        case 'edit': addP('M4 20l1-4L16 5l3 3-11 11Z'); addP('M14.5 6.5l3 3'); break
        case 'vault': addP('M4 4h16v16H4Z'); addC(12, 12, 4); addP('M12 9.5v5M9.5 12h5'); break
        case 'arrow': addP('M5 12h14M13 6l6 6-6 6'); break
        case 'open': addP('M14 5h5v5M19 5l-8 8'); addP('M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5'); break
        case 'pin': addP('M9 4h6v3l-1.5 2v5l1.5 2v3H9v-3l1.5-2V9L9 7V4Z'); addC(12, 6.5, 0.9); break
        case 'box': addP('M3 9l9-5 9 5v6l-9 5-9-5V9Z'); addP('M3 9l9 5 9-5'); addP('M12 14v6'); break
        default: addP('M4 4h16v16H4Z'); break
      }
      return React.createElement('svg', { width: s, height: s, viewBox: '0 0 24 24' }, kids)
    }

    function renderIcon(item, imgSize, svgSize) {
      const r = RARITIES[item.rarity] || RARITIES[1]
      const meta = TYPES[item.type] || TYPES.note
      let ic = iconSrc(item)
      if (!ic && TYPE_ICONS[item.type]) ic = '/_dsh/backpack/media?p=' + enc(TYPE_ICON_DIR + '/' + TYPE_ICONS[item.type])
      const halo = item.rarity >= 3 ? r.color : null
      const iconEl = ic
        ? React.createElement('img', { src: ic, alt: '', style: { width: imgSize, height: imgSize, objectFit: 'contain', pointerEvents: 'none' } })
        : Icon(meta.icon, r.color, svgSize)
      return React.createElement('span', { className: 'bp-icon-wrap', style: halo ? { boxShadow: '0 0 6px ' + halo + '99, 0 0 2px ' + halo } : null }, iconEl)
    }

    function clearTip() {
      if (tipTimer) { try { tipTimer() } catch (e) {} tipTimer = null }
      if (getStore().tooltip) patch({ tooltip: null })
    }

    function ItemCell(props) {
      const item = props.item
      const stale = item.lastUsed && (Date.now() - item.lastUsed) > 7 * 86400000
      const st = getStore()
      const draggingOver = st.dragOver === (props.bagId + ':' + props.slot)
      const dropHandlers = props.noDrop ? {} : {
        // F5 拖拽放置预览：悬停目标格高亮
        onDragOver: (e) => { e.preventDefault(); try { e.dataTransfer.dropEffect = 'move' } catch (err) {}; patch({ dragOver: props.bagId + ':' + props.slot }) },
        onDragLeave: () => { if (getStore().dragOver === (props.bagId + ':' + props.slot)) patch({ dragOver: null }) },
        onDrop: (e) => { e.preventDefault(); patch({ dragOver: null }); const id = e.dataTransfer.getData('text/plain'); if (id) moveItem(id, props.bagId, props.slot) },
      }
      return React.createElement('div', Object.assign({
        className: 'bp-slot' + (stale ? ' stale' : '') + (st.activeItem === item.id ? ' selected' : '') + (draggingOver ? ' dragover' : ''),
        draggable: true,
        onDragStart: (e) => { try { e.dataTransfer.setData('text/plain', item.id); e.dataTransfer.effectAllowed = 'move' } catch (err) {} },
        onClick: (e) => {
          // F13：Shift+点击 多选
          if (e && e.shiftKey) {
            const sel = getStore().sel || []
            const idx = sel.indexOf(item.id)
            patch({ sel: idx >= 0 ? sel.filter((x) => x !== item.id) : sel.concat([item.id]) })
            return
          }
          patch({ activeItem: item.id })
        },
        onDoubleClick: () => { clearTip(); useItem(item) },
        onContextMenu: (e) => { e.preventDefault(); clearTip(); patch({ menu: { itemId: item.id, x: e.clientX, y: e.clientY } }) },
        onMouseEnter: (e) => {
          clearTip()
          tipTimer = defer(() => patch({ tooltip: { itemId: item.id, x: e.clientX, y: e.clientY } }), 260)
        },
        onMouseLeave: () => { clearTip() },
      }, dropHandlers),
        renderIcon(item, 56, 44),
        React.createElement('div', { className: 'bp-slot-name' }, item.name),
        item.count > 1 ? React.createElement('div', { className: 'bp-count' }, String(item.count)) : null,
        item.fav ? React.createElement('div', { className: 'bp-fav' }, '★') : null,
        st.activeItem === item.id ? React.createElement('div', { className: 'bp-selmark' }, '✓') : null,
      )
    }

    function EmptyCell(props) {
      return React.createElement('div', {
        className: 'bp-slot bp-slot-empty' + (getStore().dragOver === (props.bagId + ':' + props.slot) ? ' dragover' : ''),
        title: '添加物品',
        onClick: () => patch({ modal: { kind: 'add', bagId: props.bagId } }),
        onDragOver: (e) => { e.preventDefault(); try { e.dataTransfer.dropEffect = 'move' } catch (err) {}; patch({ dragOver: props.bagId + ':' + props.slot }) },
        onDragLeave: () => { if (getStore().dragOver === (props.bagId + ':' + props.slot)) patch({ dragOver: null }) },
        onDrop: (e) => { e.preventDefault(); patch({ dragOver: null }); const id = e.dataTransfer.getData('text/plain'); if (id) moveItem(id, props.bagId, props.slot) } },
        '＋')
    }

    function filteredItems(d, s) {
      let list = d.items
      const cat = s.category
      if (cat === 'fav') list = list.filter((i) => i.fav)
      else if (cat === 'recent') list = list.filter((i) => i.lastUsed && (Date.now() - i.lastUsed) < 7 * 86400000)
      else if (cat === 'vault') list = list.filter((i) => i.bagId === 'bag-vault')
      else if (cat && cat.indexOf('type:') === 0) list = list.filter((i) => i.type === cat.slice(5))
      else if (cat && cat.indexOf('tag:') === 0) list = list.filter((i) => i.tag === cat.slice(4))
      if (s.search) {
        const q = s.search.toLowerCase()
        list = list.filter((it) => it.name.toLowerCase().indexOf(q) >= 0 || String(it.payload || '').toLowerCase().indexOf(q) >= 0 || ((TYPES[it.type] || {}).label || '').toLowerCase().indexOf(q) >= 0)
      }
      if (s.rarityFilter !== 'all') list = list.filter((it) => it.rarity === Number(s.rarityFilter))
      const cmp = (a, b) => {
        if (s.sortMode === 'rarity') return (b.rarity - a.rarity) || (TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)) || (a.name < b.name ? -1 : 1)
        if (s.sortMode === 'name') return a.name < b.name ? -1 : 1
        if (s.sortMode === 'used') return (b.useCount || 0) - (a.useCount || 0)
        if (s.sortMode === 'custom') return (a.createdAt - b.createdAt)
        return (TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)) || (b.rarity - a.rarity) || (a.name < b.name ? -1 : 1)
      }
      return list.slice().sort(cmp)
    }

    function handleFileDrop(e) {
      if (typeof FileReader === 'undefined') { toast('当前环境不支持文件读取'); return }
      const files = e.dataTransfer && e.dataTransfer.files
      if (!files || !files.length) return
      const list = []
      for (let i = 0; i < files.length && i < 8; i++) list.push(files[i])
      list.forEach((file) => {
        const name = String(file.name || '未命名')
        const size = file.size || 0
        const ft = String(file.type || '')
        if (ft.indexOf('image/') === 0 && size <= 1.5 * 1024 * 1024) {
          const r = new FileReader()
          r.onload = () => addItems([{ type: 'image', name: name, payload: String(r.result || ''), icon: String(r.result || ''), rarity: 3, extra: { size: size } }], getStore().activeBag)
          r.onerror = () => toast('读取文件失败')
          r.readAsDataURL(file)
          return
        }
        const textExt = /\.(txt|md|markdown|json|js|mjs|cjs|ts|tsx|jsx|yml|yaml|toml|csv|html|htm|css|xml|log|ini|conf|sh|py|java|go|rs|c|cpp|h|sql|vue|svelte)$/i.test(name)
        if (textExt && size <= 256 * 1024) {
          const r = new FileReader()
          r.onload = () => addItems([{ type: 'file', name: name, payload: String(r.result || ''), rarity: 2, extra: { size: size, inline: true } }], getStore().activeBag)
          r.onerror = () => toast('读取文件失败')
          r.readAsText(file)
          return
        }
        toast('「' + name + '」不适合直接拖入，建议在添加物品时粘贴文件路径')
      })
    }

    function TooltipView(props) {
      const t = props.s.tooltip
      const item = findItem(t.itemId)
      if (!item) return null
      const meta = TYPES[item.type] || TYPES.note
      const r = RARITIES[item.rarity] || RARITIES[1]
      const w = typeof window !== 'undefined' ? window.innerWidth : 1200
      const h = typeof window !== 'undefined' ? window.innerHeight : 800
      const x = Math.max(4, Math.min(t.x + 14, w - 310))
      const y = Math.max(4, Math.min(t.y + 14, h - 240))
      return React.createElement('div', { className: 'bp-tip', style: { left: x, top: y } },
        React.createElement('div', { className: 'name', style: { color: r.color } }, item.name),
        React.createElement('div', { className: 'sub' }, '物品类型：' + (meta.label || item.type)),
        React.createElement('div', { className: 'sub' }, '品质：' + r.label + (item.count > 1 ? '　×' + item.count : '') + (item.tag ? '　分类：' + item.tag : '')),
        React.createElement('div', { className: 'stat' }, '使用次数：' + (item.useCount || 0) + '　添加于 ' + fmtTime(item.createdAt)),
        item.lastUsed ? React.createElement('div', { className: 'stat' }, '最近使用：' + fmtTime(item.lastUsed)) : null,
        React.createElement('div', { className: 'use' }, '使用：' + (meta.use || '查看')),
        item.flavor ? React.createElement('div', { className: 'flavor' }, '“' + item.flavor + '”') : null,
        item.type === 'command' ? React.createElement('div', { className: 'bp-danger' }, '危险物品：执行前请确认命令内容') : null,
        item.extra && item.extra.missing ? React.createElement('div', { className: 'bp-danger' }, '引用的文件当前不存在') : null,
      )
    }

    function MenuView(props) {
      const s = props.s
      const m = s.menu
      const item = findItem(m.itemId)
      if (!item) return null
      const close = () => patch({ menu: null })
      const rows = []
      rows.push({ label: '查看', icon: 'open', fn: () => { close(); patch({ modal: { kind: 'preview', itemId: item.id } }) } })
      rows.push({ label: '发送到对话', icon: 'scroll', fn: () => { close(); sendToComposer(String(item.payload || '')) } })
      rows.push({ label: '复制', icon: 'file', fn: () => { close(); copyItem(item) } })
      // F16 本地路径物品：打开文件所在位置（Windows 资源管理器选中）
      if (isPath(String(item.payload || ''))) {
        rows.push({ label: '打开文件所在位置', icon: 'gear', fn: () => { close(); rpc('open-file-location', { path: String(item.payload || '') }).then((res) => { if (!res || !res.ok) toast(((res && res.error) || '打开失败'), 'error') }) } })
      }
      rows.push({ label: item.fav ? '取消固定' : '固定物品', icon: 'pin', fn: () => { close(); toggleFav(item.id) } })
      rows.push({ label: '编辑', icon: 'edit', fn: () => { close(); patch({ modal: { kind: 'edit', itemId: item.id } }) } })
      rows.push('sep')
      const bags = (s.data ? s.data.bags : []).filter((b) => !b.vault && b.id !== item.bagId)
      bags.forEach((b) => rows.push({ label: '移动到 ' + b.name, icon: 'bag', fn: () => { close(); moveToBag(item.id, b.id) } }))
      rows.push({ label: '移入虚空仓库', icon: 'vault', fn: () => { close(); moveItem(item.id, 'bag-vault', -1) } })
      rows.push('sep')
      rows.push({ label: '摧毁', icon: 'trash', danger: true, fn: () => { close(); patch({ modal: { kind: 'destroy', itemId: item.id } }) } })
      const w = typeof window !== 'undefined' ? window.innerWidth : 1200
      const h = typeof window !== 'undefined' ? window.innerHeight : 800
      return React.createElement('div', { className: 'bp-menu-backdrop', onMouseDown: close, onContextMenu: (e) => { e.preventDefault(); close() } },
        React.createElement('div', {
          className: 'bp-menu',
          style: { left: Math.max(4, Math.min(m.x, w - 220)), top: Math.max(4, Math.min(m.y, h - rows.length * 30 - 20)) },
          onMouseDown: (e) => e.stopPropagation(),
        },
          rows.map((r, i) => r === 'sep'
            ? React.createElement('div', { key: i, className: 'bp-menu-sep' })
            : React.createElement('div', { key: i, className: 'bp-menu-item' + (r.danger ? ' danger' : ''), onClick: r.fn }, Icon(r.icon, r.danger ? '#ff6b5e' : '#c7b68c', 13), r.label))),
      )
    }

    function ModalShell(props) {
      return React.createElement('div', { className: 'bp-backdrop', onMouseDown: (e) => { if (e.target === e.currentTarget) props.onClose() } },
        React.createElement('div', { className: 'bp-modal' },
          React.createElement('div', { className: 'mt' }, props.title, React.createElement('span', { className: 'x', onClick: props.onClose }, '✕')),
          props.children,
        ),
      )
    }

    function AddWizard(props) {
      const bagId0 = props.bagId || getStore().activeBag
      const d0 = getStore().data
      const [bagId, setBagId] = React.useState(bagId0)
      const [text, setText] = React.useState('')
      const [spec, setSpec] = React.useState(null)
      const [name, setName] = React.useState('')
      const [type, setType] = React.useState('note')
      const [rarity, setRarity] = React.useState(1)
      const [flavor, setFlavor] = React.useState('')
      const [icon, setIcon] = React.useState('')
      const [lib, setLib] = React.useState(null)
      const [skills, setSkills] = React.useState([])
      const [detecting, setDetecting] = React.useState(false)
      const fileRef = React.useRef(null)
      // F16 选择本地文件：名字默认文件名；文本读内容、图片存 data URL，都先填入面板由用户确认后放入
      const [selFile, setSelFile] = React.useState(null)
      const pickFile = () => { const el = fileRef.current; if (el) el.click() }
      const onFile = (e) => {
        const f = e.target && e.target.files && e.target.files[0]
        e.target.value = ''
        if (!f) return
        const nm = String(f.name || '未命名')
        const isText = /\.(txt|md|markdown|json|js|mjs|cjs|ts|tsx|jsx|yml|yaml|toml|csv|html?|htm|css|xml|log|ini|conf|sh|py|java|go|rs|c|cpp|h|sql|vue|svelte)$/i.test(nm) || (typeof f.type === 'string' && f.type.indexOf('text/') === 0)
        if (isText && f.size <= 512 * 1024) {
          const r = new FileReader()
          r.onload = () => { setSelFile(null); setName(nm); setText(String(r.result || '')) }
          r.onerror = () => toast('读取文件失败')
          r.readAsText(f)
          toast('已读取「' + nm + '」，确认后放入背包')
        } else if (typeof f.type === 'string' && f.type.indexOf('image/') === 0 && f.size <= 1.5 * 1024 * 1024) {
          const r = new FileReader()
          r.onload = () => {
            const d = String(r.result || '')
            setSelFile({ name: nm, type: 'image', payload: d, icon: d, rarity: 3, extra: { size: f.size } })
            setName(nm)
            setType('image')
            setText('')
            toast('已选择图片「' + nm + '」，确认后放入背包')
          }
          r.onerror = () => toast('读取文件失败')
          r.readAsDataURL(f)
        } else {
          toast('该文件类型不适合直接读取，请复制真实路径粘贴（物品将支持「打开文件所在位置」）')
        }
      }
      React.useEffect(() => {
        rpc('list-skills').then((r) => { if (r && Array.isArray(r.skills) && r.skills.length) setSkills(r.skills) })
        rpc('list-icons').then((res) => { setLib(res && Array.isArray(res.icons) ? res.icons : []) })
      }, [])
      React.useEffect(() => {
        if (!text.trim()) { setSpec(null); return }
        setDetecting(true)
        const t = defer(() => {
          rpc('detect', { text: text.trim() }).then((res) => {
            setDetecting(false)
            if (res && !res.error) {
              setSpec(res)
              setName(res.name || '')
              setType(res.type || 'note')
              setRarity(typeof res.rarity === 'number' ? res.rarity : 1)
            } else setSpec(null)
          })
        }, 350)
        return t
      }, [text])
      const close = () => patch({ modal: null })
      const add = () => {
        if (selFile) {
          addItems([{ type: selFile.type, name: name || selFile.name, payload: selFile.payload, rarity: rarity, flavor: flavor, icon: selFile.icon || icon.trim(), extra: Object.assign({}, selFile.extra || {}) }], bagId)
          close()
          return
        }
        const v = text.trim()
        if (!v) return
        addItems([{ type: type, name: name || v.slice(0, 20), payload: v, rarity: rarity, flavor: flavor, icon: icon.trim(), extra: (spec && spec.extra) || {} }], bagId)
        close()
      }
      const typeKeys = Object.keys(TYPES).concat(d0 ? d0.tags : [])
      const typeOptions = typeKeys.map((k) => React.createElement('option', { key: k, value: k }, TYPES[k] ? TYPES[k].label : k))
      const rarityOptions = RARITIES.map((r) => React.createElement('option', { key: r.id, value: String(r.id) }, r.label))
      return React.createElement(ModalShell, { title: '添加物品', onClose: close },
        React.createElement('div', { className: 'bp-field' },
          React.createElement('label', null, '粘贴内容，自动识别类型'),
          React.createElement('textarea', { className: 'bp-ta', value: text, placeholder: 'https://…  或  C:\\path\\to\\file  或 一段提示词…', onChange: (e) => setText(e.target.value) }),
        ),
        React.createElement('div', { className: 'row', style: { marginBottom: 8 } },
          React.createElement('button', { className: 'bp-btn', onClick: pickFile }, '📁 选择本地文件'),
          React.createElement('input', { ref: fileRef, type: 'file', style: { display: 'none' }, onChange: onFile }),
        ),
        selFile ? React.createElement('div', { className: 'bp-field' },
          React.createElement('label', null, '已选择本地文件（确认后放入背包，可修改名称/品质）'),
          React.createElement('div', { className: 'row' },
            React.createElement('img', { src: selFile.payload, alt: '', style: { width: 40, height: 40, borderRadius: 4, border: '1px solid #443d31', background: '#0f0c0a', objectFit: 'contain' } }),
            React.createElement('span', { className: 'grow', style: { fontSize: 12, color: '#a49c8c' } }, selFile.name + '（' + ((TYPES[selFile.type] || {}).label || selFile.type) + '）'),
            React.createElement('button', { className: 'bp-btn', onClick: () => setSelFile(null) }, '移除'),
          ),
        ) : null,
        detecting ? React.createElement('div', { style: { fontSize: 11, color: '#a49c8c', marginBottom: 8 } }, '识别中…')
          : (spec ? React.createElement('div', { style: { fontSize: 11, color: '#1eff00', marginBottom: 8 } }, '已识别为：' + (TYPES[spec.type] || {}).label) : null),
        React.createElement('div', { className: 'row' },
          React.createElement('select', { className: 'bp-select', value: bagId || '', onChange: (e) => setBagId(e.target.value) },
            (d0 ? d0.bags.slice().sort((a, b) => a.order - b.order) : []).map((b) => React.createElement('option', { key: b.id, value: b.id }, b.name))),
          React.createElement('span', { style: { flex: 1 } }),
          React.createElement('span', { style: { fontSize: 12, color: '#a49c8c' } }, '放入目标袋子'),
        ),
        React.createElement('div', { className: 'bp-field' }, React.createElement('label', null, '名称'), React.createElement('input', { className: 'bp-input in', value: name, onChange: (e) => setName(e.target.value) })),
        React.createElement('div', { className: 'row' },
          React.createElement('select', { className: 'bp-select', value: type, onChange: (e) => setType(e.target.value) }, typeOptions),
          React.createElement('select', { className: 'bp-select', value: String(rarity), onChange: (e) => setRarity(Number(e.target.value)) }, rarityOptions),
        ),
        type === 'skill' && skills.length ? React.createElement('div', { className: 'bp-field' },
          React.createElement('label', null, '现有技能（点击填入）'),
          React.createElement('div', null, skills.slice(0, 30).map((sk) => React.createElement('span', { key: sk, className: 'bp-btn', style: { margin: '0 4px 4px 0', display: 'inline-block' }, onClick: () => { setName(sk); setText(sk) } }, sk))),
        ) : null,
        React.createElement('div', { className: 'bp-field' }, React.createElement('label', null, '风味文字（黄字，可留空）'), React.createElement('input', { className: 'bp-input in', value: flavor, onChange: (e) => setFlavor(e.target.value) })),
        React.createElement('div', { className: 'bp-field' }, React.createElement('label', null, '图标（可选：本地图片路径或 data: 图片，留空则用类型默认图标）'), React.createElement('input', { className: 'bp-input in', value: icon, placeholder: '如 C:\\icons\\sword.png 或 data:image/png;base64,…', onChange: (e) => setIcon(e.target.value) })),
        lib ? React.createElement('div', { className: 'bp-field' },
          React.createElement('label', null, '图标库（点击填入，不选则用类型默认）'),
          React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 4 } },
            lib.map((ic) => React.createElement('img', { key: ic.name, src: '/_dsh/backpack/media?p=' + enc(ic.path), width: 48, height: 48, style: { border: '1px solid #443d31', borderRadius: 4, cursor: 'pointer', background: '#0f0c0a' }, title: ic.name, onClick: () => setIcon(ic.path) })))) : null,
        React.createElement('div', { className: 'row', style: { justifyContent: 'flex-end' } },
          React.createElement('button', { className: 'bp-btn', onClick: close }, '取消'),
          React.createElement('button', { className: 'bp-btn', style: { borderColor: '#6f6857', color: '#c7b68c' }, onClick: add }, '放入背包'),
        ),
      )
    }

    function EditModal(props) {
      const st = useStore()
      const d = st.data
      const item = findItem(props.itemId)
      const [name, setName] = React.useState(item ? item.name : '')
      const [rarity, setRarity] = React.useState(item ? item.rarity : 1)
      const [flavor, setFlavor] = React.useState(item ? item.flavor : '')
      const [payload, setPayload] = React.useState(item ? item.payload : '')
      const [icon, setIcon] = React.useState(item ? (item.icon || '') : '')
      const [type, setType] = React.useState(item ? item.type : 'note')
      const [lib, setLib] = React.useState(null)
      React.useEffect(() => {
        rpc('list-icons').then((res) => { setLib(res && Array.isArray(res.icons) ? res.icons : []) })
      }, [])
      if (!item) return null
      const close = () => patch({ modal: null })
      const save = () => {
        upsertItem(Object.assign({}, item, { name: name || item.name, rarity: clamp(rarity, 0, 5), flavor: flavor, payload: payload, icon: icon.trim(), type: type }))
        close()
      }
      return React.createElement(ModalShell, { title: '编辑物品', onClose: close },
        React.createElement('div', { className: 'bp-field' }, React.createElement('label', null, '名称'), React.createElement('input', { className: 'bp-input in', value: name, onChange: (e) => setName(e.target.value) })),
        React.createElement('div', { className: 'row' },
          React.createElement('select', { className: 'bp-select', value: String(rarity), onChange: (e) => setRarity(Number(e.target.value)) }, RARITIES.map((r) => React.createElement('option', { key: r.id, value: String(r.id) }, r.label))),
          React.createElement('select', { className: 'bp-select', value: type, onChange: (e) => setType(e.target.value) },
            Object.keys(TYPES).map((k) => React.createElement('option', { key: k, value: k }, TYPES[k].label)),
            (d ? d.tags : []).map((t) => React.createElement('option', { key: t, value: t }, t))),
          React.createElement('span', { style: { fontSize: 11, color: '#a49c8c' } }, '物品类型'),
        ),
        React.createElement('div', { className: 'bp-field' }, React.createElement('label', null, '内容 / 负载'), React.createElement('textarea', { className: 'bp-ta', value: payload, onChange: (e) => setPayload(e.target.value) })),
        React.createElement('div', { className: 'bp-field' }, React.createElement('label', null, '风味文字'), React.createElement('input', { className: 'bp-input in', value: flavor, onChange: (e) => setFlavor(e.target.value) })),
        React.createElement('div', { className: 'bp-field' }, React.createElement('label', null, '图标（本地图片路径或 data: 图片）'), React.createElement('input', { className: 'bp-input in', value: icon, placeholder: '留空则用类型默认图标', onChange: (e) => setIcon(e.target.value) })),
        lib ? React.createElement('div', { className: 'bp-field' },
          React.createElement('label', null, '图标库（点击填入）'),
          React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 4 } },
            lib.map((ic) => React.createElement('img', { key: ic.name, src: '/_dsh/backpack/media?p=' + enc(ic.path), width: 40, height: 40, style: { border: '1px solid #443d31', borderRadius: 4, cursor: 'pointer', background: '#0f0c0a' }, title: ic.name, onClick: () => setIcon(ic.path) })))) : null,
        React.createElement('div', { className: 'row', style: { justifyContent: 'flex-end' } },
          React.createElement('button', { className: 'bp-btn', onClick: close }, '取消'),
          React.createElement('button', { className: 'bp-btn', style: { borderColor: '#6f6857', color: '#c7b68c' }, onClick: save }, '保存'),
        ),
      )
    }

    // ── 极简 Markdown 渲染（客户端零依赖）──
    function mdInline(text) {
      const out = []
      const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)\s]+\))/g
      let last = 0, m, k = 0
      while ((m = re.exec(text))) {
        if (m.index > last) out.push(text.slice(last, m.index))
        if (m[1]) out.push(React.createElement('code', { key: 'c' + k }, m[1].slice(1, -1)))
        else if (m[2]) out.push(React.createElement('strong', { key: 'b' + k }, m[2].slice(2, -2)))
        else if (m[3]) out.push(React.createElement('em', { key: 'i' + k }, m[3].slice(1, -1)))
        else if (m[4]) {
          const mm = m[4].match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)
          if (mm) out.push(React.createElement('a', { key: 'a' + k, href: mm[2], target: '_blank', rel: 'noopener' }, mm[1]))
          else out.push(m[4])
        }
        k++; last = re.lastIndex
      }
      if (last < text.length) out.push(text.slice(last))
      return out
    }
    function mdToEl(md) {
      const lines = String(md || '').replace(/\r\n/g, '\n').split('\n')
      const out = []
      let i = 0, k = 0
      const push = (el) => { out.push(React.cloneElement(el, { key: k++ })) }
      while (i < lines.length) {
        const line = lines[i]
        const fence = line.match(/^```([\w-]*)\s*$/)
        if (fence) {
          const buf = []
          i++
          while (i < lines.length && !/^```\s*$/.test(lines[i])) { buf.push(lines[i]); i++ }
          i++
          push(React.createElement('pre', null, React.createElement('code', null, buf.join('\n'))))
          continue
        }
        const t = line.trim()
        if (!t) { i++; continue }
        const h = t.match(/^(#{1,6})\s+(.*)$/)
        if (h) { push(React.createElement(h[1].length <= 2 ? 'h' + h[1].length : 'h3', null, mdInline(h[2]))); i++; continue }
        if (/^([-*_])\1{2,}\s*$/.test(t)) { push(React.createElement('hr', null)); i++; continue }
        if (t.indexOf('>') === 0) {
          const buf = []
          while (i < lines.length && lines[i].trim().indexOf('>') === 0) { buf.push(lines[i].trim().slice(1).trim()); i++ }
          push(React.createElement('blockquote', null, mdInline(buf.join(' '))))
          continue
        }
        if (/^[-*+]\s+/.test(t)) {
          const items = []
          while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { items.push(React.createElement('li', { key: items.length }, mdInline(lines[i].replace(/^\s*[-*+]\s+/, '')))); i++ }
          push(React.createElement('ul', null, items))
          continue
        }
        if (/^\d+\.\s+/.test(t)) {
          const items = []
          while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(React.createElement('li', { key: items.length }, mdInline(lines[i].replace(/^\s*\d+\.\s+/, '')))); i++ }
          push(React.createElement('ol', null, items))
          continue
        }
        if (/^\|.*\|$/.test(t) && i + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[i + 1].trim())) {
          const head = t.slice(1, -1).split('|').map((c) => c.trim())
          const rows = []
          i += 2
          while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
            const cells = lines[i].trim().slice(1, -1).split('|').map((c) => React.createElement('td', { key: 'td' + rows.length }, mdInline(c.trim())))
            rows.push(React.createElement('tr', { key: rows.length }, cells))
            i++
          }
          push(React.createElement('table', null,
            React.createElement('thead', null, React.createElement('tr', null, head.map((c, ci) => React.createElement('th', { key: ci }, mdInline(c))))),
            React.createElement('tbody', null, rows)))
          continue
        }
        const buf = [t]
        i++
        while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|>|[-*+]\s|\d+\.\s)/.test(lines[i].trim()) && !/^([-*_])\1{2,}\s*$/.test(lines[i].trim())) { buf.push(lines[i].trim()); i++ }
        push(React.createElement('p', null, mdInline(buf.join(' '))))
      }
      return out
    }
    // 详情页渲染类型：html（内嵌 iframe 沙箱） / md（Markdown 渲染） / link（链接卡片） / text（纯文本）
    function previewKind(item, text) {
      const name = String(item.name || '')
      if (/\.(html?|xhtml)$/i.test(name) || /^\s*<(?:!doctype\s+html|html|head|body)\b/i.test(String(text || ''))) return 'html'
      if (/\.(md|markdown)$/i.test(name) || /^\s*(#{1,6}\s|```|>|[-*+]\s|\d+\.\s)/m.test(String(text || '')) || /^\s*\|\s*[^|]+\s*\|/m.test(String(text || ''))) return 'md'
      if (item.type === 'link') return 'link'
      return 'text'
    }

    function PreviewModal(props) {
      const item = findItem(props.itemId)
      const [content, setContent] = React.useState(null)
      const [err, setErr] = React.useState(null)
      React.useEffect(() => {
        setContent(null)
        setErr(null)
        if (!item) return
        const p = String(item.payload || '')
        if (isPath(p)) {
          rpc('read-text', { path: p, maxBytes: 128 * 1024 }).then((res) => {
            if (res && res.ok) setContent(res.text || '')
            else setErr((res && res.error) || '读取失败')
          })
        } else setContent(p)
      }, [item && item.id])
      if (!item) return null
      const close = () => patch({ modal: null })
      const p = String(item.payload || '')
      let body = null
      if (item.type === 'image') {
        const src = p.indexOf('data:') === 0 ? p : '/_dsh/backpack/media?p=' + enc(p)
        body = React.createElement('img', { className: 'bp-media', src: src, onError: () => setErr('图片加载失败') })
      } else if (isPath(p) && err) {
        body = React.createElement('div', null,
          React.createElement('div', { className: 'bp-pre' }, p),
          React.createElement('div', { className: 'bp-danger' }, err),
          React.createElement('div', { className: 'row', style: { marginTop: 10 } },
            React.createElement('button', { className: 'bp-btn', onClick: () => copyText(p) }, '复制路径'),
            React.createElement('button', { className: 'bp-btn', onClick: () => sendToComposer('请帮我查看这个文件：' + p) }, '发送到对话'),
          ),
        )
      } else {
        const text = content === null ? (isPath(p) ? '' : p) : content
        const kind = previewKind(item, text)
        if (kind === 'html') {
          body = React.createElement('div', null,
            text === '' ? React.createElement('div', { className: 'bp-pre' }, '加载中…')
              : React.createElement('iframe', { title: item.name, sandbox: '', style: { width: '100%', height: '52vh', border: 0, borderRadius: 6, background: '#fff', display: 'block' }, srcDoc: text }),
            React.createElement('div', { className: 'row', style: { marginTop: 10 } },
              React.createElement('button', { className: 'bp-btn', onClick: () => copyText(text) }, '复制源码'),
              React.createElement('button', { className: 'bp-btn', onClick: () => sendToComposer('这是物品「' + item.name + '」的 HTML 内容：\n```html\n' + text.slice(0, 6000) + '\n```') }, '发送到对话'),
            ),
          )
        } else if (kind === 'md') {
          body = React.createElement('div', null,
            React.createElement('div', { className: 'bp-md' }, text === '' ? React.createElement('p', null, '加载中…') : mdToEl(text)),
            React.createElement('div', { className: 'row', style: { marginTop: 10 } },
              React.createElement('button', { className: 'bp-btn', onClick: () => copyText(text) }, '复制内容'),
              React.createElement('button', { className: 'bp-btn', onClick: () => sendToComposer(String(text || '')) }, '发送到对话'),
            ),
          )
        } else if (kind === 'link') {
          body = React.createElement('div', null,
            React.createElement('div', { className: 'bp-link-box' },
              React.createElement('a', { href: p, target: '_blank', rel: 'noopener' }, p),
            ),
            React.createElement('div', { className: 'row', style: { marginTop: 10 } },
              React.createElement('button', { className: 'bp-btn', style: { borderColor: '#6f6857', color: '#c7b68c' }, onClick: () => { try { if (window.open) window.open(p, '_blank', 'noopener') } catch (e) { toast('无法打开链接') } } }, '打开链接'),
              React.createElement('button', { className: 'bp-btn', onClick: () => copyText(p) }, '复制链接'),
              React.createElement('button', { className: 'bp-btn', onClick: () => sendToComposer(p) }, '发送到对话'),
            ),
          )
        } else {
          body = React.createElement('div', null,
            React.createElement('pre', { className: 'bp-pre' }, content === null ? '加载中…' : (content || '')),
            React.createElement('div', { className: 'row', style: { marginTop: 10 } },
              React.createElement('button', { className: 'bp-btn', onClick: () => copyText(content === null ? p : content) }, '复制内容'),
              React.createElement('button', { className: 'bp-btn', onClick: () => sendToComposer(String(content === null ? p : content || '')) }, '发送到对话'),
            ),
          )
        }
      }
      return React.createElement(ModalShell, { title: (TYPES[item.type] || {}).label + '：' + item.name, onClose: close }, body)
    }

    function DestroyModal(props) {
      const item = findItem(props.itemId)
      if (!item) return null
      const close = () => patch({ modal: null })
      const r = RARITIES[item.rarity] || RARITIES[1]
      return React.createElement(ModalShell, { title: '摧毁物品', onClose: close },
        React.createElement('div', { style: { marginBottom: 10 } },
          React.createElement('span', { style: { color: r.color, fontWeight: 700 } }, item.name),
          React.createElement('span', { style: { color: '#a49c8c', marginLeft: 8 } }, (TYPES[item.type] || {}).label),
        ),
        React.createElement('div', { className: 'bp-danger' }, '确定要摧毁这件物品吗？此操作不可恢复。'),
        React.createElement('div', { className: 'row', style: { justifyContent: 'flex-end', marginTop: 14 } },
          React.createElement('button', { className: 'bp-btn', onClick: close }, '取消'),
          React.createElement('button', { className: 'bp-btn', style: { borderColor: '#ff6b5e', color: '#ff6b5e' }, onClick: () => { removeItem(item.id); close() } }, '确定摧毁'),
        ),
      )
    }

    function BagsModal(props) {
      const s = useStore()
      const d = s.data
      const [name, setName] = React.useState('')
      if (!d) return null
      const close = () => patch({ modal: null })
      const create = () => {
        const n = (name || '行囊').slice(0, 64)
        const bag = { id: 'bag-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: n, cols: 6, rows: 4, order: d.bags.length }
        commit(Object.assign({}, d, { bags: d.bags.concat([bag]) }), '新袋已缝制: ' + n)
        patch({ activeBag: bag.id })
        setName('')
      }
      const remove = (id) => {
        const bag = d.bags.find((b) => b.id === id)
        if (!bag || bag.vault || bag.fixed) return
        const items = d.items.map((it) => (it.bagId === id ? Object.assign({}, it, { bagId: 'bag-vault', slot: -1 }) : it))
        commit(Object.assign({}, d, { bags: d.bags.filter((b) => b.id !== id), items: items }), '袋子已销毁，物品移入虚空仓库')
      }
      const rename = (id, nv) => {
        const n = String(nv).slice(0, 64) || '袋子'
        commit(Object.assign({}, d, { bags: d.bags.map((b) => (b.id === id ? Object.assign({}, b, { name: n }) : b)) }))
      }
      return React.createElement(ModalShell, { title: '袋子管理', onClose: close },
        React.createElement('div', { className: 'row' },
          React.createElement('input', { className: 'bp-input grow', placeholder: '新袋子名称（6 列 × 4 行）', value: name, onChange: (e) => setName(e.target.value) }),
          React.createElement('button', { className: 'bp-btn', style: { borderColor: '#6f6857', color: '#c7b68c' }, onClick: create }, '缝制'),
        ),
        d.bags.slice().sort((a, b) => (b.vault ? 1 : 0) - (a.vault ? 1 : 0) || a.order - b.order).map((b) => React.createElement('div', { key: b.id, className: 'row' },
          Icon(b.vault ? 'vault' : 'bag', '#c7b68c', 14),
          b.vault ? React.createElement('span', { className: 'grow' }, b.name + '（不可删除，无限容量）')
            : React.createElement('input', { className: 'bp-input grow', defaultValue: b.name, onBlur: (e) => rename(b.id, e.target.value) }),
          React.createElement('span', { style: { fontSize: 10, color: '#a49c8c', whiteSpace: 'nowrap' } }, b.vault ? '∞' : ('6×' + b.rows + '（' + (b.rows / 4) + ' 页）')),
          b.vault ? null : React.createElement('button', { className: 'bp-btn', style: { borderColor: '#6f6857', color: '#c7b68c' }, onClick: () => addPage(b.id) }, '加1页'),
          b.vault ? null : React.createElement('button', { className: 'bp-btn', style: { borderColor: '#6f6857', color: '#c7b68c' }, onClick: () => subPage(b.id) }, '减1页'),
          b.vault || b.fixed ? null : React.createElement('button', { className: 'bp-btn', style: { borderColor: '#ff6b5e', color: '#ff6b5e' }, onClick: () => remove(b.id) }, '销毁'),
        )),
      )
    }

    function Sidebar(props) {
      const s = props.s
      const d = s.data
      const [adding, setAdding] = React.useState(false)
      const [tagName, setTagName] = React.useState('')
      if (!d) return React.createElement('div', { className: 'bp-side' })
      const total = d.items.length
      const favCount = d.items.filter((i) => i.fav).length
      const recentCount = d.items.filter((i) => i.lastUsed && (Date.now() - i.lastUsed) < 7 * 86400000).length
      const vaultCount = d.items.filter((i) => i.bagId === 'bag-vault').length
      const typeCounts = {}
      const tagCounts = {}
      d.items.forEach((i) => { typeCounts[i.type] = (typeCounts[i.type] || 0) + 1; if (i.tag) tagCounts[i.tag] = (tagCounts[i.tag] || 0) + 1 })
      const rows = []
      rows.push({ id: 'all', label: '所有物品', icon: 'search', count: total })
      rows.push({ id: 'bags', label: '多背包', icon: 'bag', count: total })
      rows.push({ id: 'fav', label: '固定物品', icon: 'pin', count: favCount })
      rows.push({ id: 'recent', label: '最近物品', icon: 'loot', count: recentCount })
      rows.push({ id: 'vault', label: '虚空仓库', icon: 'vault', count: vaultCount })
      rows.push('sep')
      TYPE_ORDER.forEach((t) => rows.push({ id: 'type:' + t, label: (TYPES[t] || {}).label, icon: (TYPES[t] || {}).icon, count: typeCounts[t] || 0 }))
      d.tags.forEach((t) => rows.push({ id: 'type:' + t, label: t, icon: 'box', count: typeCounts[t] || 0, custom: true }))
      const select = (id) => {
        if (id === 'bags') patch({ viewMode: 'bags', category: 'bags', search: '' })
        else patch({ viewMode: 'unified', category: id })
      }
      const addTag = () => {
        const n = tagName.trim().slice(0, 32)
        if (!n) return
        if (Object.keys(TYPES).indexOf(n) >= 0) { toast('「' + n + '」是内置类型，不能重复添加'); return }
        if (d.tags.indexOf(n) >= 0) { setAdding(false); setTagName(''); select('type:' + n); return }
        commit(Object.assign({}, d, { tags: d.tags.concat([n]) }))
        setAdding(false)
        setTagName('')
        select('type:' + n)
      }
      return React.createElement('div', { className: 'bp-side' },
        rows.map((r, i) => r === 'sep'
          ? React.createElement('div', { key: 's' + i, className: 'bp-side-sep' })
          : React.createElement('div', { key: r.id, className: 'bp-side-item' + (s.category === r.id ? ' active' : ''), onClick: () => select(r.id), onContextMenu: (e) => { if (r.custom) { e.preventDefault(); patch({ modal: { kind: 'deltype', type: r.label } }) } } },
            Icon(r.icon, s.category === r.id ? '#c7b68c' : '#a49c8c', 12), r.label, React.createElement('span', { className: 'cnt' }, String(r.count)))),
        React.createElement('div', { key: 'add', className: 'bp-side-add', onClick: () => { if (!adding) setAdding(true) } },
          adding
            ? React.createElement('input', { value: tagName, placeholder: '分类名称，回车确认', autoFocus: true, onChange: (e) => setTagName(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter') addTag(); if (e.key === 'Escape') { setAdding(false); setTagName('') } }, onClick: (e) => e.stopPropagation() })
            : React.createElement('span', null, '＋ 添加类别')),
      )
    }

    function DelTypeModal(props) {
      const nd = getStore().data
      const t = props.type
      const count = nd ? nd.items.filter((i) => i.type === t).length : 0
      const close = () => patch({ modal: null })
      const doDel = () => {
        const d = store.data
        if (!d) return
        commit(Object.assign({}, d, {
          tags: d.tags.filter((x) => x !== t),
          items: d.items.map((it) => (it.type === t ? Object.assign({}, it, { type: 'other' }) : it)),
        }), '类别已删除：' + t)
        if (getStore().category === 'type:' + t) patch({ category: 'all' })
        close()
      }
      return React.createElement(ModalShell, { title: '删除类别', onClose: close },
        React.createElement('div', { style: { marginBottom: 10 } },
          React.createElement('span', { style: { color: '#c7b68c', fontWeight: 700 } }, t),
          count > 0 ? React.createElement('span', { style: { color: '#a49c8c', marginLeft: 8 } }, count + ' 件物品将改为「其他」') : null,
        ),
        React.createElement('div', { className: 'bp-danger' }, '确定删除这个类别吗？'),
        React.createElement('div', { className: 'row', style: { justifyContent: 'flex-end', marginTop: 14 } },
          React.createElement('button', { className: 'bp-btn', onClick: close }, '取消'),
          React.createElement('button', { className: 'bp-btn', style: { borderColor: '#ff6b5e', color: '#ff6b5e' }, onClick: doDel }, '删除'),
        ),
      )
    }

    // B3 费用明细悬浮卡片：金额上方小卡片，鼠标移开即关闭
    function UsageCard() {
      const [u, setU] = React.useState(null)
      React.useEffect(() => { rpc('get-usage').then((ur) => { if (ur && ur.ok) setU(ur) }) }, [])
      const days = (u && Array.isArray(u.days)) ? u.days : []
      const dayMax = Math.max(1, ...days.map((d) => d.costCu || 0))
      const models = (u && u.models) || {}
      const modelList = Object.keys(models).map((m) => ({ name: m, costCu: models[m].costCu || 0 })).filter((m) => m.costCu > 0).sort((a, b) => b.costCu - a.costCu)
      const modelMax = Math.max(1, ...modelList.map((m) => m.costCu))
      const totalCu = modelList.reduce((s, m) => s + m.costCu, 0)
      const yuan = (cu) => (cu / 10000).toFixed(2)
      return React.createElement('div', { className: 'bp-usage-card' },
        React.createElement('div', { className: 'uc-head' }, '费用明细 · 累计 ' + yuan(totalCu) + ' 元'),
        React.createElement('div', { className: 'uc-sec' }, '近 7 天每天总花费'),
        days.length === 0 ? React.createElement('div', { className: 'uc-line' }, '暂无明细')
          : days.map((d) => React.createElement('div', { key: d.date, className: 'uc-line' },
            React.createElement('span', { className: 'uc-date' }, d.date.slice(5)),
            React.createElement('span', { className: 'uc-bar' }, React.createElement('i', { style: { width: Math.max(2, Math.round((d.costCu || 0) / dayMax * 100)) + '%' } })),
            React.createElement('span', { className: 'uc-yuan' }, yuan(d.costCu || 0)))),
        React.createElement('div', { className: 'uc-sec' }, '每个模型花费'),
        modelList.length === 0 ? React.createElement('div', { className: 'uc-line' }, '暂无模型数据')
          : modelList.map((m) => React.createElement('div', { key: m.name, className: 'uc-line' },
            React.createElement('span', { className: 'uc-name' }, m.name),
            React.createElement('span', { className: 'uc-bar blue' }, React.createElement('i', { style: { width: Math.max(2, Math.round(m.costCu / modelMax * 100)) + '%' } })),
            React.createElement('span', { className: 'uc-yuan' }, yuan(m.costCu)))),
      )
    }

    function ModalRouter(props) {
      const m = props.s.modal
      if (!m) return null
      if (m.kind === 'add') return React.createElement(AddWizard, { bagId: m.bagId })
      if (m.kind === 'edit') return React.createElement(EditModal, { itemId: m.itemId })
      if (m.kind === 'preview') return React.createElement(PreviewModal, { itemId: m.itemId })
      if (m.kind === 'destroy') return React.createElement(DestroyModal, { itemId: m.itemId })
      if (m.kind === 'bags') return React.createElement(BagsModal, null)
      if (m.kind === 'deltype') return React.createElement(DelTypeModal, { type: m.type })
      return null
    }

    function ToastView(props) {
      const t = props.s.toast
      React.useEffect(() => {
        const d = defer(() => patch({ toast: null }), 2600)
        return d
      }, [t && t.seq])
      if (!t) return null
      return React.createElement('div', { className: 'bp-toast', 'data-type': t.type || 'info' }, t.text)
    }

    function Panel(props) {
      const s = props.s
      const d = s.data
      const [pos, setPos] = React.useState(() => {
        try { const raw = window.localStorage.getItem('bp-panel-pos'); return raw ? JSON.parse(raw) : null } catch (e) { /* ignore */ return null }
      })
      // 窗口尺寸变化时清除拖拽位置，吸附回右缘（像任务追踪条一样始终跟随视口右缘）
      React.useEffect(() => {
        const onResize = () => { try { window.localStorage.removeItem('bp-panel-pos') } catch (e) { /* ignore */ } setPos(null) }
        window.addEventListener('resize', onResize)
        return () => { try { window.removeEventListener('resize', onResize) } catch (e) {} }
      }, [])
      const ref = React.useRef(null)
      // C2 虚拟渲染：unified 大列表按滚动窗口渲染
      const bodyRef = React.useRef(null)
      const [scrollTop, setScrollTop] = React.useState(0)
      const [bodyH, setBodyH] = React.useState(600)
      const [bodyW, setBodyW] = React.useState(480)
      React.useEffect(() => {
        const el = bodyRef.current
        if (el) { setBodyH(el.clientHeight || 600); setBodyW(el.clientWidth || 480) }
      }, [d, s.open, s.viewMode])
      // 窗口/面板尺寸变化时刷新 body 宽高，让格子列数自适应
      React.useEffect(() => {
        const onResize = () => {
          const el = bodyRef.current
          if (!el) return
          setBodyH(el.clientHeight || 600)
          setBodyW(el.clientWidth || 480)
        }
        window.addEventListener('resize', onResize)
        return () => { try { window.removeEventListener('resize', onResize) } catch (e) {} }
      }, [])
      React.useEffect(() => { setScrollTop(0) }, [s.search, s.rarityFilter, s.sortMode, s.category, d])
      // 按物品区宽度自适应列数（格子固定 80px，窄面板列数变少、居中）
      const cols = Math.max(2, Math.floor((bodyW - 8) / 84))
      if (!d) return React.createElement('div', { className: 'bp-panel' }, React.createElement('div', { className: 'bp-head' }, React.createElement('span', { className: 't' }, '背包'), React.createElement('span', { className: 's' }, '加载中…')))
      const bags = d.bags.slice().sort((a, b) => a.order - b.order)
      const searching = !!(s.search || s.rarityFilter !== 'all')
      const useUnified = searching || s.viewMode !== 'bags'
      let body = null
      if (useUnified) {
        const list = filteredItems(d, s)
        const cells = []
        const ROW_H = 84
        const COLS = cols
        if (s.sortMode === 'type') {
          // 类型分组模式：行高不定，不做窗口切分（分组场景通常数量可控）
          TYPE_ORDER.forEach((t) => {
            const group = list.filter((i) => i.type === t)
            if (!group.length) return
            cells.push(React.createElement('div', { key: 'g' + t, className: 'bp-group-head' },
              Icon((TYPES[t] || {}).icon || 'parchment', '#c7b68c', 12),
              (TYPES[t] || {}).label,
              React.createElement('span', { className: 'gcnt' }, group.length + ' 件')))
            group.forEach((it) => cells.push(React.createElement(ItemCell, { key: 'u' + it.id, item: it, bagId: it.bagId, slot: it.slot, noDrop: true })))
          })
        } else {
          // C2：flat 模式按滚动窗口虚拟渲染
          const totalRows = Math.ceil(list.length / COLS)
          const visibleRows = Math.ceil(bodyH / ROW_H) + 3
          const startRow = Math.max(0, Math.floor(scrollTop / ROW_H))
          const startIdx = startRow * COLS
          const endIdx = Math.min(list.length, (startRow + visibleRows) * COLS)
          const padTop = startRow * ROW_H
          const padBottom = Math.max(0, (totalRows - startRow - visibleRows) * ROW_H)
          list.slice(startIdx, endIdx).forEach((it) => cells.push(React.createElement(ItemCell, { key: 'u' + it.id, item: it, bagId: it.bagId, slot: it.slot, noDrop: true })))
          if (padTop || padBottom) cells.unshift(React.createElement('div', { key: 'pad-top', style: { height: padTop, gridColumn: '1/-1' } }))
          if (padBottom) cells.push(React.createElement('div', { key: 'pad-bottom', style: { height: padBottom, gridColumn: '1/-1' } }))
        }
        cells.push(React.createElement('div', { key: 'addrow', className: 'bp-addrow', onClick: () => patch({ modal: { kind: 'add' } }) }, '＋ 添加物品'))
        body = list.length || cells.length > 1
          ? React.createElement('div', { className: 'bp-grid', style: { gridTemplateColumns: 'repeat(' + COLS + ', 80px)', justifyContent: 'center' } }, cells)
          : React.createElement('div', { style: { color: '#7a7262', fontSize: 12, padding: 24, textAlign: 'center' } },
            React.createElement('div', { style: { fontSize: 28, marginBottom: 8 } }, '🎒'),
            React.createElement('div', null, '背包空空如也'),
            React.createElement('button', { className: 'bp-btn', style: { marginTop: 12 }, onClick: () => patch({ modal: { kind: 'add' } }) }, '＋ 添加第一件物品'))
      } else {
        const blocks = bags.filter((b) => !b.vault).map((bag) => {
          const cnt = d.items.filter((it) => it.bagId === bag.id && it.slot >= 0).length
          const cap = bag.cols * bag.rows
          const gridCells = []
          for (let i = 0; i < cap; i++) {
            const at = d.items.find((x) => x.bagId === bag.id && x.slot === i)
            gridCells.push(at
              ? React.createElement(ItemCell, { key: at.id, item: at, bagId: bag.id, slot: i })
              : React.createElement(EmptyCell, { key: 'e' + i, bagId: bag.id, slot: i }))
          }
          return React.createElement('div', { key: bag.id, className: 'bp-block' },
            React.createElement('div', {
              className: 'bp-block-head' + (getStore().dragOverBag === bag.id ? ' dragover' : ''),
              onDragOver: (e) => { e.preventDefault(); patch({ dragOverBag: bag.id }) },
              onDragLeave: () => { if (getStore().dragOverBag === bag.id) patch({ dragOverBag: null }) },
              onDrop: (e) => { e.preventDefault(); patch({ dragOverBag: null }); const id = e.dataTransfer.getData('text/plain'); if (id) moveToBag(id, bag.id) },
            }, Icon('bag', '#c7b68c', 12), bag.name,
              React.createElement('button', { className: 'bp-btn', style: { padding: '2px 8px', fontSize: 12, marginLeft: 8 }, title: s.collapsedBags && s.collapsedBags[bag.id] ? '展开' : '折叠', onClick: (e) => { e.stopPropagation(); toggleCollapse(bag.id) } }, s.collapsedBags && s.collapsedBags[bag.id] ? '▶' : '▼'),
              React.createElement('span', { className: 'cap' }, cnt + '/' + cap),
              React.createElement('button', { className: 'bp-btn', style: { padding: '2px 8px', fontSize: 12 }, title: '增加一页（6×4 = 24 格）', onClick: (e) => { e.stopPropagation(); addPage(bag.id) } }, '＋1页'),
              React.createElement('button', { className: 'bp-btn', style: { padding: '2px 8px', fontSize: 12 }, title: '减少一页（24 格）', onClick: (e) => { e.stopPropagation(); subPage(bag.id) } }, '－1页')),
            (s.collapsedBags && s.collapsedBags[bag.id]) ? null : React.createElement('div', { className: 'bp-grid', style: { gridTemplateColumns: 'repeat(' + Math.min(bag.cols, cols) + ', 80px)' } }, gridCells))
        })
        body = blocks.length ? React.createElement('div', null, blocks) : React.createElement('div', { style: { color: '#7a7262', fontSize: 12, padding: 16 } }, '没有袋子')
      }
      const totalCount = d.items.length
      const totalUse = d.items.reduce((n, i) => n + (i.useCount || 0), 0)
      const favN = d.items.filter((i) => i.fav).length
      const money = s.money || { gold: 0, silver: 0, copper: 0 }
      return React.createElement('div', Object.assign({
        className: 'bp-panel',
        ref: ref,
        onDragOver: (e) => e.preventDefault(),
        onDrop: (e) => { e.preventDefault(); handleFileDrop(e) },
      }, pos ? { style: { left: pos.left, top: pos.top } } : null),
        React.createElement('div', { className: 'bp-head', style: { cursor: 'move' }, onMouseDown: (e) => { if (e.button === 0 && !(e.target && e.target.closest && e.target.closest('button'))) { e.preventDefault(); const rect = ref.current.getBoundingClientRect(); const sx = e.clientX, sy = e.clientY; const sl = rect.left, st = rect.top; let last = null; const onMove = (ev) => { const left = Math.max(0, Math.min(window.innerWidth - 160, sl + ev.clientX - sx)); const top = Math.max(0, Math.min(window.innerHeight - 80, st + ev.clientY - sy)); last = { left: Math.round(left), top: Math.round(top) }; setPos(last) }; const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); if (last) { try { window.localStorage.setItem('bp-panel-pos', JSON.stringify(last)) } catch (err) { /* ignore */ } } }; window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp) } } },
          React.createElement('span', { className: 't' }, '物品栏'),
          React.createElement('span', { className: 's', style: { flex: 1 } }),
          React.createElement('button', { className: 'bp-close', title: '关闭', 'aria-label': '关闭背包', onClick: () => patch({ open: false }) }, '✕'),
        ),
        React.createElement('div', { className: 'bp-toolbar' },
          React.createElement('input', { className: 'bp-input', placeholder: '搜索…', value: s.search, onChange: (e) => patch({ search: e.target.value }) }),
          s.search ? React.createElement('button', { className: 'bp-btn', title: '清除搜索与过滤', onClick: () => patch({ search: '', rarityFilter: 'all' }) }, '✕') : null,
          React.createElement('select', { className: 'bp-select', value: s.rarityFilter, onChange: (e) => patch({ rarityFilter: e.target.value }) },
            React.createElement('option', { value: 'all' }, '全部品质'),
            RARITIES.map((r) => React.createElement('option', { key: r.id, value: String(r.id) }, r.label))),
          React.createElement('select', { className: 'bp-select', value: s.sortMode, onChange: (e) => patch({ sortMode: e.target.value }) },
            React.createElement('option', { value: 'type' }, '类型分组'),
            React.createElement('option', { value: 'rarity' }, '品质优先'),
            React.createElement('option', { value: 'name' }, '按名称'),
            React.createElement('option', { value: 'used' }, '常用优先'),
            React.createElement('option', { value: 'custom' }, '添加顺序')),
          // F13 批量多选工具条
          (s.sel && s.sel.length ? React.createElement('span', { style: { display: 'flex', alignItems: 'center', gap: 4 } },
            React.createElement('span', { style: { fontSize: 12, color: '#c7b68c' } }, '已选 ' + s.sel.length),
            React.createElement('button', { className: 'bp-btn', title: '批量固定/取消固定', onClick: () => { const d = store.data; if (!d) return; const fav = !d.items.find((i) => i.id === s.sel[0] && i.fav); commit(Object.assign({}, d, { items: d.items.map((i) => (s.sel.indexOf(i.id) >= 0 ? Object.assign({}, i, { fav: fav ? 1 : 0 }) : i)) }), '已批量' + (fav ? '固定' : '取消固定') + ' ' + s.sel.length + ' 件'); patch({ sel: [] }) } }, '★'),
            React.createElement('button', { className: 'bp-btn', style: { borderColor: '#5a3a34', color: '#ff6b5e' }, title: '批量删除', onClick: () => { const d = store.data; if (!d) return; commit(Object.assign({}, d, { items: d.items.filter((i) => s.sel.indexOf(i.id) < 0) }), '已批量删除 ' + s.sel.length + ' 件'); patch({ sel: [] }) } }, '✕ 删除'),
            React.createElement('button', { className: 'bp-btn', title: '取消选择', onClick: () => patch({ sel: [] }) }, '取消'),
          ) : null),
          React.createElement('button', { className: 'bp-btn', title: '一键整理', onClick: tidy }, Icon('sort', '#c7b68c', 14), ' 整理'),
          React.createElement('button', { className: 'bp-btn', title: '添加物品', onClick: () => patch({ modal: { kind: 'add' } }) }, '＋ 物品'),
          React.createElement('button', { className: 'bp-btn', title: '袋子管理', onClick: () => patch({ modal: { kind: 'bags' } }) }, '▦ 袋子'),
        ),
        React.createElement('div', { className: 'bp-main' },
          React.createElement(Sidebar, { s: s }),
          React.createElement('div', { className: 'bp-body', ref: bodyRef, onScroll: (e) => setScrollTop(e.target.scrollTop) }, body),
        ),
        React.createElement('div', { className: 'bp-status' },
          React.createElement('span', null, '物品 ', React.createElement('b', null, totalCount), ' 件'),
          React.createElement('span', null, '背包 ', React.createElement('b', null, bags.length), ' 个'),
          React.createElement('span', { style: { marginLeft: 'auto', position: 'relative', display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer' }, title: '悬浮查看费用明细（每个模型花费 + 近 7 天每天总花费），移开自动关闭', onMouseEnter: () => patch({ usageOpen: true }), onMouseLeave: () => patch({ usageOpen: false }) },
            React.createElement('span', { style: { display: 'flex', alignItems: 'center', gap: 4 } }, React.createElement('b', null, String(money.gold)), React.createElement('img', { src: '/_dsh/backpack/media?p=' + enc(TYPE_ICON_DIR + '/金币.png'), style: { width: 16, height: 16 } })),
            React.createElement('span', { style: { display: 'flex', alignItems: 'center', gap: 4 } }, React.createElement('b', null, String(money.silver)), React.createElement('img', { src: '/_dsh/backpack/media?p=' + enc(TYPE_ICON_DIR + '/银币.png'), style: { width: 16, height: 16 } })),
            React.createElement('span', { style: { display: 'flex', alignItems: 'center', gap: 4 } }, React.createElement('b', null, String(money.copper)), React.createElement('img', { src: '/_dsh/backpack/media?p=' + enc(TYPE_ICON_DIR + '/铜币.png'), style: { width: 16, height: 16 } })),
            s.usageOpen ? React.createElement(UsageCard, null) : null,
          ),
        ),
      )
    }

    function OverlayRoot() {
      const s = useStore()
      React.useEffect(() => { loadData() }, [])
      React.useEffect(() => {
        if (typeof window === 'undefined' || !window.addEventListener) return
        const onKey = (e) => {
          if (e.defaultPrevented) return
          const k = e.key
          if (k && k.toLowerCase() === 'b' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const t = e.target
            const tag = t && t.tagName ? String(t.tagName) : ''
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return
            e.preventDefault()
            patch({ open: !getStore().open })
            return
          }
          // F12：Esc 关闭背包面板
          if (k === 'Escape' && getStore().open) { const s2 = getStore(); if (s2.sel && s2.sel.length) { patch({ sel: [] }); return } patch({ open: false }); return }
          // F12：/ 聚焦搜索（面板打开时）
          if (k === '/' && getStore().open) {
            const t = e.target
            const tag = t && t.tagName ? String(t.tagName) : ''
            if (tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) return
            e.preventDefault()
            const el = document.querySelector('.bp-panel .bp-input')
            if (el && el.focus) { try { el.focus() } catch (err) { /* ignore */ } }
          }
        }
        window.addEventListener('keydown', onKey, true)
        return () => { try { window.removeEventListener('keydown', onKey, true) } catch (e) {} }
      }, [])
      return React.createElement('div', { className: 'bp-root' },
        React.createElement('button', { className: 'bp-fab', type: 'button', title: '背包 (B)', onClick: () => patch({ open: !getStore().open }) },
          React.createElement('img', { src: '/_dsh/backpack/media?p=' + enc(TYPE_ICON_DIR + '/背包.png'), alt: '背包', style: { width: 30, height: 30, pointerEvents: 'none' } })),
        s.open ? React.createElement(Panel, { s: s }) : null,
        s.tooltip ? React.createElement(TooltipView, { s: s }) : null,
        s.menu ? React.createElement(MenuView, { s: s }) : null,
        s.modal ? React.createElement(ModalRouter, { s: s }) : null,
        s.toast ? React.createElement(ToastView, { s: s }) : null,
      )
    }

    function ComposerBridge(props) {
      const s = useStore()
      React.useEffect(() => {
        if (!s.insert) return
        const req = s.insert
        let draft = ''
        if (props.input && typeof props.input.draft === 'string') draft = props.input.draft
        const text = String(req.text || '')
        const next = draft.trim() ? (draft + '\n\n' + text) : text
        if (props.inputActions && typeof props.inputActions.setDraft === 'function') {
          try { props.inputActions.setDraft(next) } catch (e) { /* ignore */ }
        }
        patch({ insert: null })
      }, [s.insert ? s.insert.seq : 0])
      return null
    }

    slotsSvc.inject('shell.overlay', () => slotsSvc.register(
      { name: 'shell.overlay', id: 'backpack', order: 50, label: '背包' },
      () => React.createElement(OverlayRoot),
    ))

    slotsSvc.inject('conversation.input.left', () => slotsSvc.register(
      { name: 'conversation.input.left', id: 'backpack-composer', order: 20, label: '背包' },
      (props) => React.createElement(ComposerBridge, props),
    ))
}
