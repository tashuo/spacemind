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
export function ensureOverlayMounted(): void {
  if (mounted) return

  // SPA(ChatGPT/Claude 都是)切路由时 content script 可能被重新执行 ——
  // 旧的 host 还挂在 DOM 上但 React root 已失联,先扫一遍清掉
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
}

// 显式拆卸入口 —— 主要给单测和未来的 disable 流程用,生产 content script 不主动调用
export function unmountOverlay(): void {
  if (!mounted) return
  mounted.root.unmount()
  mounted.host.remove()
  mounted = null
}
