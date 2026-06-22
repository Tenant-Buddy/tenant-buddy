import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

const umamiPlugin = () => ({
  name: 'umami',
  transformIndexHtml(html: string) {
    const id = process.env.VITE_UMAMI_WEBSITE_ID;
    if (!id) return html;
    const tag = `<script defer src="https://cloud.umami.is/script.js" data-website-id="${id}"></script>`;
    return html.replace('</head>', `  ${tag}\n  </head>`);
  },
});

export default defineConfig({
  base: '/',
  plugins: [
    tailwindcss(),
    vue(),
    umamiPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.svg'],
      manifest: {
        name: 'Tenant Buddy',
        short_name: 'TenantBuddy',
        description: 'Check-in and check-out task checklist for UK renters',
        theme_color: '#1e293b',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: 'icons/icon-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
          {
            src: 'icons/apple-touch-icon.svg',
            sizes: '180x180',
            type: 'image/svg+xml',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg}'],
        globIgnores: ['**/questions/**'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
