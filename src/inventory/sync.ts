// The inventory (the cells and what the hero wears) and the «Снаряжение» fields of the sheet
// (equipment, equipment2) list the same things, so the game master sees everything on the sheet. A change on either side is written
// to the other: the inventory rewrites only the entries of the things it changed, and an edit
// of the fields rebuilds the cells from the entries. An entry whose name is in the database is
// that item; any other entry is a thing of the player's own, shown with the sack icon.
import type { DnDCharacter } from 'dnd-sheet'
import { byId } from '../data'
import { norm, splitEntry } from '../wiki/lookup'
import { Slot, slotName, unitQty } from './inventory'
import { Bag, Place, WORN, at, autoEquip, bagFields, bagOf, kindOf } from './worn'
import { gearPatch, rowWeapon } from './gear'

const FIELDS = ['equipment', 'equipment2'] as const
type Field = (typeof FIELDS)[number]

// one key per kind of thing: items by id, own things by name
const slotKey = (s: Slot) => (s.id !== undefined ? s.id : '~' + norm(s.name))

// how many of the thing a cell holds: a bundle of ammunition, otherwise one
const unitOf = (s: Slot) => (s.id && byId.item[s.id] ? unitQty(byId.item[s.id]) : 1)

interface Entry {
  field: Field
  // its index among the field's parts
  at: number
  lead: string
  name: string
  note: string
  // the number in the text: pieces of ammunition, things otherwise
  amount: number
  slot: Slot
}

interface Count {
  slot: Slot
  cells: number
}

// entries at even indices, separators («,», «;», line breaks) at odd ones
function read(c: DnDCharacter) {
  const parts = {} as Record<Field, (string | null)[]>
  const entries: Entry[] = []
  for (const field of FIELDS) {
    parts[field] = String(c[field] ?? '').split(/([,;\n])/)
    parts[field].forEach((p, at) => {
      if (at % 2 || !p) return
      const e = splitEntry(p, 'equipment')
      if (!e.name) return
      const slot: Slot = e.ref ? { id: e.ref.id } : { name: e.name }
      entries.push({ field, at, lead: p.slice(0, e.lead), name: e.name, note: e.note, amount: e.count ?? unitOf(slot), slot })
    })
  }
  return { parts, entries }
}

// the cells the fields ask for, by key
function listed(entries: Entry[]): Map<string, Count> {
  const amounts = new Map<string, { slot: Slot; amount: number }>()
  for (const e of entries) {
    const k = slotKey(e.slot)
    const a = amounts.get(k) || { slot: e.slot, amount: 0 }
    a.amount += e.amount
    amounts.set(k, a)
  }
  return new Map([...amounts].map(([k, a]) => [k, { slot: a.slot, cells: Math.ceil(a.amount / unitOf(a.slot)) }]))
}

function counted(bag: Bag): Map<string, Count> {
  const out = new Map<string, Count>()
  for (const s of [...bag.cells, ...Object.values(bag.worn)]) {
    if (!s) continue
    const k = slotKey(s)
    out.set(k, { slot: s, cells: (out.get(k)?.cells ?? 0) + 1 })
  }
  return out
}

// The cells for the fields as they are now: things no longer listed go (from the last cells
// first, what the hero wears last), new things take the first free cells. With `keep` nothing
// is taken out (an old save is opened). Things that do not fit stay in the fields only.
export function inventoryFromText(c: DnDCharacter, keep = false): Bag {
  const want = listed(read(c).entries)
  const bag = bagOf(c)
  const have = new Map<string, Place[]>()
  const places: Place[] = [...WORN, ...bag.cells.map((_, i) => i)]
  for (const p of places) {
    const s = at(bag, p)
    if (s) have.set(slotKey(s), [...(have.get(slotKey(s)) || []), p])
  }
  const set = (p: Place, s: Slot | null) => {
    if (typeof p === 'number') bag.cells[p] = s
    else bag.worn[p] = s
  }
  for (const [k, ps] of have) {
    const w = want.get(k)
    if (!keep) for (const p of ps.slice(w?.cells ?? 0)) set(p, null)
    // an own thing takes the spelling it now has in the fields
    if (w && !w.slot.id) for (const p of ps) if (at(bag, p)) set(p, { ...w.slot })
  }
  for (const [k, w] of want) {
    for (let n = w.cells - (have.get(k)?.length ?? 0); n > 0; n--) {
      const free = bag.cells.indexOf(null)
      if (free < 0) return bag
      bag.cells[free] = { ...w.slot }
    }
  }
  return bag
}

// «×2»; ammunition always shows its number of pieces
const amountText = (n: number, unit: number) => (n > 1 || unit > 1 ? ` ×${n}` : '')

// the field without the removed entries (null)
function join(parts: (string | null)[]): string {
  let out = ''
  let prev = -1
  for (let i = 0; i < parts.length; i += 2) {
    const e = parts[i]
    if (e == null) continue
    if (prev < 0) out += i === 0 ? e : e.replace(/^\s+/, '')
    else if (i === prev + 2) out += parts[i - 1] + e
    else {
      // entries were removed in between: one separator stays, a line break if there was one
      const seps = parts.slice(prev + 1, i).filter((_, k) => k % 2 === 0)
      const sep = seps.includes('\n') ? '\n' : seps[0]!
      out += sep + (sep === '\n' ? e.replace(/^[ \t]+/, '') : e.replace(/^[ \t]*/, ' '))
    }
    prev = i
  }
  return out
}

function append(text: string, entries: string[]): string {
  const base = text.replace(/\s+$/, '')
  if (!base) return entries.join(', ')
  // a list written one per line goes on that way
  const sep = base.includes('\n') && !base.includes(',') ? '\n' : ', '
  return base + (/[,;]$/.test(base) ? ' ' : sep) + entries.join(sep)
}

// Changes the number of cells of some things in the fields: the first entry of a thing takes
// the new number and its repeats go; a thing not listed yet is added at the end of the list.
function rewrite(c: DnDCharacter, delta: Map<string, Count>): Partial<DnDCharacter> {
  if (!delta.size) return {}
  const { parts, entries } = read(c)
  const added: string[] = []
  for (const [k, d] of delta) {
    const unit = unitOf(d.slot)
    const mine = entries.filter((e) => slotKey(e.slot) === k)
    const amount = mine.reduce((s, e) => s + e.amount, 0) + d.cells * unit
    mine.forEach((e, i) => {
      parts[e.field][e.at] = i === 0 && amount > 0 ? e.lead + e.name + amountText(amount, unit) + (e.note ? ' ' + e.note : '') : null
    })
    if (!mine.length && amount > 0) added.push(slotName(d.slot) + amountText(amount, unit))
  }
  const text = { equipment: join(parts.equipment), equipment2: join(parts.equipment2) }
  if (added.length) {
    // the end of the list: the second column once it is in use
    const f: Field = text.equipment2.trim() ? 'equipment2' : 'equipment'
    text[f] = append(text[f], added)
  }
  const out: Partial<DnDCharacter> = {}
  for (const f of FIELDS) if (text[f] !== String(c[f] ?? '')) out[f] = text[f]
  return out
}

// the inventory changed (a thing got, deleted or moved): the fields, the attack table and the
// armour class follow
export function withBag(c: DnDCharacter, next: Bag): DnDCharacter {
  const before = counted(bagOf(c))
  const after = counted(next)
  const delta = new Map<string, Count>()
  for (const k of new Set([...before.keys(), ...after.keys()])) {
    const d = (after.get(k)?.cells ?? 0) - (before.get(k)?.cells ?? 0)
    if (d) delta.set(k, { slot: (after.get(k) || before.get(k))!.slot, cells: d })
  }
  return { ...c, ...rewrite(c, delta), ...gearPatch(c, next.worn), ...bagFields(next) }
}

// the fields were edited: the cells follow (and the sheet, if a thing the hero wore is gone)
export function withEquipmentText(c: DnDCharacter): DnDCharacter {
  const bag = inventoryFromText(c)
  return { ...c, ...gearPatch(c, bag.worn), ...bagFields(bag) }
}

// An opened save: old stacks become cells, cells are added for listed things, and things only
// in the inventory (bought before the two were kept in step) are written into the fields. A save
// from before the hero could wear things is dressed in what its sheet already counts: the best
// armour it is trained in, a shield, the weapons of its attack table.
export function syncSaved(c: DnDCharacter): DnDCharacter {
  if (!c.equipment && !c.equipment2 && !Array.isArray(c.inventory)) return c
  const bag = bagOf(c)
  const inText = listed(read(c).entries)
  const delta = new Map<string, Count>()
  for (const [k, h] of counted(bag)) {
    const d = h.cells - (inText.get(k)?.cells ?? 0)
    if (d > 0) delta.set(k, { slot: h.slot, cells: d })
  }
  let next = inventoryFromText({ ...c, ...bagFields(bag) }, true)
  if (!c.worn) next = autoEquip(next, dressedBefore(c, next))
  return { ...c, ...rewrite(c, delta), ...bagFields(next) }
}

function dressedBefore(c: DnDCharacter, bag: Bag) {
  const trained = (t: string) => Boolean(c[{ light: 'armorLight', medium: 'armorMedium', heavy: 'armorHeavy' }[t] || ''])
  const armor = bag.cells
    .map((s) => (s?.id ? byId.armor[s.id] : undefined))
    .filter((a) => a && a.type !== 'shield' && trained(a.type))
    .sort((a, b) => (b!.armor_class.base ?? 0) - (a!.armor_class.base ?? 0))[0]
  const names = [...(c.attacks || []).map((r) => String(r?.name ?? '')), ...String(c.attacksText ?? '').split('\n')]
  return {
    armor: armor?.id ?? null,
    shield: Boolean(c.armorShields) && bag.cells.some((s) => kindOf(s) === 'shield'),
    weapons: names.map(rowWeapon).filter((id): id is string => !!id)
  }
}
