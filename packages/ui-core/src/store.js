// @ggame/ui-core —— 面板共享 store 模式（canonical 副本）。
// 各插件 src/client.js 内联了该模式并保持同步（packages/ui-core/scripts/sync-check.mjs 校验）。

/**
 * 建一个发布/订阅 store：
 *   let store = { ...initial }
 *   const patch = (p) => { store = Object.assign({}, store, p); listeners.forEach((f) => { try { f() } catch (e) {} }) }
 *   const getStore = () => store
 *   function useStore() { const [s, setS] = React.useState(store); React.useEffect(() => { const f = () => setS(store); listeners.add(f); return () => { listeners.delete(f) } }, []); return s }
 */
export const storePattern = `
  let store = { }
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
`

export default { storePattern }
