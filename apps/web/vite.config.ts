import { defineConfig } from "vite"
import appPlugin from "./vite"

export default defineConfig({
  plugins: [appPlugin] as any,
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    port: 4096,
  },
  build: {
    target: "esnext",
    // sourcemap: true,
  },
})
