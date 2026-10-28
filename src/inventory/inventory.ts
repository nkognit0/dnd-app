// The character's inventory: 72 cells kept in the character (field `inventory`), one thing per
// cell; money in the sheet's coin fields; the item search of the inventory tab. The cells and
// the «Снаряжение» fields of the sheet are kept in step by sync.ts.
import type { DnDCharacter } from 'dnd-sheet'
import { byId, equipment, nameOf } from '../data'
import type { EquipmentData } from '../data'
import iconIds from './icon-ids.json'

export const INVENTORY_SIZE = 72

// an item of the database (a bundle of ammunition is one thing) or a thing of the player's
// own, known only by the name written in the sheet
export type Slot = { id: string; name?: undefined } | { id?: undefined; name: string }
export type Inventory = (Slot | null)[]

// how many come at once: ammunition is sold in bundles (20 arrows for 1 gp)
export const unitQty = (item: EquipmentData) => item.ammunition?.bundle_size ?? 1

// a saved cell or place: a database item, an own thing or nothing
export function toSlot(x: unknown): Slot | null {
  const s = x as { id?: unknown; name?: unknown } | null
  return typeof s?.id === 'string' && s.id ? { id: s.id } : typeof s?.name === 'string' && s.name.trim() ? { name: s.name } : null
}

export function inventoryOf(c: DnDCharacter): Inventory {
  const raw: unknown[] = Array.isArray(c.inventory) ? c.inventory : []
  const out: Inventory = Array(INVENTORY_SIZE).fill(null)
  const extra: Slot[] = []
  raw.slice(0, INVENTORY_SIZE).forEach((x, i) => {
    const s = x as { qty?: unknown } | null
    const slot = toSlot(x)
    if (!slot) return
    out[i] = slot
    // saved before one thing per cell: a stack becomes as many cells
    const qty = typeof s!.qty === 'number' ? s!.qty : 1
    const item = slot.id ? byId.item[slot.id] : undefined
    for (let k = item ? Math.ceil(qty / unitQty(item)) : qty; k > 1; k--) extra.push(slot)
  })
  for (const s of extra) {
    const free = out.indexOf(null)
    if (free < 0) break
    out[free] = { ...s }
  }
  return out
}

export const slotName = (s: Slot) => (s.id ? nameOf(byId.item[s.id]) || s.id : s.name)

// the first free cell takes it; null when there is no room
export function addItem(inv: Inventory, slot: Slot): Inventory | null {
  const free = inv.indexOf(null)
  if (free < 0) return null
  const out = [...inv]
  out[free] = slot
  return out
}

export function removeItem(inv: Inventory, index: number): Inventory {
  const out = [...inv]
  out[index] = null
  return out
}

// ---- money: the sheet's coin fields, largest coin first; in copper: 1 pp = 1000, 1 gp = 100,
// 1 sp = 10. The app has no electrum.

export const COINS = ['pp', 'gp', 'sp', 'cp'] as const
export type Coin = (typeof COINS)[number]
export const COIN_CP: Record<Coin, number> = { pp: 1000, gp: 100, sp: 10, cp: 1 }
export type Wallet = Record<Coin, number>

export function walletOf(c: DnDCharacter): Wallet {
  const n = (v: unknown) => {
    const m = String(v ?? '').match(/\d+/)
    return m ? Number(m[0]) : 0
  }
  return { pp: n(c.pp), gp: n(c.gp), sp: n(c.sp), cp: n(c.cp) }
}

// a save from when the sheet had electrum: 1 ep = 50 cp goes into gold and silver
export function withoutElectrum(c: DnDCharacter): DnDCharacter {
  if (!('ep' in c)) return c
  const { ep, ...rest } = c
  const n = Number(String(ep ?? '').match(/\d+/)?.[0] ?? 0)
  if (!n) return rest
  const w = walletOf(rest)
  return { ...rest, ...walletFields(rest, { ...w, gp: w.gp + Math.floor(n / 2), sp: w.sp + (n % 2) * 5 }) }
}

export const totalCp = (w: Wallet) => COINS.reduce((s, k) => s + w[k] * COIN_CP[k], 0)

// Pays like a person: small coins first, a bigger coin is broken when needed and the change
// comes back in gold, silver and copper. null when there is not enough money.
export function pay(w: Wallet, cost: number): Wallet | null {
  if (cost <= 0) return { ...w }
  if (totalCp(w) < cost) return null
  const out = { ...w }
  let left = cost
  for (const k of [...COINS].reverse()) {
    if (left <= 0) break
    const take = Math.min(out[k], Math.ceil(left / COIN_CP[k]))
    out[k] -= take
    left -= take * COIN_CP[k]
  }
  let change = -left
  for (const k of ['gp', 'sp', 'cp'] as const) {
    const n = Math.floor(change / COIN_CP[k])
    out[k] += n
    change -= n * COIN_CP[k]
  }
  return out
}

// the coin fields written back to the sheet: an empty field stays empty when it holds nothing
export function walletFields(before: DnDCharacter, w: Wallet): Partial<DnDCharacter> {
  const out: Partial<DnDCharacter> = {}
  for (const k of COINS) out[k] = w[k] || before[k] ? String(w[k]) : ''
  return out
}

// ---- icons and search

const withIcon = new Set<string>(iconIds as string[])
// relative paths: the site lives in a subfolder on GitHub Pages
export const iconUrl = (id?: string) => `icons/items/${id && withIcon.has(id) ? id : '_item'}.svg`

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[«»"'’]/g, '').replace(/\s+/g, ' ').trim()
const searchable = equipment.map((e) => ({ item: e, ru: norm(e.name_ru || ''), en: norm(e.name) }))

// by the Russian or the English name; names that start with the query come first
export function searchItems(query: string, limit = 30): EquipmentData[] {
  const q = norm(query)
  if (!q) return []
  return searchable
    .filter((x) => x.ru.includes(q) || x.en.includes(q))
    .sort((a, b) => {
      const sa = a.ru.startsWith(q) || a.en.startsWith(q) ? 0 : 1
      const sb = b.ru.startsWith(q) || b.en.startsWith(q) ? 0 : 1
      return sa - sb || a.ru.localeCompare(b.ru, 'ru')
    })
    .slice(0, limit)
    .map((x) => x.item)
}
