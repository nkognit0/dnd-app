import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// The sheet components come straight from ../dnd-sheet/src and the rules data
// from ../dnd-db/data, so edits there show up here without copying.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@data': here('../dnd-db/data'),
      'dnd-sheet': here('../dnd-sheet/src/index.tsx')
    },
    // one React for the app and the sheet sources
    dedupe: ['react', 'react-dom']
  },
  server: {
    // 127.0.0.1, not "localhost": on Node 17+ that may bind to IPv6 ::1 only
    host: '127.0.0.1',
    port: 5174,
    fs: { allow: [here('..')] }
  },
  test: {
    environment: 'node'
  }
})
