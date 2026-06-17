// Stub so tooling that expects a standard Vite project (e.g. shadcn CLI) detects
// the framework. The app itself builds via electron.vite.config.ts; this file is
// not used by electron-vite, vitest, or the build.
import { defineConfig } from 'vite'

export default defineConfig({})
