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
        suggested_key: {
          default: 'Ctrl+Shift+J',
          mac: 'Command+Shift+J',
        },
        description: 'Toggle SpaceMind overlay on supported AI sites',
      },
    },
  },
})
