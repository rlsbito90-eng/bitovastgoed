import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Geïsoleerde testserver zonder CRM/Supabase/Vercel plugin of databaseverkeer.
export default defineConfig({
 plugins:[react()],
 resolve:{alias:{'@':path.resolve(__dirname,'./src')}},
 server:{host:'127.0.0.1',port:4177,strictPort:true},
});
