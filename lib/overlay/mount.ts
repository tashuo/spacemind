import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import overlayCss from '@/assets/overlay.css?inline'
import { Overlay } from './Overlay'

// 给 host 元素一个固定 id,方便排错和 SPA 重入时清理旧实例
const HOST_ID = '__spacemind_overlay_host__'

let mounted: { host: HTMLElement; root: Root } | null = null

// 在宿主页面 body 上挂一个 Shadow Root,把 React 子树和 host 页面的 CSS / 事件世界完全隔离。
//
// 关键决策:
//   1. host 元素用 `all: initial` —— 防止宿主页的全局 `*` 或 reset 样式漏进来影响我们布局
//   2. host 用 `pointer-events: none`,内层挂载点用 `pointer-events: auto` ——
//      关闭时整个 host 透明且不挡点击;打开时只有 React 渲染的真实节点能截到点击
//   3. z-index 拉满到 2147483647 —— ChatGPT/Claude 自己用了多层 portal,留余量
//   4. open mode shadow —— devtools 能查到节点,排查样式比 closed mode 容易得多
//   5. CSS 通过 `<style>` 注入到 shadow 内部,确保 Tailwind utility 只对 overlay 生效
// 宿主页(Claude / ChatGPT 都是 Next.js App Router)用 React 18 hydrate <body>,
// 内容脚本在 document_idle 就往 body append 节点会让 client tree ≠ SSR tree → React #418。
// 即便 #418 是宿主页自己的 bug,recovery 时它有可能把整段 body fallback 重渲,把我们的 host 拍掉。
// 综合策略:
//   1. 延后到 window.load + 200ms 再挂载 —— hydration 与可能的 recovery 都走完了
//   2. 装一个 MutationObserver 监视 host 节点 —— 若真被宿主页摘掉,自动补回去
//      (最多接 5 次,防止真出 bug 时无限循环;正常场景重接 0~1 次足矣)
const REATTACH_LIMIT = 5
const MOUNT_DELAY_AFTER_LOAD_MS = 200

export function ensureOverlayMounted(): void {
  if (mounted) return
  const schedule = () => setTimeout(doMount, MOUNT_DELAY_AFTER_LOAD_MS)
  if (document.readyState === 'complete') {
    schedule()
  } else {
    window.addEventListener('load', schedule, { once: true })
  }
}

function doMount(): void {
  if (mounted) return

  // SPA 切路由时 content script 可能被重新执行 —— 旧 host 残留先扫掉
  document.getElementById(HOST_ID)?.remove()

  const host = document.createElement('div')
  host.id = HOST_ID
  host.style.cssText =
    'all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;'
  document.body.appendChild(host)

  const shadow = host.attachShadow({ mode: 'open' })

  // 必须先注入 style 再 render —— 否则首帧用户会看到无样式的 React 树闪一下
  const style = document.createElement('style')
  style.textContent = overlayCss
  shadow.appendChild(style)

  const rootEl = document.createElement('div')
  rootEl.style.pointerEvents = 'auto'
  shadow.appendChild(rootEl)

  const root = createRoot(rootEl)
  root.render(React.createElement(Overlay))

  mounted = { host, root }
  watchAndReattach(host)
}

function watchAndReattach(host: HTMLElement): void {
  let attempts = 0
  const observer = new MutationObserver(() => {
    if (document.contains(host)) return
    if (attempts++ >= REATTACH_LIMIT) {
      observer.disconnect()
      console.warn('[SpaceMind] overlay host removed too often, giving up')
      return
    }
    document.body.appendChild(host)
  })
  observer.observe(document.body, { childList: true })
}

// 显式拆卸入口 —— 主要给单测和未来的 disable 流程用,生产 content script 不主动调用
export function unmountOverlay(): void {
  if (!mounted) return
  mounted.root.unmount()
  mounted.host.remove()
  mounted = null
}
