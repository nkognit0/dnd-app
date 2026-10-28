import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))

const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8'))

// The sheet sources and the rules data come from the folders next to this one, so edits there
// show up here at once. Where they are missing (GitHub Actions) the copies in vendor/ are used:
// scripts/vendor.mjs refreshes them before a commit.
const SHEET = existsSync(here('../dnd-sheet/src')) ? here('../dnd-sheet') : here('vendor/dnd-sheet')
const DATA = existsSync(here('../dnd-db/data')) ? here('../dnd-db/data') : here('vendor/dnd-db/data')

function licenseText(dir: string): string {
  const file = readdirSync(dir).find((f) => /^licen[cs]e/i.test(f))
  return file ? readFileSync(`${dir}/${file}`, 'utf8').trim() : ''
}

// the item icons of the inventory (public/icons/items, copied by scripts/item-icons.mjs)
const ITEM_ICONS = [
  'Иконки предметов: D&D Item Icons by Gwillewyn (https://github.com/Gwillewyn/dnd-item-icons-by-gwill),',
  'основаны на иконках game-icons.net (авторы Lorc, Delapouite и другие, https://game-icons.net/).',
  'Лицензия Creative Commons Attribution 3.0 Unported: https://creativecommons.org/licenses/by/3.0/',
  'Иконки использованы без изменений; файлы переименованы по id предметов.'
].join('\n')

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
        `${readJson(`${DATA}/meta.json`).attribution}\nМатериалы SRD переведены на русский и сокращены.`,
        `Лист персонажа основан на dnd-character-sheets (https://github.com/DarylBuckle/dnd-character-sheets)\n\n${licenseText(SHEET)}`,
        ITEM_ICONS,
        ...[...packages.keys()].sort().map((key) => packages.get(key)!)
      ]
      this.emitFile({ type: 'asset', fileName: 'licenses.txt', source: parts.join(`\n\n${'='.repeat(72)}\n\n`) + '\n' })
    }
  }
}

export default defineConfig({
  // relative paths: the build works from any folder, e.g. https://<login>.github.io/dnd-app/
  base: './',
  plugins: [react(), licenses()],
  resolve: {
    alias: {
      '@data': DATA,
      'dnd-sheet': `${SHEET}/src/index.tsx`
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
