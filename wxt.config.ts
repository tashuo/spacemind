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
    action: {
      default_title: 'SpaceMind',
    },
  },
})
