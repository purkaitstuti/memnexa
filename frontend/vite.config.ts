import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// /api is proxied to FastAPI so the session cookie is same-origin in development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: ["memnexa.onrender.com"],
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});