// 让 `import css from '@/assets/foo.css?inline'` 这种 Vite ?inline 语法过 TS 检查 ——
// 没有这层声明,tsc --noEmit 会在 lib/overlay/mount.ts 上报 TS2307。
declare module '*.css?inline' {
  const css: string
  export default css
}
