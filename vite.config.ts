import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'patch-formdata-polyfill',
        transform(code, id) {
          if (code.includes('global.fetch = function')) {
            const patched = code.replace(
              /if\s*\(\s*_fetch\s*\)\s*\{\s*global\.fetch\s*=\s*function\s*\(\s*input\s*,\s*init\s*\)\s*\{([\s\S]*?\}\s*\n*\s*\})/g,
              (match, p1) => {
                return `if (_fetch) { try { global.fetch = function (input, init) {${p1} catch (e) { console.warn("Failed to patch global.fetch:", e); } }`;
              }
            );
            return {
              code: patched,
              map: null
            };
          }
          return null;
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
