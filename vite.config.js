import { defineConfig } from 'vite';
import what from 'what-compiler/vite';

export default defineConfig({
  plugins: [what()],
  build: {
    outDir: 'dist/static',
    emptyOutDir: true,
  },
});
