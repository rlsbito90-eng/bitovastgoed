import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Aparte Vite-server voor uitsluitend synthetische acceptatie; zonder Supabase/Vercel-plugins.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {host: '127.0.0.1', port: 4176, strictPort:true},
});
