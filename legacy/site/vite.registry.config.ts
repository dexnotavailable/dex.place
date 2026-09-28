import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';
export default defineConfig({plugins:[react()],server:{host:'127.0.0.1',port:5194,strictPort:true},build:{target:'es2022',outDir:'dist-registry',emptyOutDir:true,copyPublicDir:false,rollupOptions:{input:resolve(process.cwd(),'registry.html')}}});
