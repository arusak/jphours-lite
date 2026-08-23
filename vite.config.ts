import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import yaml from '@rollup/plugin-yaml'
import { VitePWA } from 'vite-plugin-pwa'
// @ts-ignore
import { readableCssModules } from 'vite-plugin-readable-css-modules'

export default defineConfig({
  base: '/jphours-lite/',
  resolve: { tsconfigPaths: true },
  plugins: [
    react(),
    yaml(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'JPHours Rhythm Practice',
        short_name: 'JPHours',
        description: 'Build and run focused rhythm practice routines.',
        display: 'standalone',
        background_color: '#140B0A',
        theme_color: '#F7B84B',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: { navigateFallback: '/jphours-lite/index.html' },
    }),
    readableCssModules(),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
