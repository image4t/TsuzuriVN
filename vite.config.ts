import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {localAudio} from './server/localAudio';
export default defineConfig({plugins:[react(),localAudio()],server:{port:5175,strictPort:true},preview:{port:5175,strictPort:true}});
