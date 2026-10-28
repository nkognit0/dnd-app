// Copies of the two folders next to this one that the site is built from, kept in this
// repository so that GitHub Actions can build the site: the sheet sources (../dnd-sheet/src and
// its license) and the rules data (../dnd-db/data only — never the raw sources). Run it before a
// commit (`npm run vendor`; `npm run build` runs it too). Without the folders (on GitHub) the
// copies stay as they are.
import { cpSync, existsSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))

const COPIES = [
  ['../../dnd-sheet/src', '../vendor/dnd-sheet/src'],
  ['../../dnd-sheet/LICENSE', '../vendor/dnd-sheet/LICENSE'],
  ['../../dnd-db/data', '../vendor/dnd-db/data']
]

for (const [from, to] of COPIES) {
  if (!existsSync(here(from))) {
    console.log(`vendor: нет ${from.slice(3)}, копия остаётся прежней`)
    continue
  }
  rmSync(here(to), { recursive: true, force: true })
  cpSync(here(from), here(to), { recursive: true })
  console.log(`vendor: ${from.slice(3)} → ${to.slice(3)}`)
}
