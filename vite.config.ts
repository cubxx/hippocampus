import tailwind from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'client',
  plugins: [tailwind()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': `http://127.0.0.1:${process.env.PROT ?? 3000}`,
    },
  },
});
