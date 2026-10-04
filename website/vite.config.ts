import { defineConfig, loadEnv } from "vite";
import type { IndexHtmlTransformContext } from "vite";
import fs from "node:fs";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { fetchPagePreview, mergePagePreview, isPublicPreviewPath } from "./share-preview.mjs";
import { resolveApiBase } from "./api-base.mjs";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    /**
     * Pre-transform the public site's dependency graph at boot.
     *
     * Vite transforms a module the first time something asks for it, so the
     * very first visit to a page pays for its whole import tree. Naming the
     * landing page here moves that cost to server start, where nobody is
     * waiting on it.
     */
    warmup: {
      clientFiles: [
        "./src/main.tsx",
        "./src/App.tsx",
        "./src/pages/onboarding/**/*.tsx",
        "./src/components/layout/*.tsx",
        "./src/shared/components/EnhancedLoginPage.tsx",
      ],
    },
  },
  plugins: [react(), mode === "development" && componentTagger(), {
    name: "activ-api-prefetch-base",
    transformIndexHtml: {
      order: "pre" as const,
      handler(html: string, context: IndexHtmlTransformContext) {
        const env = loadEnv(mode, process.cwd(), "VITE_");
        const api = resolveApiBase(process.env.VITE_API_URL || env.VITE_API_URL, { development: !!context.server });
        // The early CMS prefetch runs before React. It must not populate the
        // page cache from the retired API while the app uses the current one.
        return html.replaceAll("%VITE_API_URL%", api);
      },
    },
  }, {
    name: "activ-local-share-previews",
    transformIndexHtml: {
      order: "post" as const,
      async handler(html: string, context: IndexHtmlTransformContext) {
        if (!context.server) return html;
        const request = new URL(context.originalUrl || context.path, "http://localhost:8080");
        if (request.searchParams.get("ref") === "share" || !isPublicPreviewPath(request.pathname)) return html;
        const env = loadEnv(mode, process.cwd(), "VITE_");
        const api = resolveApiBase(process.env.VITE_API_URL || env.VITE_API_URL, { development: true });
        const preview = await fetchPagePreview(api, request.pathname);
        return preview ? mergePagePreview(html, preview) : html;
      },
    },
  }, {
    name: "activ-preview-config",
    closeBundle() {
      const env = loadEnv(mode, process.cwd(), "VITE_");
      // Only public URLs already embedded in the browser bundle. The Node
      // server needs the same API address when Dokploy has no runtime override.
      fs.writeFileSync(path.resolve(__dirname, "dist/site-config.json"), JSON.stringify({
        apiUrl: resolveApiBase(process.env.VITE_API_URL || env.VITE_API_URL),
        siteUrl: process.env.VITE_PUBLIC_SITE_URL || env.VITE_PUBLIC_SITE_URL || "",
      }));
    },
  }].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    /**
     * Split the vendor libraries out of the entry chunk.
     *
     * Route-level `lazy()` in App.tsx splits our own pages; without this the
     * libraries they share would all be hoisted back into the entry chunk and
     * undo most of it. These three groups are the large ones, and they change
     * far less often than application code — so a deploy that touches a page
     * leaves them cached in the browser.
     */
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-ui": [
            "lucide-react",
            "react-icons",
            "sonner",
            "class-variance-authority",
            "clsx",
            "tailwind-merge",
          ],
          "vendor-data": ["axios", "@tanstack/react-query"],
        },
      },
    },
    // The entry chunk is comfortably under this now; the warning only fires if
    // something starts pulling the admin panels back into it.
    chunkSizeWarningLimit: 700,
  },
  /**
   * Strip debug logging from production builds.
   *
   * `console.error` and `console.warn` survive — a real failure should still be
   * visible in a user's console when they report a problem. What goes is the
   * `console.log` tracing left behind during development, which was writing to
   * the console on almost every admin page load.
   */
  esbuild: {
    pure: mode === "development" ? [] : ["console.log", "console.debug"],
  },
}));
