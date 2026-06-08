import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(() => {
  return {
    base: "./",
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "prompt",
        workbox: {
          // Жорстко кешуємо всі перелічені типи файлів під час встановлення
          globPatterns: [
            "**/*.{js,css,html,ico,png,svg,webmanifest,woff,woff2}",
          ],
          cleanupOutdatedCaches: true, // Видаляє старий кеш при оновленні версії
          runtimeCaching: [
            {
              // Кешуємо запити до погодного API (Open-Meteo) під час роботи
              urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/i,
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "weather-api-cache",
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // Зберігати останні дані 7 днів
                },
                cacheableResponse: {
                  statuses: [0, 200], // Кешуємо лише успішні відповіді
                },
              },
            },
          ],
        },
        manifest: {
          name: "Geo-Inertial Telemetry v3",
          short_name: "Telemetry v3",
          theme_color: "#020617",
          background_color: "#020617",
          display: "standalone",
          start_url: "./",
          icons: [
            { src: "icon-512.png", sizes: "192x192", type: "image/png" },
            {
              src: "icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== "true",
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === "true" ? null : {},
    },
  };
});
