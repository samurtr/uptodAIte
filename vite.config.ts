/// <reference types="node" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Path the app is served from. The GitHub Pages workflow sets BASE_PATH from
// actions/configure-pages (e.g. "/uptodaite" for a project site, "" for a user
// site or custom domain); locally it is "/".
const basePath = (process.env.BASE_PATH ?? '').replace(/^\/+|\/+$/g, '');
const base = basePath ? `/${basePath}/` : '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'uptodAIte',
        short_name: 'uptodAIte',
        description: 'The most-upvoted AI papers of the week or month, briefly explained.',
        lang: 'en',
        display: 'standalone',
        orientation: 'portrait',
        id: base,
        start_url: base,
        scope: base,
        theme_color: '#0d0f14',
        background_color: '#0d0f14',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
