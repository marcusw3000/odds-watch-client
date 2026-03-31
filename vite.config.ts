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
      output:
        isSsrBuild
          ? undefined
          : {
              manualChunks(id) {
                if (!id.includes("node_modules")) {
                  return;
                }

                // Keep the React/runtime stack separate so route-level libraries
                // like Recharts do not pull core framework code into public pages.
                if (
                  id.includes("node_modules/react/") ||
                  id.includes("node_modules/react-dom/") ||
                  id.includes("node_modules/scheduler/")
                ) {
                  return "vendor-react";
                }

                if (
                  id.includes("node_modules/react-router/") ||
                  id.includes("node_modules/react-router-dom/") ||
                  id.includes("node_modules/@remix-run/router/")
                ) {
                  return "vendor-router";
                }

                if (id.includes("node_modules/@tanstack/react-query/")) {
                  return "vendor-query";
                }

                if (
                  id.includes("node_modules/class-variance-authority/") ||
                  id.includes("node_modules/clsx/") ||
                  id.includes("node_modules/tailwind-merge/")
                ) {
                  return "vendor-styling";
                }

                if (id.includes("node_modules/@radix-ui/react-tooltip/")) {
                  return "vendor-radix-tooltip";
                }

                if (id.includes("node_modules/@radix-ui/react-accordion/")) {
                  return "vendor-radix-accordion";
                }

                if (id.includes("node_modules/@radix-ui/react-separator/")) {
                  return "vendor-radix-separator";
                }

                if (id.includes("node_modules/recharts/")) {
                  return "vendor-charts";
                }

                if (
                  id.includes("node_modules/@supabase/supabase-js/") ||
                  id.includes("node_modules/@supabase/ssr/")
                ) {
                  return "vendor-supabase";
                }

                if (
                  id.includes("node_modules/react-hook-form/") ||
                  id.includes("node_modules/@hookform/resolvers/") ||
                  id.includes("node_modules/zod/")
                ) {
                  return "vendor-forms";
                }

                if (
                  id.includes("node_modules/@sentry/") ||
                  id.includes("node_modules/web-vitals/")
                ) {
                  return "vendor-monitoring";
                }

                if (
                  id.includes("node_modules/@radix-ui/") ||
                  id.includes("node_modules/cmdk/") ||
                  id.includes("node_modules/vaul/") ||
                  id.includes("node_modules/embla-carousel-") ||
                  id.includes("node_modules/react-day-picker/") ||
                  id.includes("node_modules/react-resizable-panels/") ||
                  id.includes("node_modules/input-otp/")
                ) {
                  return "vendor-ui";
                }
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
