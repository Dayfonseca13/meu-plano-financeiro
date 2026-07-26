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
        name: 'patch-fetch-polyfills',
        transform(code, id) {
          let newCode = code;
          if (newCode.includes('global.fetch =')) {
            newCode = newCode.replace(/global\.fetch\s*=/g, 'global.__dummyFetch =');
          }
          if (newCode.includes('self.fetch =')) {
            newCode = newCode.replace(/self\.fetch\s*=/g, 'self.__dummyFetch =');
          }
          if (newCode.includes('window.fetch =')) {
            newCode = newCode.replace(/window\.fetch\s*=/g, 'window.__dummyFetch =');
          }
          if (newCode.includes('globalThis.fetch =')) {
            newCode = newCode.replace(/globalThis\.fetch\s*=/g, 'globalThis.__dummyFetch =');
          }
          if (newCode !== code) {
            return { code: newCode, map: null };
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
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
