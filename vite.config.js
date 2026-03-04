import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifestFilename: 'manifest.json',
      includeAssets: ['pwa-icon.svg'],
      manifest: {
        name: 'RepRoad Gym Tracker',
        short_name: 'RepRoad',
        description: 'Track custom workouts, routines, and strength progress.',
        start_url: '/',
        display: 'standalone',
        background_color: '#0b0b0b',
        theme_color: '#0b0b0b',
        orientation: 'portrait',
        icons: [
          {
            src: '/pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
})
