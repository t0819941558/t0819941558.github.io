import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://t0819941558.github.io',
  output: 'static',
  integrations: [sitemap()],
  markdown: {
    shikiConfig: {
      theme: 'github-dark-default',
      wrap: true,
    },
  },
  vite: {
    build: {
      target: 'es2022',
      // Three.js WebGPU/TSL is intentionally isolated in an idle-loaded chunk.
      chunkSizeWarningLimit: 1000,
    },
  },
});
