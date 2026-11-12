import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "scanner-runtime-static-import",
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          // ONNX dynamically imports its copied runtime. Vite adds ?import,
          // which normally prevents public files from being served as modules.
          if (
            request.url?.startsWith("/ort/") &&
            request.url.endsWith(".mjs?import")
          ) {
            request.url = request.url.slice(0, -"?import".length);
          }
          next();
        });
      },
    },
  ],
  build: { target: "es2022" },
});
