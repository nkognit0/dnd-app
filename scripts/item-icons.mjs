// Copies item icons from a checkout of github.com/Gwillewyn/dnd-item-icons-by-gwill (CC BY 3.0)
// into public/icons/items/<item id>.svg for every database item that has one, and writes the
// list of those ids. Usage: node scripts/item-icons.mjs <path to the checkout>
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const library = join(process.argv[2] || '', 'Library')
const out = join(root, 'public', 'icons', 'items')
const equipment = JSON.parse(readFileSync(join(root, '..', 'dnd-db', 'data', 'equipment.json'), 'utf8'))

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))
const norm = (s) => s.toLowerCase().replace(/[’'`]/g, '').replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim()

const files = walk(library).filter((f) => f.endsWith('.svg'))
const byName = new Map()
for (const f of files) {
  const n = norm(basename(f, '.svg'))
  if (!byName.has(n)) byName.set(n, f)
}

// database names that differ from the icon file names (paths inside Library/)
const MANUAL = JSON.parse(readFileSync(join(root, 'scripts', 'item-icons.json'), 'utf8'))

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
const found = []
const missing = []
for (const e of equipment) {
  const manual = MANUAL[e.id]
  const file = manual ? join(library, manual) : byName.get(norm(e.name)) || byName.get(norm(e.name.replace(/^(.*), (.*)$/, '$2 $1')))
  if (!file) {
    missing.push(`${e.id} (${e.name}, ${e.category})`)
    continue
  }
  copyFileSync(file, join(out, `${e.id}.svg`))
  found.push(e.id)
}
// items without their own icon get a sack
copyFileSync(join(library, MANUAL._fallback), join(out, '_item.svg'))
writeFileSync(join(root, 'src', 'inventory', 'icon-ids.json'), JSON.stringify(found.sort(), null, 0) + '\n')
console.log(`icons: ${found.length} of ${equipment.length}`)
if (missing.length) console.log('no icon:\n  ' + missing.join('\n  '))
