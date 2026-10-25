import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))

const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8'))

function licenseText(dir: string): string {
  const file = readdirSync(dir).find((f) => /^licen[cs]e/i.test(f))
  return file ? readFileSync(`${dir}/${file}`, 'utf8').trim() : ''
}

// licenses.txt next to the built page: the SRD credit, the sheet's license
// and the license of every npm package that ended up in the bundle
function licenses(): Plugin {
  return {
    name: 'licenses',
    apply: 'build',
    generateBundle(_, bundle) {
      const dirs = new Set<string>()
      for (const file of Object.values(bundle)) {
        if (file.type !== 'chunk') continue
        for (const id of Object.keys(file.modules)) {
          // helper modules of the commonjs plugin are prefixed with \0
          const m = id.replace(/^\0/, '').replace(/\\/g, '/').match(/^(.*\/node_modules\/(?:@[^/]+\/)?[^/]+)\//)
          if (m) dirs.add(m[1])
        }
      }
      const packages = new Map<string, string>()
      for (const dir of dirs) {
        const pkg = readJson(`${dir}/package.json`)
        const license = typeof pkg.license === 'string' ? pkg.license : pkg.license?.type
        packages.set(`${pkg.name} ${pkg.version}`, `${pkg.name} ${pkg.version} (${license})\n\n${licenseText(dir) || 'Лицензия: ' + license}`)
      }
      const parts = [
        'Конструктор персонажа D&D 2024 — авторство и лицензии',
        `${readJson(here('../dnd-db/data/meta.json')).attribution}\nМатериалы SRD переведены на русский и сокращены.`,
        `Лист персонажа основан на dnd-character-sheets (https://github.com/DarylBuckle/dnd-character-sheets)\n\n${licenseText(here('../dnd-sheet'))}`,
        ...[...packages.keys()].sort().map((key) => packages.get(key)!)
      ]
      this.emitFile({ type: 'asset', fileName: 'licenses.txt', source: parts.join(`\n\n${'='.repeat(72)}\n\n`) + '\n' })
    }
  }
}

// The sheet components come straight from ../dnd-sheet/src and the rules data
// from ../dnd-db/data, so edits there show up here without copying.
export default defineConfig({
  // relative paths: the build works from any folder, e.g. https://<login>.github.io/dnd-app/
  base: './',
  plugins: [react(), licenses()],
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
