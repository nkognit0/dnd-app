// What the hero wears and holds, as in computer RPGs: armour, clothes and two sets of hands
// (field `worn`). The hands follow D&D: two hands hold two one-handed weapons, a weapon and a
// shield, or one two-handed weapon. The second set is ready to switch to, like the weapon sets
// of Pillars of Eternity: in D&D 2024 drawing a weapon is part of an attack. Only the first set
// is in hands, so only its shield counts for the armour class.
import type { DnDCharacter } from 'dnd-sheet'
import { byId } from '../data'
import { Inventory, Slot, inventoryOf, toSlot } from './inventory'

export const WORN = ['armor', 'clothes', 'main1', 'off1', 'main2', 'off2'] as const
export type WornPlace = (typeof WORN)[number]
export type Worn = Record<WornPlace, Slot | null>
// a cell of the grid (its index) or a place on the hero
export type Place = number | WornPlace

export interface Bag {
  cells: Inventory
  worn: Worn
}

export const NO_WORN: Worn = { armor: null, clothes: null, main1: null, off1: null, main2: null, off2: null }

export function wornOf(c: DnDCharacter): Worn {
  const raw = (c.worn && typeof c.worn === 'object' ? c.worn : {}) as Record<string, unknown>
  const out = { ...NO_WORN }
  for (const p of WORN) out[p] = toSlot(raw[p])
  return out
}

export const bagOf = (c: DnDCharacter): Bag => ({ cells: inventoryOf(c), worn: wornOf(c) })
export const bagFields = (b: Bag): Partial<DnDCharacter> => ({ inventory: b.cells, worn: b.worn })

export const at = (b: Bag, p: Place) => (typeof p === 'number' ? b.cells[p] : b.worn[p])
function put(b: Bag, p: Place, s: Slot | null) {
  if (typeof p === 'number') b.cells[p] = s
  else b.worn[p] = s
}
const copy = (b: Bag): Bag => ({ cells: [...b.cells], worn: { ...b.worn } })

// ---- what fits where

export type Kind = 'armor' | 'shield' | 'clothes' | 'weapon' | 'held' | 'other'
// carried in a hand besides weapons: light sources (and focuses and instruments, below)
const HELD = new Set(['torch', 'lamp', 'lantern-bullseye', 'lantern-hooded'])

export function kindOf(s: Slot | null): Kind {
  if (!s?.id) return 'other'
  const armor = byId.armor[s.id]
  if (armor) return armor.type === 'shield' ? 'shield' : 'armor'
  if (byId.weapon[s.id]) return 'weapon'
  if (/^clothes-|^costume$|^robe$/.test(s.id)) return 'clothes'
  const item = byId.item[s.id]
  if (item?.category === 'focus' || HELD.has(s.id) || item?.tool?.type === 'musical-instrument') return 'held'
  return 'other'
}

export const twoHanded = (s: Slot | null) => !!s?.id && !!byId.weapon[s.id]?.properties.includes('two-handed')

export function accepts(p: Place, s: Slot): boolean {
  if (typeof p === 'number') return true
  const k = kindOf(s)
  if (p === 'armor') return k === 'armor'
  if (p === 'clothes') return k === 'clothes'
  if (p === 'main1' || p === 'main2') return k === 'weapon' || k === 'held'
  // the other hand: no two-handed weapon (it goes to the main hand), a shield is worn here
  return (k === 'weapon' && !twoHanded(s)) || k === 'shield' || k === 'held'
}

const SETS = [
  ['main1', 'off1'],
  ['main2', 'off2']
] as const

// Drag and drop: the thing goes to the place and what was there goes where it came from.
// A two-handed weapon empties the other hand of its set, and a thing put into that hand sends
// the two-handed weapon back: it goes to the first free cell. null when a rule is broken or
// there is no free cell.
export function move(bag: Bag, from: Place, to: Place): Bag | null {
  if (from === to) return null
  const s = at(bag, from)
  if (!s) return null
  const t = at(bag, to)
  if (!accepts(to, s) || (t && !accepts(from, t))) return null
  const out = copy(bag)
  put(out, to, s)
  put(out, from, t)
  for (const [main, off] of SETS) {
    if (!twoHanded(out.worn[main]) || !out.worn[off]) continue
    // the hand that did not just change gives way
    const evict = to === off || from === off ? main : off
    const free = out.cells.indexOf(null)
    if (free < 0) return null
    out.cells[free] = out.worn[evict]
    out.worn[evict] = null
  }
  return out
}

// the thing is deleted
export function remove(bag: Bag, p: Place): Bag {
  const out = copy(bag)
  put(out, p, null)
  return out
}

// the first free hand that may hold the weapon (both hands of a set for a two-handed one)
export function freeHand(w: Worn, s: Slot): WornPlace | null {
  for (const [main, off] of SETS) {
    if (twoHanded(w[main])) continue
    if (twoHanded(s)) {
      if (!w[main] && !w[off]) return main
      continue
    }
    if (!w[main] && accepts(main, s)) return main
    if (!w[off] && accepts(off, s)) return off
  }
  return null
}

// the weapons in hands, first set first, each kind once
export function wornWeapons(w: Worn): string[] {
  const ids = [w.main1, w.off1, w.main2, w.off2].filter((s) => kindOf(s) === 'weapon').map((s) => s!.id!)
  return [...new Set(ids)]
}

// Dresses a hero from the cells, as a new hero would be: the armour and shield the armour class
// was counted with, clothes, a melee set in hand and a ranged one ready. `weapons` limits the
// weapons to these ids (an old save: the weapons of its attack table).
export function autoEquip(bag: Bag, want: { armor?: string | null; shield?: boolean; weapons?: string[] }): Bag {
  const out = copy(bag)
  const take = (ok: (s: Slot) => boolean): Slot | null => {
    const i = out.cells.findIndex((s) => s && ok(s))
    if (i < 0) return null
    const s = out.cells[i]
    out.cells[i] = null
    return s
  }
  const w = out.worn
  if (want.armor && !w.armor) w.armor = take((s) => s.id === want.armor)
  if (!w.clothes) w.clothes = take((s) => kindOf(s) === 'clothes')
  if (want.shield && !w.off1) w.off1 = take((s) => kindOf(s) === 'shield')
  const weapon = (s: Slot) => kindOf(s) === 'weapon' && (!want.weapons || want.weapons.includes(s.id!))
  const data = (s: Slot) => byId.weapon[s.id!]
  const melee = (s: Slot) => weapon(s) && data(s).type === 'melee'
  if (!w.main1) w.main1 = take((s) => melee(s) && (!w.off1 || !twoHanded(s)))
  // a second light weapon for the other hand
  if (w.main1 && !w.off1 && data(w.main1).properties.includes('light')) {
    w.off1 = take((s) => melee(s) && data(s).properties.includes('light'))
  }
  if (!w.main2) w.main2 = take((s) => weapon(s) && data(s).type === 'ranged')
  if (!w.main2) w.main2 = take((s) => melee(s) && data(s).properties.includes('thrown') && !twoHanded(s))
  // an old save may name more weapons than these hands: the rest wait in free hands
  if (want.weapons) {
    out.cells.forEach((s, i) => {
      const hand = s && weapon(s) ? freeHand(w, s) : null
      if (!hand) return
      w[hand] = s
      out.cells[i] = null
    })
  }
  return out
}
