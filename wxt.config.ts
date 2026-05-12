import { defineConfig } from 'wxt'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'SpaceMind',
    description: 'Cross-platform AI conversation manager with project spaces. Local-first, MIT.',
    version: '0.1.0',
    permissions: ['storage'],
    host_permissions: ['https://chatgpt.com/*', 'https://claude.ai/*'],
    action: {
      default_title: 'SpaceMind',
    },
    commands: {
      'open-overlay': {
        // Cmd+Shift+K 在 Mac Chrome 默认无绑定;Cmd+Shift+J 是下载页面冲突。
        // 用户可通过 chrome://extensions/shortcuts 自行改键。
        suggested_key: {
          default: 'Ctrl+Shift+K',
          mac: 'Command+Shift+K',
        },
        description: 'Toggle SpaceMind overlay on supported AI sites',
      },
    },
  },
})
