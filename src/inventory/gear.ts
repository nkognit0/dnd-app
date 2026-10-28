// The sheet follows what the hero holds and wears. The weapons in hands have rows in the attack
// table (other rows — cantrips, the player's own — stay as they are), and the armour class
// changes with the armour and the shield by the difference of the two, so bonuses the sheet
// already counts (a species, a magic item) stay. And back: a weapon whose row is deleted from
// the table is put away into a free cell; a weapon written into the table is taken from the
// cells into a free hand.
import type { DnDAttack, DnDCharacter } from 'dnd-sheet'
import { byId, classFeatures, classes, nameOf, ruName } from '../data'
import type { WeaponData } from '../data'
import { mod } from '../rules/derive'
import { weaponAbility, weaponRow } from '../rules/weapons'
import { norm, splitEntry } from '../wiki/lookup'
import { WORN, Worn, bagFields, bagOf, freeHand, kindOf, wornOf, wornWeapons } from './worn'

const toInt = (v: unknown): number | null => {
  const m = String(v ?? '').replace('−', '-').match(/[+-]?\d+/)
  return m ? Number(m[0]) : null
}
const mods = (c: DnDCharacter) => {
  const m = (a: string) => mod(toInt(c[a]) ?? 10)
  return { str: m('str'), dex: m('dex'), con: m('con'), wis: m('wis') }
}

// the weapon named at the start of a table row or of a line under the table
export function rowWeapon(name: string): string | null {
  const ref = splitEntry(name.split(':')[0], 'attack').ref
  return ref?.kind === 'weapon' ? ref.id : null
}

// ---- a row for a weapon, from what the sheet says

function proficient(c: DnDCharacter, w: WeaponData): boolean {
  const t = norm(String(c.weaponProficiencies ?? ''))
  if (t.includes(norm(nameOf(w)))) return true
  if (w.category === 'simple') return /прост|simple/.test(t)
  const m = t.match(/(?:воинск|martial)\S*(.*)/)
  if (!m) return false
  // «воинское со свойством «Фехтовальное» или «Лёгкое»»
  if (!/свойств|propert/.test(m[1])) return true
  return w.properties.some((p) => m[1].includes(norm(ruName('weapon_properties', p))))
}

function mastery(c: DnDCharacter, w: WeaponData): boolean {
  const feature = classFeatures.find((f) => f.feature === 'weapon-mastery')?.name_ru
  if (!feature) return false
  return String(c.classFeatures ?? '')
    .split('\n')
    .map(norm)
    .some((l) => l.startsWith(norm(feature)) && l.includes(norm(nameOf(w))))
}

export function sheetWeaponRow(c: DnDCharacter, id: string): DnDAttack {
  const w = byId.weapon[id]
  const m = mods(c)
  const pb = toInt(c.proficiencyBonus) ?? 2
  return weaponRow(w, { mod: m[weaponAbility(w, m)], pb, proficient: proficient(c, w), mastery: mastery(c, w) })
}

const lineOf = (r: DnDAttack) => `${r.name}: ${r.bonus}, ${r.damage}${r.notes ? '; ' + r.notes : ''}`

function attacksPatch(c: DnDCharacter, before: string[], after: string[]): Partial<DnDCharacter> {
  const gone = before.filter((id) => !after.includes(id))
  const added = after.filter((id) => !before.includes(id))
  if (!gone.length && !added.length) return {}
  const rows: DnDAttack[] = (c.attacks || []).filter((r) => r && String(r.name ?? '').trim())
  let lines = String(c.attacksText ?? '').split('\n')
  for (const id of gone) {
    const i = rows.findIndex((r) => rowWeapon(String(r.name)) === id)
    if (i >= 0) rows.splice(i, 1)
    else {
      const j = lines.findIndex((l) => rowWeapon(l) === id)
      if (j >= 0) lines.splice(j, 1)
    }
  }
  // a new weapon goes after the other weapons, before cantrips and the player's rows
  for (const id of added) {
    if (rows.some((r) => rowWeapon(String(r.name)) === id) || lines.some((l) => rowWeapon(l) === id)) continue
    const last = rows.map((r) => rowWeapon(String(r.name)) != null).lastIndexOf(true)
    rows.splice(last + 1, 0, sheetWeaponRow(c, id))
  }
  // the table has five rows; the rest goes to the lines under it
  lines = [...rows.slice(5).map(lineOf), ...lines.filter((l) => l.trim())]
  return { attacks: rows.slice(0, 5), attacksText: lines.join('\n') }
}

// ---- armour class

function hasDefenseStyle(c: DnDCharacter): boolean {
  const style = byId.feat['defense']
  return !!style && norm(`${c.feats ?? ''}\n${c.classFeatures ?? ''}`).includes(norm(nameOf(style)))
}

// the armour class this armour and shield give (the part that changes with them)
export function wornArmorClass(c: DnDCharacter, w: Worn): number {
  const m = mods(c)
  const armor = w.armor?.id ? byId.armor[w.armor.id] : undefined
  const shield = kindOf(w.off1) === 'shield'
  const cls = classes.find((k) => norm(String(c.classLevel ?? '')).startsWith(norm(nameOf(k))))?.id
  let v: number
  if (armor) {
    const ac = armor.armor_class
    v = (ac.base ?? 10) + (ac.add_dex ? Math.min(m.dex, ac.dex_max ?? 99) : 0) + (hasDefenseStyle(c) ? 1 : 0)
  } else if (cls === 'barbarian') v = 10 + m.dex + m.con
  else if (cls === 'monk' && !shield) v = 10 + m.dex + m.wis
  else v = 10 + m.dex
  return v + (shield ? byId.armor['shield']?.armor_class.bonus ?? 2 : 0)
}

// what changes on the sheet when the hero's places change from what the character has to `next`
export function gearPatch(c: DnDCharacter, next: Worn): Partial<DnDCharacter> {
  const prev = wornOf(c)
  const out = attacksPatch(c, wornWeapons(prev), wornWeapons(next))
  const ac = toInt(c.ac)
  const d = wornArmorClass(c, next) - wornArmorClass(c, prev)
  if (ac != null && d) out.ac = String(ac + d)
  return out
}

// ---- the attack table edited by hand

function tableWeapons(c: DnDCharacter): Set<string> {
  const names = [...(c.attacks || []).map((r) => String(r?.name ?? '')), ...String(c.attacksText ?? '').split('\n')]
  return new Set(names.map(rowWeapon).filter((id): id is string => !!id))
}

export function withAttackEdit(prev: DnDCharacter, c: DnDCharacter): DnDCharacter {
  const was = tableWeapons(prev)
  const now = tableWeapons(c)
  const bag = bagOf(c)
  let changed = false
  for (const id of was) {
    if (now.has(id)) continue
    for (const p of WORN) {
      const free = bag.cells.indexOf(null)
      if (bag.worn[p]?.id !== id || free < 0) continue
      bag.cells[free] = bag.worn[p]
      bag.worn[p] = null
      changed = true
    }
  }
  for (const id of now) {
    if (was.has(id) || wornWeapons(bag.worn).includes(id)) continue
    const i = bag.cells.findIndex((s) => s?.id === id)
    const hand = i >= 0 ? freeHand(bag.worn, bag.cells[i]!) : null
    if (!hand) continue
    bag.worn[hand] = bag.cells[i]
    bag.cells[i] = null
    changed = true
  }
  return changed ? { ...c, ...bagFields(bag) } : c
}
