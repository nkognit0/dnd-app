// One weapon row of the attack table, the same at creation and when the hero takes a weapon in
// hand: bonus = ability modifier (+ proficiency bonus), damage = die + modifier, notes = the
// properties, the mastery and a missing proficiency.
import type { DnDAttack } from 'dnd-sheet'
import { nameOf, ruName } from '../data'
import type { WeaponData } from '../data'
import { signed } from './derive'
import { dice } from './text'

const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

// Strength for melee, Dexterity for ranged, the better of the two for a finesse weapon
export function weaponAbility(w: WeaponData, mods: { str: number; dex: number }): 'str' | 'dex' {
  if (w.properties.includes('finesse')) return mods.dex > mods.str ? 'dex' : 'str'
  return w.type === 'ranged' ? 'dex' : 'str'
}

export function weaponRow(w: WeaponData, x: { mod: number; pb: number; proficient: boolean; mastery: boolean }): DnDAttack {
  const det = w.property_details
  const props = w.properties.map((p) => {
    const name = lc(ruName('weapon_properties', p))
    if (p === 'ammunition' && det.ammunition) return `${name} (${det.ammunition.range_normal}/${det.ammunition.range_long})`
    if (p === 'thrown' && det.thrown) return `${name} (${det.thrown.range_normal}/${det.thrown.range_long})`
    if (p === 'versatile' && det.versatile) return `${name} (${dice(det.versatile.damage_dice)})`
    return name
  })
  const notes = [props.join(', ')]
  if (x.mastery) notes.push('мастерство: ' + lc(ruName('weapon_masteries', w.mastery)))
  if (!x.proficient) notes.push('нет владения')
  return {
    name: nameOf(w),
    bonus: signed(x.mod + (x.proficient ? x.pb : 0)),
    damage: `${dice(w.damage_dice)}${x.mod ? signed(x.mod) : ''} ${ruName('damage_types', w.damage_type).toLowerCase()}`,
    notes: notes.filter(Boolean).join('; ')
  }
}
