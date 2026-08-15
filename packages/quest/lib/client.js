window.__ModuleLoader__.load({
	id: "@ggame/quest",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const React = require("react");
		/** 样式注入：与动态版 styles.insert 同 API。 */
		const styles = {
			insert(css) {
				const tag = document.createElement("style");
				tag.dataset.plugin = "@ggame/quest";
				tag.dataset.pluginCss = "@ggame/quest/client";
				tag.textContent = css;
				document.head.appendChild(tag);
				return () => { tag.remove(); };
			}
		};
		/** 原生定时器（常驻 bundle 拥有全部浏览器全局）。 */
		const defer = (fn, ms) => { const t = setTimeout(fn, ms); return () => clearTimeout(t) };
// 等级 1-5 → 颜色参考背包品质色（普通/优秀/精良/史诗/传说）
const LEVELS = [
  { id: 1, label: '普通', color: '#ffffff' },
  { id: 2, label: '优秀', color: '#1eff00' },
  { id: 3, label: '精良', color: '#0070dd' },
  { id: 4, label: '史诗', color: '#a335ee' },
  { id: 5, label: '传说', color: '#ff8000' },
]
const STATUSES = {
  active: { label: '进行中', color: '#d8d4cc' },
  tracked: { label: '追踪中', color: '#1eff00' },
  completed: { label: '已完成', color: '#a49c8c' },
  abandoned: { label: '已放弃', color: '#6b6458' },
}
const STATUS_ORDER = ['tracked', 'active', 'completed', 'abandoned']
const TYPE_ICON_DIR = '@icons'

exports.inject = ['slots']
function apply(ctx) {
  const slotsSvc = ctx.slots

  const disposeCss = styles.insert(
    '.qst-root{pointer-events:none}' +
    '.qst-btn{pointer-events:auto;position:fixed;right:73px;bottom:20px;width:48px;height:48px;border-radius:12px;background:linear-gradient(160deg,#312b23,#1b1712);border:1px solid #4a4338;color:#c7b68c;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,.5);z-index:9000;transition:all .15s}' +
    '.qst-btn:hover{border-color:#6f6857;box-shadow:0 0 12px rgba(133,127,103,.3);transform:translateY(-2px)}' +
    '.qst-panel{pointer-events:auto;position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9100;width:min(940px,calc(100vw - 32px));height:min(700px,calc(100vh - 48px));display:flex;flex-direction:column;background:linear-gradient(175deg,#2b2620,#15110d);border:1px solid #3b352c;border-radius:14px;box-shadow:0 14px 48px rgba(0,0,0,.7),inset 0 1px 0 rgba(133,127,103,.08);color:#d6d2c8;font-size:14px;user-select:none;overflow:hidden}' +
    '.qst-head{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #332d25;background:linear-gradient(180deg,rgba(133,127,103,.08),rgba(133,127,103,0))}' +
    '.qst-head .t{font-size:18px;font-weight:700;color:#c7b68c;letter-spacing:1px}' +
    '.qst-head .s{flex:1;font-size:13px;color:#a49c8c}' +
    '.qst-close{cursor:pointer;background:none;border:1px solid #443d31;color:#b9b4a8;border-radius:6px;width:32px;height:32px;line-height:1;font-size:18px}' +
    '.qst-close:hover{color:#e8e2d4;border-color:#6f6857}' +
    '.qst-main{display:flex;flex:1;min-height:0;overflow:hidden}' +
    '.qst-side{width:230px;flex:none;border-right:1px solid #332d25;overflow-y:auto;padding:10px 0;background:rgba(0,0,0,.12)}' +
    '.qst-side-title{padding:4px 16px 8px;font-size:12px;color:#a49c8c;text-transform:uppercase;letter-spacing:.08em}' +
    '.qst-stat{display:flex;gap:8px;padding:6px 16px;font-size:12px;color:#a49c8c;flex-wrap:wrap}' +
    '.qst-stat b{color:#c7b68c;font-weight:600}' +
    '.qst-side-item{display:flex;align-items:center;gap:8px;padding:8px 16px;cursor:pointer;font-size:14px;color:#b9b4a8;white-space:nowrap}' +
    '.qst-side-item:hover{background:rgba(199,182,140,.08)}' +
    '.qst-side-item.active{background:rgba(199,182,140,.16);color:#e8e2d4;box-shadow:inset 3px 0 0 #c7b68c}' +
    '.qst-side-item .cnt{margin-left:auto;font-size:12px;color:#a49c8c}' +
    '.qst-side-item.active .cnt{color:#c7b68c}' +
    '.qst-side-sep{height:1px;background:#332d25;margin:7px 10px}' +
    '.qst-side-add{display:flex;align-items:center;gap:8px;padding:8px 16px;cursor:pointer;font-size:14px;color:#a49c8c}' +
    '.qst-side-add:hover{color:#c7b68c}' +
    '.qst-side-add input{background:#0f0c0a;border:1px solid #3b352c;color:#e0ddd4;border-radius:4px;font-size:13px;padding:4px 8px;width:100%;outline:none}' +
    '.qst-body{overflow-y:auto;overflow-x:hidden;padding:10px;flex:1;display:flex;flex-direction:column}' +
    '.qst-toolbar{display:flex;flex-wrap:wrap;gap:6px;padding:8px 2px;align-items:center;border-bottom:1px solid #332d25;margin-bottom:8px}' +
    '.qst-input,.qst-select{background:#0f0c0a;border:1px solid #3b352c;color:#e0ddd4;border-radius:6px;padding:6px 10px;font-size:14px;outline:none}' +
    '.qst-filters{display:flex;gap:4px;flex-wrap:wrap}' +
    '.qst-filter{background:#17130e;border:1px solid #332d25;color:#9a9386;border-radius:12px;padding:3px 10px;font-size:11.5px;cursor:pointer}' +
    '.qst-filter:hover{border-color:#5a5345;color:#d6d2c8}' +
    '.qst-filter.on{background:rgba(199,182,140,.16);border-color:#c7b68c;color:#c7b68c}' +
    '.qst-input{flex:1;min-width:120px}' +
    '.qst-input:focus,.qst-select:focus{border-color:#6f6857}' +
    '.qst-input::-webkit-calendar-picker-indicator{filter:invert(.75) sepia(1) saturate(2) hue-rotate(5deg);cursor:pointer;opacity:.9}' +
    '.qst-btn-sm{background:#221d16;border:1px solid #443d31;color:#d3cec2;border-radius:6px;padding:4px 10px;font-size:13px;cursor:pointer;white-space:nowrap}' +
    '.qst-btn-sm:hover{border-color:#6f6857;color:#efe9da}' +
    '.qst-btn-sm:disabled{opacity:.45;cursor:not-allowed}' +
    '.qst-obj.flash{box-shadow:0 0 0 1px #1eff00,0 0 10px rgba(30,255,0,.35);transition:box-shadow .45s}' +
    '.qst-btn-sm.primary{border-color:#6f6857;color:#c7b68c}' +
    '.qst-btn-sm.danger{border-color:#5a3a34;color:#ff6b5e}' +
    '.qst-quest{border:1px solid #332d25;border-radius:8px;background:#211d17;margin-bottom:6px;cursor:pointer;transition:border-color .1s}' +
    '.qst-quest:hover{border-color:#5a5345}' +
    '.qst-quest.selected{border-color:#6f6857;box-shadow:inset 3px 0 0 #c7b68c}' +
    '.qst-quest .qhead{display:flex;align-items:center;gap:8px;padding:9px 12px}' +
    '.qst-quest .qhead .lvl{flex:none;width:26px;height:26px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#0f0c0a}' +
    '.qst-quest .qhead .tt{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}' +
    '.qst-quest .qhead .meta{font-size:11px;color:#a49c8c;white-space:nowrap}' +
    '.qst-quest .qobj{padding:0 12px 8px 46px;font-size:12px;color:#9a9386;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.qst-detail{padding:0 4px;display:flex;flex-direction:column;gap:10px;flex:1;min-height:0;overflow-y:auto}' +
    '.qst-detail .dt-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}' +
    '.qst-detail .dt-title{font-size:20px;font-weight:700}' +
    '.qst-detail .dt-desc{color:#b9b4a8;font-size:13px;line-height:1.6;white-space:pre-wrap}' +
    '.qst-obj{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid #332d25;border-radius:8px;background:#1d1813;margin-bottom:6px}' +
    '.qst-obj.done{opacity:.55}' +
    '.qst-obj.done .qst-obj-text{text-decoration:line-through;color:#a49c8c}' +
    '.qst-obj .qst-obj-text{flex:1;font-size:13px;color:#e0ddd4}' +
    '.qst-obj .qst-obj-prog{font-size:12px;color:#d8b558;white-space:nowrap}' +
    '.qst-obj .qst-obj-prog.done{color:#1eff00}' +
    '.qst-obj .check{width:18px;height:18px;border:1px solid #4a4338;border-radius:4px;background:#0f0c0a;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:11px;color:#1eff00}' +
    '.qst-rewards{font-size:13px;color:#ffd100}' +
    '.qst-actions{display:flex;flex-direction:column;gap:6px}' +
    '.qst-actions-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}' +
    '.qst-actions-row.secondary{opacity:.85}' +
    '.qst-actions-sep{width:1px;height:20px;background:#332d25;margin:0 4px}' +
    '.qst-tracker{pointer-events:auto;position:fixed;right:20px;top:110px;z-index:9050;width:272px;max-height:62vh;display:flex;flex-direction:column;background:rgba(12,10,8,.82);border:1px solid #4a4338;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.6);color:#d6d2c8;font-size:13px;overflow:hidden;backdrop-filter:blur(4px)}' +
    '.qst-tracker-head{display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(133,127,103,.1);cursor:pointer;font-weight:700;color:#c7b68c;font-size:13px;letter-spacing:1px}' +
    '.qst-tracker-head .x{margin-left:auto;font-size:11px;color:#a49c8c}' +
    '.qst-tracker-body{overflow-y:auto;padding:6px 0}' +
    '.qst-tracker-empty{padding:14px 12px;font-size:12px;color:#a49c8c}' +
    '.qst-tq{padding:8px 12px;border-bottom:1px solid rgba(51,45,37,.6)}' +
    '.qst-tq .name{font-size:13px;font-weight:700;cursor:pointer}' +
    '.qst-tq .name:hover{color:#e8e2d4}' +
    '.qst-tq .objs{margin-top:3px}' +
    '.qst-tq .obj{display:flex;gap:6px;padding:1px 0 1px 10px;font-size:12px;color:#e0ddd4}' +
    '.qst-tq .obj .prog{margin-left:auto;color:#d8b558;white-space:nowrap;flex:none}' +
    '.qst-tq .obj.done .txt{text-decoration:line-through;color:#a49c8c}' +
    '.qst-tq .obj.done .prog{color:#a49c8c}' +
    '.qst-backdrop{position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;pointer-events:auto}' +
    '.qst-modal{background:linear-gradient(175deg,#2b2620,#15110d);border:1px solid #443d31;border-radius:10px;box-shadow:0 16px 48px rgba(0,0,0,.75);padding:22px;width:min(760px,92vw);max-height:88vh;overflow:auto;color:#d6d2c8}' +
    '.qst-modal .mt{font-size:14px;font-weight:700;color:#c7b68c;margin-bottom:12px;display:flex;align-items:center;gap:8px}' +
    '.qst-modal .mt .x{margin-left:auto;cursor:pointer;color:#a49c8c;font-size:16px}' +
    '.qst-field{margin-bottom:10px}' +
    '.qst-field label{display:block;font-size:11px;color:#a49c8c;margin-bottom:3px}' +
    '.qst-field .in{width:100%;box-sizing:border-box}' +
    '.qst-ta{width:100%;box-sizing:border-box;min-height:90px;background:#0f0c0a;border:1px solid #3b352c;color:#e0ddd4;border-radius:6px;padding:9px 12px;font-size:14px;outline:none;resize:vertical;font-family:inherit}' +
    '.qst-ta:focus{border-color:#6f6857}' +
    '.qst-modal .row{display:flex;gap:8px;align-items:center;margin-bottom:8px}' +
    '.qst-modal .row .grow{flex:1}' +
    '.qst-obj-edit{display:flex;gap:6px;margin-bottom:6px;align-items:center}' +
    '.qst-obj-edit input{flex:1;min-width:0}' +
    '.qst-obj-edit .num{width:72px;flex:none}' +
    '.qst-obj-edit .del{flex:none;width:26px;height:26px;border:1px solid #5a3a34;color:#ff6b5e;background:none;border-radius:5px;cursor:pointer}' +
    '.qst-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:9800;background:rgba(12,10,8,.96);border:1px solid #6f6857;color:#d8b558;padding:8px 18px;border-radius:20px;font-size:12.5px;box-shadow:0 4px 16px rgba(0,0,0,.7);pointer-events:none;max-width:80vw}' +
    '.qst-toast[data-type=success]{color:#1eff00;border-color:#2f6b2f}' +
    '.qst-toast[data-type=error]{color:#ff6b5e;border-color:#7a3a34}' +
    '.qst-danger{color:#ff6b5e;font-size:12px;margin-top:6px}' +
    '.qst-menu-backdrop{position:fixed;inset:0;z-index:9700;pointer-events:auto;background:transparent}' +
    '.qst-menu{position:fixed;z-index:9701;background:rgba(14,11,9,.97);border:1px solid #4a4338;border-radius:6px;padding:4px 0;box-shadow:0 6px 24px rgba(0,0,0,.8);min-width:180px;animation:qst-menu-in .12s ease}' +
    '@keyframes qst-menu-in{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}' +
    '.qst-menu-item{padding:6px 14px;cursor:pointer;font-size:12.5px;color:#d6d2c8;display:flex;align-items:center;gap:7px}' +
    '.qst-menu-item:hover{background:rgba(199,182,140,.14)}' +
    '.qst-menu-item.danger{color:#ff6b5e}' +
    '.qst-menu-sep{height:1px;background:#332d25;margin:4px 6px}'
  )
  ctx.effect(() => disposeCss)

  let store = {
    open: false,
    trackerCollapsed: false,
    trackerHidden: (() => { try { return window.localStorage.getItem('ggame-tracker-hidden') === '1' } catch (e) { return false } })(),
    data: null,
    cat: 'all',
    statusFilter: ['tracked', 'active'],
    search: '',
    selected: null,
    modal: null,
    menu: null,
    toast: null,
    processing: null,
    loading: true,
  }
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
  const rpc = (method, args) => fetch('/_dsh/quest/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method: method, args: args || null }), credentials: 'same-origin' }).then((r) => r.json()).catch((e) => ({ ok: false, error: String((e && e.message) || e) }))
  function toast(text, type) { patch({ toast: { text: text, type: type || 'info', seq: Date.now() } }) }
  const enc = (s) => (typeof encodeURIComponent === 'function') ? encodeURIComponent(s) : String(s)
  const clamp = (v, lo, hi) => { const n = Math.floor(Number(v)); return isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo }

  /** 面板拖拽：按住头部拖动（跳过按钮），位置持久化到 localStorage。 */
  function dragStart(e, ref, setPos, key) {
    if (!e || e.button !== 0) return
    if (e.target && e.target.closest && e.target.closest('button')) return
    e.preventDefault()
    const el = ref && ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const sx = e.clientX, sy = e.clientY
    const sl = rect.left, st = rect.top
    let last = null
    const onMove = (ev) => {
      const left = Math.max(0, Math.min(window.innerWidth - 160, sl + ev.clientX - sx))
      const top = Math.max(0, Math.min(window.innerHeight - 80, st + ev.clientY - sy))
      last = { left: Math.round(left), top: Math.round(top) }
      setPos(last)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (last) { try { window.localStorage.setItem(key, JSON.stringify(last)) } catch (e) { /* ignore */ } }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
  function usePanelPos(key) {
    const [pos, setPos] = React.useState(() => {
      try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) : null } catch (e) { /* ignore */ return null }
    })
    return [pos, setPos]
  }

  /** 发送到对话（写入输入框，由 ComposerBridge 桥接）。 */
  function sendToComposer(text) {
    patch({ insert: { seq: Date.now(), text: text } })
    toast('已放入输入框，按 Enter 发送')
  }
  /** 发送到对话的简洁内容：只含任务描述与目标。 */
  function questBrief(q) {
    const lines = []
    if (q.description) lines.push(q.description)
    if (q.objectives.length) {
      lines.push('目标：')
      q.objectives.forEach((o) => lines.push('  - ' + o.text + ' ' + Math.min(o.current, o.target) + '/' + o.target))
    }
    if (!lines.length) lines.push(q.title)
    return lines.join('\n')
  }
  function questSummary(q) {
    const lines = ['【任务】' + q.title + '（' + ((LEVELS[q.level - 1] || LEVELS[0]).label) + ' · ' + (q.category || '未分类') + ' · ' + ((STATUSES[q.status] || {}).label || q.status) + '）']
    if (q.dueAt) lines.push('到期：' + fmtDate(q.dueAt) + '（' + (timeLeft(q.dueAt) || {}).label + '）')
    if (q.description) lines.push(q.description)
    if (q.objectives.length) {
      lines.push('目标：')
      q.objectives.forEach((o) => lines.push('  - ' + o.text + ' ' + Math.min(o.current, o.target) + '/' + o.target))
    }
    if (q.rewards) lines.push('奖励：' + q.rewards)
    return lines.join('\n')
  }

  const pad2 = (n) => (n < 10 ? '0' : '') + n
  function fmtDate(ms) {
    if (!ms) return ''
    const d = new Date(ms)
    if (isNaN(d.getTime())) return ''
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes())
  }
  /** 到期时间 → 剩余时间标签（无到期返回 null）。 */
  function timeLeft(dueAt) {
    if (!dueAt) return null
    const diff = dueAt - Date.now()
    if (diff <= 0) return { label: '已到期', color: '#ff2d2d' }
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor((diff % 86400000) / 3600000)
    const mins = Math.floor((diff % 3600000) / 60000)
    const label = days > 0 ? '剩 ' + days + ' 天 ' + hours + ' 小时' : (hours > 0 ? '剩 ' + hours + ' 小时 ' + mins + ' 分' : '剩 ' + Math.max(1, mins) + ' 分钟')
    return { label: label, color: days === 0 ? '#ff7d0a' : '#d8b558' }
  }
  const toLocalInput = (ms) => { if (!ms) return ''; const d = new Date(ms); if (isNaN(d.getTime())) return ''; return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) }
  const fromLocalInput = (s) => { if (!s) return 0; const t = new Date(s).getTime(); return isFinite(t) ? t : 0 }

  function iconSrc(ic) {
    const s = String(ic || '')
    if (!s) return ''
    if (s.indexOf('data:') === 0) return s
    return '/_dsh/quest/media?p=' + enc(s)
  }
  function defaultIcon() { return '/_dsh/quest/media?p=' + enc(TYPE_ICON_DIR + '/魔法卷轴.png') }

  async function loadData() {
    const res = await rpc('get-state')
    if (res && res.ok && res.data) patch({ data: res.data, loading: false })
    else patch({ loading: false, toast: { text: '任务加载失败: ' + ((res && res.error) || ''), seq: Date.now() } })
  }
  function commit(nextData, toastText) {
    patch({ data: nextData })
    rpc('persist', { data: nextData }).then((res) => {
      if (!res || !res.ok) { toast('保存失败: ' + ((res && res.error) || '')); loadData() }
      else if (toastText) toast(toastText)
    })
  }
  function findQuest(id) { const d = store.data; return d ? (d.quests.find((q) => q.id === id) || null) : null }
  function updateQuest(q, patch2) { const d = store.data; if (!d) return; commit(Object.assign({}, d, { quests: d.quests.map((x) => (x.id === q.id ? Object.assign({}, x, patch2, { updatedAt: Date.now() }) : x)) })) }
  function removeQuest(id) { const d = store.data; if (!d) return; const q = findQuest(id); commit(Object.assign({}, d, { quests: d.quests.filter((x) => x.id !== id) }), '任务已删除：' + ((q && q.title) || '')); if (getStore().selected === id) patch({ selected: null }) }
  /** 完成门槛：目标全部完成（或没有目标）才算可完成。 */
  const canComplete = (q) => !q || q.objectives.length === 0 || q.objectives.every((o) => o.current >= o.target)
  /** 完成联动：目标全部完成后任务才转为已完成（重复任务自动重置到下一周期）。 */
  function completeQuest(q) {
    if (!canComplete(q)) {
      // 本地数据可能过期（Agent 已在服务端推进目标）：先刷新一次再判断
      rpc('get-state').then((res) => {
        if (res && res.ok && res.data) {
          patch({ data: res.data })
          const fresh = res.data.quests.find((x) => x.id === q.id)
          if (fresh && canComplete(fresh)) completeQuest(fresh)
          else toast('目标未全部完成，无法完成：' + (fresh ? fresh.title : q.title), 'error')
        } else toast('目标未全部完成，无法完成：' + q.title, 'error')
      })
      return
    }
    if (q.recur === 'daily' || q.recur === 'weekly') {
      // D2 重复任务：目标清零、回到追踪、推到下一周期
      const nextDue = (q.dueAt && q.dueAt > Date.now() ? q.dueAt : Date.now()) + (q.recur === 'daily' ? 86400000 : 7 * 86400000)
      updateQuest(q, { objectives: q.objectives.map((o) => Object.assign({}, o, { current: 0 })), status: 'tracked', completedAt: 0, dueAt: nextDue })
      toast('任务已完成：' + q.title + '（重复任务，已重置为下一周期）', 'success')
      if (getStore().processing === q.id) patch({ processing: null })
      return
    }
    updateQuest(q, { status: 'completed', completedAt: Date.now() })
    toast('任务已完成：' + q.title, 'success')
    if (getStore().processing === q.id) patch({ processing: null })
  }
  /** 发送到对话：内容入输入框，同时开启自动检测（轮询服务端，目标全清即自行完成）。 */
  function sendForProcessing(q) {
    const text = questBrief(q) + '\n\n请完成以上任务；目标全部完成后，必须调用 quest_progress 或 quest_complete 更新本任务的进度并完成任务（任务 id：' + q.id + '）。'
    patch({ insert: { seq: Date.now(), text: text }, processing: q.id })
    startProcessingPoll()
    toast('已发送给 Agent 处理，完成后自动完成')
  }
  /** 轮询：Agent 处理期间每 3 秒拉取服务端任务状态，检测到完成即自行收尾。 */
  let processingPoll = null
  function startProcessingPoll() {
    if (processingPoll) return
    processingPoll = setInterval(async () => {
      const pid = getStore().processing
      if (!pid) { stopProcessingPoll(); return }
      // E1 轮询瘦身：只拉单个任务（get-quest），不再全量 get-state
      const res = await rpc('get-quest', { id: pid })
      if (!res || !res.ok || !res.quest) { patch({ processing: null }); return }
      const fresh = res.quest
      const prev = getStore().data
      const prevQuest = prev && prev.quests.find((q) => q.id === pid)
      const wasCompleted = !!prevQuest && prevQuest.status === 'completed'
      // 合并进度到本地（列表/追踪条实时可见）
      if (prev) patch({ data: Object.assign({}, prev, { quests: prev.quests.map((x) => (x.id === pid ? fresh : x)) }) })
      if (fresh.status === 'completed') {
        if (!wasCompleted) toast('任务已完成：' + fresh.title)
        patch({ processing: null })
        return
      }
      if (fresh.objectives.length > 0 && fresh.objectives.every((o) => o.current >= o.target)) {
        // 服务端通常已自动置 completed；防御性补一次完成
        completeQuest(fresh)
        return
      }
    }, 5000)
  }
  function stopProcessingPoll() {
    if (processingPoll) { try { clearInterval(processingPoll) } catch (e) { /* ignore */ } processingPoll = null }
  }
  function setStatus(id, status) {
    const q = findQuest(id); if (!q) return
    if (status === 'completed') { completeQuest(q); return }
    updateQuest(q, { status: status })
    toast('状态已更新：' + STATUSES[status].label)
  }
  function setObjDone(q, oid, done) {
    const objs = q.objectives.map((o) => (o.id === oid ? Object.assign({}, o, { current: done ? o.target : 0 }) : o))
    const all = objs.length > 0 && objs.every((o) => o.current >= o.target)
    updateQuest(q, all ? { objectives: objs, status: 'completed', completedAt: Date.now() } : { objectives: objs })
    if (all) toast('任务已完成：' + q.title)
  }
  function bumpObj(q, oid, by) {
    const objs = q.objectives.map((o) => (o.id === oid ? Object.assign({}, o, { current: clamp(o.current + by, 0, o.target) }) : o))
    const all = objs.length > 0 && objs.every((o) => o.current >= o.target)
    updateQuest(q, all ? { objectives: objs, status: 'completed', completedAt: Date.now() } : { objectives: objs })
    // F3：目标行绿闪反馈
    patch({ flash: { id: oid, ts: Date.now() } })
    defer(() => { if (getStore().flash && getStore().flash.id === oid) patch({ flash: null }) }, 450)
    if (all) toast('任务已完成：' + q.title)
  }
  function toggleTrack(id) { const q = findQuest(id); if (!q) return; const st = q.status === 'tracked' ? 'active' : 'tracked'; setStatus(id, st) }
  function addCategory(name) {
    const n = String(name || '').trim().slice(0, 32)
    if (!n) return
    const d = store.data
    if (!d) return
    if (d.categories.indexOf(n) >= 0) { toast('分类已存在'); return }
    commit(Object.assign({}, d, { categories: d.categories.concat([n]) }), '已添加分类：' + n)
  }
  function deleteCategory(name) {
    const d = store.data
    if (!d) return
    commit(Object.assign({}, d, { categories: d.categories.filter((c) => c !== name), quests: d.quests.map((q) => (q.category === name ? Object.assign({}, q, { category: '' }) : q)) }), '分类已删除：' + name)
    if (getStore().cat === 'type:' + name) patch({ cat: 'all' })
  }
  function saveQuest(form) {
    const d = store.data
    if (!d) return
    const objectives = (form.objectives || []).filter((o) => String(o.text || '').trim())
      .map((o) => ({ id: o.id || 'o-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: String(o.text).slice(0, 4096), target: Math.max(1, clamp(o.target, 1, 99999, 1)), current: Math.max(0, clamp(o.current, 0, 99999, 0)) }))
    const base = {
      title: String(form.title || '未命名任务').slice(0, 200),
      level: clamp(form.level, 1, 5, 1),
      category: String(form.category || '').slice(0, 32),
      description: String(form.description || '').slice(0, 4096),
      objectives: objectives,
      rewards: String(form.rewards || '').slice(0, 500),
      icon: String(form.icon || '').slice(0, 1024 * 1024),
      dueAt: fromLocalInput(form.dueAt),
      recur: form.recur === 'daily' || form.recur === 'weekly' ? form.recur : '',
    }
    if (form.id) {
      updateQuest(findQuest(form.id), base)
      toast('任务已保存：' + base.title)
      patch({ modal: null })
    } else {
      const now = Date.now()
      const quest = Object.assign({}, base, {
        id: 'q-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        status: STATUS_ORDER.indexOf(form.status) >= 0 ? form.status : 'tracked',
        order: d.quests.length,
        createdAt: now,
        updatedAt: now,
        completedAt: 0,
      })
      const cats = d.categories.indexOf(quest.category) >= 0 ? d.categories : (quest.category ? d.categories.concat([quest.category]) : d.categories)
      commit(Object.assign({}, d, { categories: cats, quests: d.quests.concat([quest]) }), '任务已创建：' + quest.title)
      patch({ modal: null, selected: quest.id })
    }
  }

  function filtered(d, s) {
    let list = d.quests.slice()
    if (s.cat !== 'all') list = list.filter((q) => q.category === s.cat)
    // F15 状态多选：statusFilter 为数组，含 'all' 或空数组 = 不过滤
    const sf = Array.isArray(s.statusFilter) ? s.statusFilter : []
    if (sf.length && sf.indexOf('all') < 0) list = list.filter((q) => sf.indexOf(q.status) >= 0)
    if (s.search) {
      const t = s.search.toLowerCase()
      list = list.filter((q) => q.title.toLowerCase().indexOf(t) >= 0 || String(q.description || '').toLowerCase().indexOf(t) >= 0 || q.objectives.some((o) => o.text.toLowerCase().indexOf(t) >= 0))
    }
    list.sort((a, b) => (b.level - a.level) || (a.order - b.order))
    return list
  }

  function Icon(kind, color, size) {
    const s = size || 18
    const sp = { fill: 'none', stroke: color || '#cbb98f', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }
    const kids = []
    const addP = (d) => kids.push(React.createElement('path', Object.assign({ key: kids.length, d: d }, sp)))
    const addC = (cx, cy, r) => kids.push(React.createElement('circle', Object.assign({ key: kids.length, cx: cx, cy: cy, r: r }, sp)))
    switch (kind) {
      case 'scroll': addP('M6 4h9a2 2 0 0 1 2 2v13a1.5 1.5 0 0 1-1.5 1.5H8a2.5 2.5 0 0 0 2.5 2.5H17a1.5 1.5 0 0 0 1.5-1.5V7'); addP('M9 9h5'); addP('M9 13h5'); break
      case 'plus': addP('M12 5v14M5 12h14'); break
      case 'trash': addP('M5 6h14M9 6V4h6v2M6 6l1 14h10l1-14'); break
      case 'edit': addP('M4 20l1-4L16 5l3 3-11 11Z'); addP('M14.5 6.5l3 3'); break
      case 'close': addP('M6 6l12 12M18 6L6 18'); break
      case 'check': addP('M4 12l5 5L20 6'); break
      case 'pin': addP('M9 4h6v3l-1.5 2v5l1.5 2v3H9v-3l1.5-2V9L9 7V4Z'); addC(12, 6.5, 0.9); break
      case 'tracker': addP('M4 6h16M4 12h16M4 18h10'); break
      case 'flag': addP('M5 3v18'); addP('M5 4h11l-2 4 2 4H5'); break
      case 'search': addC(10.5, 10.5, 5.5); addP('M15 15l5 5'); break
      case 'arrow': addP('M5 12h14M13 6l6 6-6 6'); break
      case 'folder': addP('M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z'); break
      default: addP('M4 4h16v16H4Z'); break
    }
    return React.createElement('svg', { width: s, height: s, viewBox: '0 0 24 24' }, kids)
  }

  // ── 按钮：背包 FAB 左侧 5px ──
  function QuestButton() {
    const s = useStore()
    return React.createElement('button', { className: 'qst-btn', type: 'button', title: '任务 (L)', onClick: () => patch({ open: !getStore().open }) },
      React.createElement('img', { src: defaultIcon(), alt: '任务', style: { width: 30, height: 30, pointerEvents: 'none' } }))
  }

  // ── 左侧任务看板 ──
  function Dashboard(props) {
    const s = props.s
    const d = s.data
    const [adding, setAdding] = React.useState(false)
    const [catName, setCatName] = React.useState('')
    if (!d) return React.createElement('div', { className: 'qst-side' })
    const counts = {}
    d.quests.forEach((q) => { counts[q.category || '未分类'] = (counts[q.category || '未分类'] || 0) + 1 })
    // 状态统计：进行中 = active+tracked（未完成未放弃），追踪 = tracked，完成 = completed
    const activeN = d.quests.filter((q) => q.status === 'active' || q.status === 'tracked').length
    const trackedN = d.quests.filter((q) => q.status === 'tracked').length
    const doneN = d.quests.filter((q) => q.status === 'completed').length
    // D6 完成统计：本周完成（自然周，周一 00:00 起）/ 平均耗时 / 超期率
    const now = Date.now()
    const d0 = new Date(now)
    const weekStart = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - ((d0.getDay() + 6) % 7)).getTime()
    const completed = d.quests.filter((q) => q.status === 'completed')
    const weekDone = completed.filter((q) => (q.completedAt || 0) >= weekStart).length
    const durList = completed.map((q) => (q.completedAt || 0) - (q.createdAt || 0)).filter((v) => v > 0)
    const avgMs = durList.length ? durList.reduce((s, v) => s + v, 0) / durList.length : 0
    const avgDurH = Math.round(avgMs / 3600000)
    const overdueN = completed.filter((q) => q.dueAt && q.completedAt && q.completedAt > q.dueAt).length
    const overduePct = completed.length ? Math.round(overdueN / completed.length * 100) : 0
    const fmtDur = avgMs ? (avgMs >= 48 * 3600000 ? Math.round(avgMs / 86400000) + 'd' : avgDurH + 'h') : '–'
    const rows = []
    rows.push({ id: 'all', label: '全部任务', icon: 'flag', count: d.quests.length })
    d.categories.forEach((c) => rows.push({ id: c, label: c, icon: 'folder', count: counts[c] || 0 }))
    return React.createElement('div', { className: 'qst-side' },
      React.createElement('div', { className: 'qst-side-title' }, '任务看板'),
      React.createElement('div', { className: 'qst-stat', title: '进行中 = 追踪中 + 进行中（未完成）' },
        React.createElement('span', null, '进行中 ', React.createElement('b', null, activeN)),
        React.createElement('span', null, '追踪 ', React.createElement('b', null, trackedN)),
        React.createElement('span', null, '完成 ', React.createElement('b', null, doneN))),
      React.createElement('div', { className: 'qst-stat', title: '本周完成 = 自然周（周一 0 点起）内完成数；平均耗时 = 已完成任务平均用时；超期率 = 已完成但超过到期日的比例' },
        React.createElement('span', null, '本周完成 ', React.createElement('b', null, weekDone)),
        React.createElement('span', null, '平均耗时 ', React.createElement('b', null, fmtDur)),
        React.createElement('span', null, '超期率 ', React.createElement('b', null, overduePct + '%'))),
      React.createElement('div', { className: 'qst-side-sep' }),
      rows.map((r) => React.createElement('div', { key: r.id, className: 'qst-side-item' + (s.cat === r.id ? ' active' : ''), onClick: () => patch({ cat: r.id, selected: null }), onContextMenu: (e) => { if (r.id === 'all') return; e.preventDefault(); patch({ menu: { kind: 'delcat', name: r.id, x: e.clientX, y: e.clientY } }) } },
        Icon(r.icon, s.cat === r.id ? '#c7b68c' : '#a49c8c', 12), r.label, React.createElement('span', { className: 'cnt' }, String(r.count)))),
      React.createElement('div', { key: 'add', className: 'qst-side-add', onClick: () => { if (!adding) setAdding(true) } },
        adding
          ? React.createElement('input', { value: catName, placeholder: '分类名称，回车确认', autoFocus: true, onChange: (e) => setCatName(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter') { addCategory(catName); setAdding(false); setCatName('') } if (e.key === 'Escape') { setAdding(false); setCatName('') } }, onClick: (e) => e.stopPropagation() })
          : React.createElement('span', null, '＋ 添加分类')),
      React.createElement('div', { className: 'qst-side-sep' }),
      React.createElement('div', { className: 'qst-side-add', onClick: () => patch({ modal: { kind: 'form' } }) }, React.createElement('span', null, '＋ 新建任务')),
    )
  }

  // ── 右侧任务列表 / 详情 ──
  function QuestList(props) {
    const s = props.s
    const d = s.data
    if (!d) return React.createElement('div', { className: 'qst-body' })
    const list = filtered(d, s)
    return React.createElement('div', { className: 'qst-body' },
      React.createElement('div', { className: 'qst-toolbar' },
        React.createElement('input', { className: 'qst-input', placeholder: '搜索任务…', value: s.search, onChange: (e) => patch({ search: e.target.value }) }),
        s.search ? React.createElement('button', { className: 'qst-btn-sm', title: '清除搜索', onClick: () => patch({ search: '' }) }, '✕') : null,
        // F15 状态多选：点击切换，默认「追踪中 + 进行中」
        React.createElement('div', { className: 'qst-filters', title: '状态多选（可多选；「全部」= 不过滤）' },
          [{ id: 'all', label: '全部' }, { id: 'tracked', label: '追踪中' }, { id: 'active', label: '进行中' }, { id: 'completed', label: '已完成' }, { id: 'abandoned', label: '已放弃' }].map((f) => {
            const cur = Array.isArray(s.statusFilter) ? s.statusFilter : []
            const on = cur.indexOf('all') >= 0 ? f.id === 'all' : cur.indexOf(f.id) >= 0
            return React.createElement('button', { key: f.id, className: 'qst-filter' + (on ? ' on' : ''), onClick: () => {
              let next
              if (f.id === 'all') next = ['all']
              else {
                const base = cur.indexOf('all') >= 0 ? [] : cur.slice()
                next = base.indexOf(f.id) >= 0 ? base.filter((x) => x !== f.id) : base.concat([f.id])
              }
              patch({ statusFilter: next })
            } }, f.label)
          })),
      ),
      list.length === 0
        ? React.createElement('div', { style: { color: '#7a7262', fontSize: 12, padding: 24, textAlign: 'center' } },
            React.createElement('div', { style: { fontSize: 28, marginBottom: 8 } }, '🗂️'),
            React.createElement('div', null, '没有符合条件的任务'),
            React.createElement('button', { className: 'qst-btn-sm primary', style: { marginTop: 12 }, onClick: () => patch({ modal: { kind: 'form' } }) }, '＋ 新建任务'))
        : list.map((q) => {
          const lvl = LEVELS[q.level - 1] || LEVELS[0]
          const st = STATUSES[q.status] || STATUSES.active
          const firstObj = q.objectives[0]
          const objText = firstObj ? firstObj.text + ' ' + Math.min(firstObj.current, firstObj.target) + '/' + firstObj.target : '（无目标）'
          const tl = timeLeft(q.dueAt)
          return React.createElement('div', { key: q.id, className: 'qst-quest' + (s.selected === q.id ? ' selected' : ''), onClick: () => patch({ selected: s.selected === q.id ? null : q.id }), onContextMenu: (e) => { e.preventDefault(); patch({ menu: { kind: 'quest', id: q.id, x: e.clientX, y: e.clientY } }) } },
            React.createElement('div', { className: 'qhead' },
              React.createElement('span', { className: 'tt', style: { color: lvl.color } }, q.title),
              React.createElement('span', { className: 'meta' }, lvl.label + ' · ' + st.label + (q.category ? ' · ' + q.category : '') + (s.processing === q.id ? ' ⏳处理中' : ''))),
            React.createElement('div', { className: 'qobj' }, objText, tl ? React.createElement('span', { style: { color: tl.color, marginLeft: 8, flex: 'none' } }, '⏳ ' + tl.label) : null))
        }))
  }

  function QuestDetail(props) {
    const s = props.s
    const q = findQuest(s.selected)
    if (!q) return null
    const lvl = LEVELS[q.level - 1] || LEVELS[0]
    const st = STATUSES[q.status] || STATUSES.active
    return React.createElement('div', { className: 'qst-detail' },
      React.createElement('div', { className: 'dt-head' },
        React.createElement('span', { className: 'dt-title', style: { color: lvl.color } }, q.title),
        React.createElement('span', { style: { fontSize: 12, color: '#a49c8c' } }, lvl.label + ' · ' + st.label + (q.category ? ' · ' + q.category : '') + (q.recur === 'daily' ? ' · 每日' : q.recur === 'weekly' ? ' · 每周' : '')),
      ),
      q.description ? React.createElement('div', { className: 'dt-desc' }, q.description) : null,
      React.createElement('div', null,
        React.createElement('div', { style: { fontSize: 12, color: '#a49c8c', marginBottom: 6 } }, '目标（' + q.objectives.filter((o) => o.current >= o.target).length + '/' + q.objectives.length + ' 完成）'),
        q.objectives.length === 0 ? React.createElement('div', { style: { color: '#7a7262', fontSize: 12 } }, '暂无目标，用「＋ 编辑」添加') : q.objectives.map((o) => {
          const done = o.current >= o.target
          const flashing = s.flash && s.flash.id === o.id
          return React.createElement('div', { key: o.id, className: 'qst-obj' + (done ? ' done' : '') + (flashing ? ' flash' : '') },
            React.createElement('span', { className: 'check', onClick: () => setObjDone(q, o.id, !done) }, done ? '✓' : ''),
            React.createElement('span', { className: 'qst-obj-text' }, o.text),
            React.createElement('span', { className: 'qst-obj-prog' + (done ? ' done' : '') }, String(Math.min(o.current, o.target)) + '/' + o.target),
            // F14：+1 / -1 双向调节（-1 即误点撤销）
            !done ? React.createElement('button', { className: 'qst-btn-sm', onClick: () => bumpObj(q, o.id, 1) }, '+1') : null,
            o.current > 0 ? React.createElement('button', { className: 'qst-btn-sm', title: '减少 1', onClick: () => bumpObj(q, o.id, -1) }, '-1') : null,
          )
        })),
      q.dueAt ? React.createElement('div', { style: { fontSize: 13, color: (timeLeft(q.dueAt) || { color: '#d8b558' }).color } }, '⏳ 到期：' + fmtDate(q.dueAt) + '（' + (timeLeft(q.dueAt) || { label: '' }).label + '）') : null,
      q.rewards ? React.createElement('div', { className: 'qst-rewards' }, '奖励：' + q.rewards) : null,
      // F8 操作分组：主操作（追踪/完成/发送）一行，次级（编辑/放弃）+ 危险（删除）一行隔离
      React.createElement('div', { className: 'qst-actions' },
        React.createElement('div', { className: 'qst-actions-row' },
          q.status === 'tracked'
            ? React.createElement('button', { className: 'qst-btn-sm', onClick: () => toggleTrack(q.id) }, '取消追踪')
            : React.createElement('button', { className: 'qst-btn-sm primary', onClick: () => toggleTrack(q.id) }, '追踪'),
          q.status !== 'completed'
            ? React.createElement('button', { className: 'qst-btn-sm primary', disabled: !canComplete(q), title: canComplete(q) ? '标记完成' : '还有目标未完成', onClick: () => setStatus(q.id, 'completed') }, '完成')
            : null,
          // 已完成的任务隐藏「发送对话」
          q.status !== 'completed' ? React.createElement('button', { className: 'qst-btn-sm', onClick: () => sendForProcessing(q) }, '发送对话') : null,
        ),
        React.createElement('div', { className: 'qst-actions-row secondary' },
          React.createElement('button', { className: 'qst-btn-sm', onClick: () => patch({ modal: { kind: 'form', id: q.id } }) }, '编辑'),
          q.status !== 'abandoned' ? React.createElement('button', { className: 'qst-btn-sm', onClick: () => setStatus(q.id, 'abandoned') }, '放弃') : null,
          React.createElement('span', { className: 'qst-actions-sep' }),
          React.createElement('button', { className: 'qst-btn-sm danger', onClick: () => patch({ modal: { kind: 'del', id: q.id } }) }, '删除'),
        ),
      ),
    )
  }

  // ── 任务表单（新建/编辑） ──
  function QuestFormModal(props) {
    const d = getStore().data
    const edit = props.id ? findQuest(props.id) : null
    const [title, setTitle] = React.useState(edit ? edit.title : '')
    const [level, setLevel] = React.useState(edit ? edit.level : 1)
    const [category, setCategory] = React.useState(edit ? edit.category : (d && d.categories[0]) || '')
    const [description, setDescription] = React.useState(edit ? edit.description : '')
    const [rewards, setRewards] = React.useState(edit ? edit.rewards : '')
    const [due, setDue] = React.useState(edit ? toLocalInput(edit.dueAt) : '')
    const [recur, setRecur] = React.useState(edit ? (edit.recur || '') : '')
    const [status, setStatus] = React.useState(edit ? edit.status : 'tracked')
    const [objectives, setObjectives] = React.useState(edit && edit.objectives.length ? edit.objectives.map((o) => ({ id: o.id, text: o.text, target: o.target, current: o.current })) : [{ id: 'o0', text: '', target: 1, current: 0 }])
    const close = () => patch({ modal: null })
    const save = () => saveQuest({ id: props.id, title: title, level: level, category: category, description: description, rewards: rewards, status: status, objectives: objectives, dueAt: fromLocalInput(due), recur: recur })
    // D3 模板：一键预填常用任务
    const TEMPLATES = [
      { label: '📆 每日打卡', apply: () => { setTitle('每日打卡'); setLevel(2); setCategory('日常'); setRecur('daily'); setObjectives([{ id: 'o' + Date.now().toString(36), text: '完成今日打卡目标', target: 1, current: 0 }]); setDue('') } },
      { label: '📝 周报总结', apply: () => { setTitle('周报总结'); setLevel(3); setCategory('日常'); setRecur('weekly'); setObjectives([{ id: 'o' + Date.now().toString(36), text: '总结本周进展', target: 1, current: 0 }]); setDue('') } },
      { label: '⚡ 通用任务', apply: () => { setTitle(''); setLevel(1); setCategory(''); setRecur(''); setObjectives([{ id: 'o' + Date.now().toString(36), text: '', target: 1, current: 0 }]); setDue('') } },
    ]
    return React.createElement(ModalShell, { title: edit ? '编辑任务' : '新建任务', onClose: close },
      edit ? null : React.createElement('div', { className: 'row', style: { marginBottom: 10, flexWrap: 'wrap' } },
        React.createElement('span', { style: { fontSize: 11, color: '#a49c8c' } }, '模板：'),
        TEMPLATES.map((tp) => React.createElement('button', { key: tp.label, className: 'qst-btn-sm', style: { marginLeft: 4 }, onClick: tp.apply }, tp.label))),
      React.createElement('div', { className: 'qst-field' }, React.createElement('label', null, '标题'), React.createElement('input', { className: 'qst-input in', value: title, onChange: (e) => setTitle(e.target.value) })),
      React.createElement('div', { className: 'row' },
        React.createElement('select', { className: 'qst-select', value: String(level), onChange: (e) => setLevel(Number(e.target.value)) }, LEVELS.map((l) => React.createElement('option', { key: l.id, value: String(l.id) }, l.label))),
        React.createElement('select', { className: 'qst-select grow', value: category, onChange: (e) => setCategory(e.target.value) }, (d ? d.categories : []).map((c) => React.createElement('option', { key: c, value: c }, c))),
        React.createElement('select', { className: 'qst-select', value: status, onChange: (e) => setStatus(e.target.value) }, STATUS_ORDER.map((st) => React.createElement('option', { key: st, value: st }, STATUSES[st].label))),
      ),
      React.createElement('div', { className: 'row' },
        React.createElement('select', { className: 'qst-select', value: recur, onChange: (e) => setRecur(e.target.value) },
          React.createElement('option', { value: '' }, '不重复'),
          React.createElement('option', { value: 'daily' }, '每日重复'),
          React.createElement('option', { value: 'weekly' }, '每周重复')),
        React.createElement('span', { style: { fontSize: 11, color: '#a49c8c' } }, '重复任务完成后自动重置到下一周期'),
      ),
      React.createElement('div', { className: 'qst-field' }, React.createElement('label', null, '描述'), React.createElement('textarea', { className: 'qst-ta', value: description, onChange: (e) => setDescription(e.target.value) })),
      React.createElement('div', { className: 'qst-field' }, React.createElement('label', null, '目标（只填内容即可，进度默认 0/1，之后在详情里 +1 推进）'),
        objectives.map((o, i) => React.createElement('div', { key: o.id, className: 'qst-obj-edit' },
          React.createElement('input', { className: 'qst-input', value: o.text, placeholder: '目标内容', onChange: (e) => setObjectives(objectives.map((x, j) => (j === i ? Object.assign({}, x, { text: e.target.value }) : x))) }),
          React.createElement('button', { className: 'del', onClick: () => setObjectives(objectives.filter((x, j) => j !== i)) }, '✕'),
        )),
        React.createElement('button', { className: 'qst-btn-sm', onClick: () => setObjectives(objectives.concat([{ id: 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: '', target: 1, current: 0 }])) }, '＋ 目标'),
      ),
      React.createElement('div', { className: 'qst-field' }, React.createElement('label', null, '奖励'), React.createElement('input', { className: 'qst-input in', value: rewards, onChange: (e) => setRewards(e.target.value) })),
      React.createElement('div', { className: 'qst-field' }, React.createElement('label', null, '到期时间（可留空）'), React.createElement('input', { className: 'qst-input in', type: 'datetime-local', value: due, onChange: (e) => setDue(e.target.value) })),
      React.createElement('div', { className: 'row', style: { justifyContent: 'flex-end', marginTop: 12 } },
        React.createElement('button', { className: 'qst-btn-sm', onClick: close }, '取消'),
        React.createElement('button', { className: 'qst-btn-sm primary', onClick: save }, edit ? '保存' : '创建'),
      ),
    )
  }

  function DelModal(props) {
    const q = findQuest(props.id)
    if (!q) return null
    const close = () => patch({ modal: null })
    return React.createElement(ModalShell, { title: '删除任务', onClose: close },
      React.createElement('div', { style: { marginBottom: 10 } }, React.createElement('b', { style: { color: '#c7b68c' } }, q.title)),
      React.createElement('div', { className: 'qst-danger' }, '确定删除这个任务吗？此操作不可恢复。'),
      React.createElement('div', { className: 'row', style: { justifyContent: 'flex-end', marginTop: 14 } },
        React.createElement('button', { className: 'qst-btn-sm', onClick: close }, '取消'),
        React.createElement('button', { className: 'qst-btn-sm danger', onClick: () => { removeQuest(q.id); close() } }, '确定删除'),
      ),
    )
  }

  function DelCategoryModal(props) {
    const d = getStore().data
    const name = props.name
    const count = d ? d.quests.filter((q) => q.category === name).length : 0
    const close = () => patch({ modal: null })
    return React.createElement(ModalShell, { title: '删除分类', onClose: close },
      React.createElement('div', { style: { marginBottom: 10 } }, React.createElement('b', { style: { color: '#c7b68c' } }, name),
        count > 0 ? React.createElement('span', { style: { color: '#a49c8c', marginLeft: 8 } }, count + ' 个任务将变为未分类') : null),
      React.createElement('div', { className: 'qst-danger' }, '确定删除这个分类吗？'),
      React.createElement('div', { className: 'row', style: { justifyContent: 'flex-end', marginTop: 14 } },
        React.createElement('button', { className: 'qst-btn-sm', onClick: close }, '取消'),
        React.createElement('button', { className: 'qst-btn-sm danger', onClick: () => { deleteCategory(name); close() } }, '删除'),
      ),
    )
  }

  function ModalShell(props) {
    return React.createElement('div', { className: 'qst-backdrop', onMouseDown: (e) => { if (e.target === e.currentTarget) props.onClose() } },
      React.createElement('div', { className: 'qst-modal' },
        React.createElement('div', { className: 'mt' }, props.title, React.createElement('span', { className: 'x', onClick: props.onClose }, '✕')),
        props.children,
      ),
    )
  }

  function ModalRouter(props) {
    const m = props.s.modal
    if (!m) return null
    if (m.kind === 'form') return React.createElement(QuestFormModal, { id: m.id })
    if (m.kind === 'del') return React.createElement(DelModal, { id: m.id })
    if (m.kind === 'delcat') return React.createElement(DelCategoryModal, { name: m.name })
    return null
  }

  function ToastView(props) {
    const t = props.s.toast
    React.useEffect(() => {
      const d = defer(() => patch({ toast: null }), 2600)
      return d
    }, [t && t.seq])
    if (!t) return null
    return React.createElement('div', { className: 'qst-toast', 'data-type': t.type || 'info' }, t.text)
  }

  function QuestMenu(props) {
    const s = props.s
    const m = s.menu
    if (!m) return null
    const close = () => patch({ menu: null })
    let rows = []
    if (m.kind === 'quest') {
      const q = findQuest(m.id)
      if (!q) return null
      rows = [
        { label: '打开详情', fn: () => { close(); patch({ selected: q.id }) } },
        // 已完成的任务隐藏「发送对话」与「完成」
        q.status !== 'completed' ? { label: '发送对话（Agent 处理）', icon: 'scroll', fn: () => { close(); sendForProcessing(q) } } : null,
        { label: q.status === 'tracked' ? '取消追踪' : '追踪任务', fn: () => { close(); toggleTrack(q.id) } },
        q.status !== 'completed' ? { label: '完成', fn: () => { close(); setStatus(q.id, 'completed') } } : null,
        { label: '编辑', fn: () => { close(); patch({ modal: { kind: 'form', id: q.id } }) } },
        'sep',
        { label: '删除', danger: true, fn: () => { close(); patch({ modal: { kind: 'del', id: q.id } }) } },
      ]
    } else if (m.kind === 'delcat') {
      rows = [{ label: '删除分类「' + m.name + '」', danger: true, fn: () => { close(); patch({ modal: { kind: 'delcat', name: m.name } }) } }]
    } else return null
    const w = typeof window !== 'undefined' ? window.innerWidth : 1200
    const h = typeof window !== 'undefined' ? window.innerHeight : 800
    return React.createElement('div', { className: 'qst-menu-backdrop', onMouseDown: close, onContextMenu: (e) => { e.preventDefault(); close() } },
      React.createElement('div', { className: 'qst-menu', style: { left: Math.max(4, Math.min(m.x || 0, w - 220)), top: Math.max(4, Math.min(m.y || 0, h - rows.filter(Boolean).length * 30 - 20)) }, onMouseDown: (e) => e.stopPropagation() },
        rows.filter(Boolean).map((r, i) => r === 'sep'
          ? React.createElement('div', { key: i, className: 'qst-menu-sep' })
          : React.createElement('div', { key: i, className: 'qst-menu-item' + (r.danger ? ' danger' : ''), onClick: r.fn }, Icon(r.icon || 'flag', r.danger ? '#ff6b5e' : '#c7b68c', 13), r.label))),
    )
  }

  function QuestPanel() {
    const s = useStore()
    const d = s.data
    const [pos, setPos] = usePanelPos('qst-panel-pos')
    const ref = React.useRef(null)
    React.useEffect(() => { if (!d) loadData() }, [d])
    if (!d) return React.createElement('div', { className: 'qst-panel' }, React.createElement('div', { className: 'qst-head' }, React.createElement('span', { className: 't' }, '任务'), React.createElement('span', { className: 's' }, '加载中…')))
    return React.createElement('div', Object.assign({ className: 'qst-panel', ref: ref }, pos ? { style: { left: pos.left, top: pos.top, transform: 'none' } } : null),
      React.createElement('div', { className: 'qst-head', style: { cursor: 'move' }, onMouseDown: (e) => dragStart(e, ref, setPos, 'qst-panel-pos') },
        React.createElement('span', { className: 't' }, '任务'),
        React.createElement('span', { className: 's' }, '按 L 开合 · 按住拖动 · 右键任务操作'),
        React.createElement('button', { className: 'qst-btn-sm', title: typeof Notification !== 'undefined' && Notification.permission === 'granted' ? '到期提醒已开启' : '开启到期提醒', onClick: enableNotifications }, typeof Notification !== 'undefined' && Notification.permission === 'granted' ? '🔔' : '🔕'),
        s.trackerHidden ? React.createElement('button', { className: 'qst-btn-sm', title: '显示追踪条', onClick: () => { patch({ trackerHidden: false }); try { window.localStorage.removeItem('ggame-tracker-hidden') } catch (e) { /* ignore */ } } }, '追踪条') : null,
        React.createElement('button', { className: 'qst-close', 'aria-label': '关闭任务面板', onClick: () => patch({ open: false }) }, '✕'),
      ),
      React.createElement('div', { className: 'qst-main' },
        React.createElement(Dashboard, { s: s }),
        // F11 经典 WoW 布局：左列表 + 右详情并排（选中任务后并排，不再来回切换）
        React.createElement('div', { style: { flex: 1, display: 'flex', minWidth: 0 } },
          React.createElement('div', { style: { flex: s.selected ? 1 : 1, minWidth: 0, display: 'flex', flexDirection: 'column' } },
            React.createElement(QuestList, { s: s })),
          s.selected
            ? React.createElement('div', { style: { flex: 1, minWidth: 0, borderLeft: '1px solid #332d25', display: 'flex', flexDirection: 'column' } },
              React.createElement(QuestDetail, { s: s }))
            : null,
        ),
      ),
    )
  }

  // ── 右侧任务追踪条 ──
  function QuestTracker() {
    const s = useStore()
    const d = s.data
    React.useEffect(() => { if (!d) loadData() }, [d])
    if (!d) return null
    // F17：可完全隐藏（localStorage 记住偏好）
    if (s.trackerHidden) return null
    const hideTracker = () => {
      patch({ trackerHidden: true, trackerCollapsed: false })
      try { window.localStorage.setItem('ggame-tracker-hidden', '1') } catch (e) { /* ignore */ }
    }
    const tracked = d.quests.filter((q) => q.status === 'tracked').sort((a, b) => a.order - b.order)
    if (s.trackerCollapsed) {
      return React.createElement('div', { className: 'qst-tracker', style: { width: 'auto', minWidth: 120 } },
        React.createElement('div', { className: 'qst-tracker-head', onClick: () => patch({ trackerCollapsed: false }) }, '任务', React.createElement('span', { className: 'x' }, '▸ 展开'), React.createElement('button', { className: 'qst-btn-sm', style: { padding: '0 6px', fontSize: 11 }, title: '隐藏追踪条', onClick: (e) => { e.stopPropagation(); hideTracker() } }, '✕')))
    }
    return React.createElement('div', { className: 'qst-tracker' },
      React.createElement('div', { className: 'qst-tracker-head', onClick: () => patch({ trackerCollapsed: true }) },
        Icon('tracker', '#c7b68c', 13), '任务', React.createElement('span', { className: 'x' }, tracked.length + ' 项 · ▾ 收起'), React.createElement('button', { className: 'qst-btn-sm', style: { padding: '0 6px', fontSize: 11 }, title: '隐藏追踪条', onClick: (e) => { e.stopPropagation(); hideTracker() } }, '✕')),
      React.createElement('div', { className: 'qst-tracker-body' },
        tracked.length === 0
          ? React.createElement('div', { className: 'qst-tracker-empty' }, '没有追踪中的任务。在任务面板里点「追踪」加入这里。')
          : tracked.map((q) => {
            const lvl = LEVELS[q.level - 1] || LEVELS[0]
            const tl = timeLeft(q.dueAt)
            return React.createElement('div', { key: q.id, className: 'qst-tq' },
              React.createElement('div', { className: 'name', style: { color: lvl.color }, onClick: () => { patch({ open: true, selected: q.id }) } }, q.title),
              tl ? React.createElement('div', { style: { fontSize: 10.5, color: tl.color, marginTop: 1 } }, '⏳ ' + tl.label) : null,
              React.createElement('div', { className: 'objs' }, q.objectives.map((o) => {
                const done = o.current >= o.target
                return React.createElement('div', { key: o.id, className: 'obj' + (done ? ' done' : '') },
                  React.createElement('span', { className: 'txt' }, o.text),
                  React.createElement('span', { className: 'prog' }, String(Math.min(o.current, o.target)) + '/' + o.target))
              })))
          })),
    )
  }

  // D1 到期浏览器通知：到期前 30 分钟内/已到期时提醒一次（按天去重）
  function checkDueNotifications() {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const d = getStore().data
    if (!d) return
    const now = Date.now()
    d.quests.forEach((q) => {
      if (q.status !== 'tracked' && q.status !== 'active') return
      if (!q.dueAt) return
      const diff = q.dueAt - now
      if (diff < -60 * 60 * 1000 || diff > 30 * 60 * 1000) return
      const day = new Date(now).toISOString().slice(0, 10)
      const key = 'ggame-qnotify-' + q.id + '-' + day
      try { if (window.localStorage.getItem(key)) return } catch (e) { /* ignore */ }
      try { window.localStorage.setItem(key, '1') } catch (e) { /* ignore */ }
      try { new Notification('⏳ 任务即将到期：' + q.title, { body: diff <= 0 ? '该任务已到期，请查看处理。' : '剩余时间不足 30 分钟。' }) } catch (e) { /* ignore */ }
    })
  }
  function enableNotifications() {
    if (typeof Notification === 'undefined') { toast('当前环境不支持浏览器通知', 'error'); return }
    if (Notification.permission === 'granted') { toast('到期提醒已开启', 'success'); return }
    Notification.requestPermission().then((p) => {
      toast(p === 'granted' ? '到期提醒已开启' : '通知权限被拒绝', p === 'granted' ? 'success' : 'error')
    })
  }

  function OverlayRoot() {
    const s = useStore()
    React.useEffect(() => {
      // 每分钟刷新一次，让剩余时间倒计时保持更新；顺带检查到期通知
      const t = setInterval(() => { patch({ tick: Date.now() }); checkDueNotifications() }, 60000)
      checkDueNotifications()
      return () => { try { clearInterval(t) } catch (e) {} }
    }, [])
    React.useEffect(() => {
      // 静默轮询：Agent 通过 quest_* 工具新建/修改任务后，面板与追踪条自动刷新（无需手动刷新网页）
      const t = setInterval(() => { loadData() }, 5000)
      return () => { try { clearInterval(t) } catch (e) {} }
    }, [])
    React.useEffect(() => {
      if (typeof window === 'undefined' || !window.addEventListener) return
      const onKey = (e) => {
        if (e.defaultPrevented) return
        const k = e.key
        if (k && k.toLowerCase() === 'l' && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const t = e.target
          const tag = t && t.tagName ? String(t.tagName) : ''
          if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return
          e.preventDefault()
          patch({ open: !getStore().open })
          return
        }
        // F12：Esc 关闭任务面板
        if (k === 'Escape' && getStore().open) { patch({ open: false }); return }
        // F12：/ 聚焦搜索（面板打开时）
        if (k === '/' && getStore().open) {
          const t = e.target
          const tag = t && t.tagName ? String(t.tagName) : ''
          if (tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) return
          e.preventDefault()
          const el = document.querySelector('.qst-panel .qst-input')
          if (el && el.focus) { try { el.focus() } catch (err) { /* ignore */ } }
        }
      }
      window.addEventListener('keydown', onKey, true)
      return () => { try { window.removeEventListener('keydown', onKey, true) } catch (e) {} }
    }, [])
    return React.createElement('div', { className: 'qst-root' },
      React.createElement(QuestButton, null),
      s.open ? React.createElement(QuestPanel, null) : null,
      React.createElement(QuestTracker, null),
      s.menu ? React.createElement(QuestMenu, { s: s }) : null,
      s.modal ? React.createElement(ModalRouter, { s: s }) : null,
      s.toast ? React.createElement(ToastView, { s: s }) : null,
    )
  }

  // 发送到对话桥：把 insert 请求写入输入框（与背包同机制）
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
    { name: 'shell.overlay', id: 'quest', order: 49, label: '任务' },
    () => React.createElement(OverlayRoot),
  ))

  slotsSvc.inject('conversation.input.left', () => slotsSvc.register(
    { name: 'conversation.input.left', id: 'quest-composer', order: 21, label: '任务' },
    (props) => React.createElement(ComposerBridge, props),
  ))
}

exports.apply = apply;
return module.exports;
	}
});
