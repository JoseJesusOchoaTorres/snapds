// vite.config.ts
import { defineConfig } from "file:///Users/josejesusochoatorres/src/builder/node_modules/.pnpm/vite@5.4.21_@types+node@20.19.42/node_modules/vite/dist/node/index.js";
import react from "file:///Users/josejesusochoatorres/src/builder/node_modules/.pnpm/@vitejs+plugin-react@4.7.0_vite@5.4.21_@types+node@20.19.42_/node_modules/@vitejs/plugin-react/dist/index.js";
import { resolve } from "node:path";
var __vite_injected_original_dirname = "/Users/josejesusochoatorres/src/builder/webview-props";
var vite_config_default = defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: resolve(__vite_injected_original_dirname, "dist"),
    emptyOutDir: true,
    assetsInlineLimit: 1e5,
    target: "es2022",
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        entryFileNames: "assets/index.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]"
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvam9zZWplc3Vzb2Nob2F0b3JyZXMvc3JjL2J1aWxkZXIvd2Vidmlldy1wcm9wc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL2pvc2VqZXN1c29jaG9hdG9ycmVzL3NyYy9idWlsZGVyL3dlYnZpZXctcHJvcHMvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL2pvc2VqZXN1c29jaG9hdG9ycmVzL3NyYy9idWlsZGVyL3dlYnZpZXctcHJvcHMvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgeyByZXNvbHZlIH0gZnJvbSAnbm9kZTpwYXRoJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3JlYWN0KCldLFxuICBiYXNlOiAnLi8nLFxuICBidWlsZDoge1xuICAgIG91dERpcjogcmVzb2x2ZShfX2Rpcm5hbWUsICdkaXN0JyksXG4gICAgZW1wdHlPdXREaXI6IHRydWUsXG4gICAgYXNzZXRzSW5saW5lTGltaXQ6IDEwMF8wMDAsXG4gICAgdGFyZ2V0OiAnZXMyMDIyJyxcbiAgICBjc3NDb2RlU3BsaXQ6IGZhbHNlLFxuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIG91dHB1dDoge1xuICAgICAgICBlbnRyeUZpbGVOYW1lczogJ2Fzc2V0cy9pbmRleC5qcycsXG4gICAgICAgIGNodW5rRmlsZU5hbWVzOiAnYXNzZXRzL1tuYW1lXS5qcycsXG4gICAgICAgIGFzc2V0RmlsZU5hbWVzOiAnYXNzZXRzL1tuYW1lXVtleHRuYW1lXScsXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBaVYsU0FBUyxvQkFBb0I7QUFDOVcsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsZUFBZTtBQUZ4QixJQUFNLG1DQUFtQztBQUl6QyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsRUFDakIsTUFBTTtBQUFBLEVBQ04sT0FBTztBQUFBLElBQ0wsUUFBUSxRQUFRLGtDQUFXLE1BQU07QUFBQSxJQUNqQyxhQUFhO0FBQUEsSUFDYixtQkFBbUI7QUFBQSxJQUNuQixRQUFRO0FBQUEsSUFDUixjQUFjO0FBQUEsSUFDZCxlQUFlO0FBQUEsTUFDYixRQUFRO0FBQUEsUUFDTixnQkFBZ0I7QUFBQSxRQUNoQixnQkFBZ0I7QUFBQSxRQUNoQixnQkFBZ0I7QUFBQSxNQUNsQjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
