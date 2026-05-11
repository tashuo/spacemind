import { defineConfig } from 'wxt'

// Tailwind v4 集成将在 Task 2 加入,这里先不导入 @tailwindcss/vite,避免 install 报缺包
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'SpaceMind',
    description: 'Cross-platform AI conversation manager with project spaces. Local-first, MIT.',
    version: '0.1.0',
    permissions: ['storage'],
    action: {
      default_title: 'SpaceMind',
    },
  },
})
