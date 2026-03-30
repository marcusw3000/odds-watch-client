import { defineConfig } from "vite";
import { reactRouter } from "@react-router/dev/vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode, isSsrBuild }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [reactRouter()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-router", "react-router-dom", "@tanstack/react-query"],
  },
  build: {
    rollupOptions: {
      output: isSsrBuild ? undefined : {
        manualChunks: {
          'vendor-charts': ['recharts'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
        },
      },
    },
    // The heaviest lazy chunks are export-only libraries loaded on demand.
    chunkSizeWarningLimit: 1000,
    // Enable minification
    minify: 'esbuild',
    // Target modern browsers for smaller bundle
    target: 'es2020',
  },
}));
