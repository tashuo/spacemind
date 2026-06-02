import { defineConfig } from 'wxt'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'SpaceMind',
    description: 'Organize ChatGPT, Claude, Gemini, DeepSeek & Mistral conversations into project spaces. Local-first, no account, open source.',
    version: '1.0.0',
    homepage_url: 'https://github.com/tashuo/spacemind',
    permissions: ['storage'],
    host_permissions: [
      'https://chatgpt.com/*',
      'https://claude.ai/*',
      'https://gemini.google.com/*',
      'https://chat.deepseek.com/*',
      'https://chat.mistral.ai/*',
    ],
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
