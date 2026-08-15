// @ggame/ui-core —— 面板拖拽助手（canonical 副本，与插件内联版本同步）。

/** 面板拖拽：按住头部拖动（跳过按钮），位置持久化到 localStorage。 */
export const dragStart = `
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
`
