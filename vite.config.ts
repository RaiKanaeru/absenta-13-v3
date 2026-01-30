import { defineConfig, loadEnv } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      // Host dan Port HANYA relevan untuk development lokal.
      // Di production, Nginx yang mengurus port 80/443.
      // Namun, biarkan untuk build (jika diperlukan)
      host: true, 
      port: Number.parseInt(env.VITE_FRONTEND_PORT) || 8080,

      // AllowedHosts/Proxy TIDAK dibutuhkan untuk production build
      // (Nginx yang akan melayani)
      
      // HAPUS TOTAL BAGIAN PROXY INI
      /*
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'https://api.absenta13.my.id',
          changeOrigin: true,
          secure: false,
          ws: true,
        }
      }
      */
    },

    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor': ['react', 'react-dom', 'react-router-dom'],
            'ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          }
        }
      },
      chunkSizeWarningLimit: 1000,
    },

    plugins: [
      react(),
    ],

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },

    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/setupTests.ts',
      css: true,
      exclude: [...configDefaults.exclude, "server/**", "server_modern.js"],
    },
  };
});
