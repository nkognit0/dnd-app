import { describe, expect, it } from 'vitest'
import type { DnDCharacter } from 'dnd-sheet'
import { byId, nameOf } from '../data'
import { withBag, withEquipmentText } from './sync'
import { withAttackEdit } from './gear'
import { Bag, NO_WORN, accepts, autoEquip, bagOf, move, remove } from './worn'
import { INVENTORY_SIZE } from './inventory'

const n = (id: string) => nameOf(byId.item[id])
const cells = (...ids: string[]) => [...ids.map((id) => ({ id })), ...Array(INVENTORY_SIZE - ids.length).fill(null)]
const bag = (...ids: string[]): Bag => ({ cells: cells(...ids), worn: { ...NO_WORN } })
const ids = (b: Bag) => ({
  cells: b.cells.slice(0, 4).map((s) => s?.id ?? null),
  worn: Object.fromEntries(Object.entries(b.worn).filter(([, s]) => s).map(([k, s]) => [k, s!.id]))
})

describe('what fits where', () => {
  it('armour, clothes, hands', () => {
    expect(accepts('armor', { id: 'chain-mail' })).toBe(true)
    expect(accepts('armor', { id: 'shield' })).toBe(false)
    expect(accepts('clothes', { id: 'clothes-travelers' })).toBe(true)
    expect(accepts('main1', { id: 'longsword' })).toBe(true)
    expect(accepts('main1', { id: 'torch' })).toBe(true)
    expect(accepts('main1', { id: 'rope' })).toBe(false)
    // the shield and the other hand
    expect(accepts('main1', { id: 'shield' })).toBe(false)
    expect(accepts('off1', { id: 'shield' })).toBe(true)
    expect(accepts('off1', { id: 'greatsword' })).toBe(false)
    expect(accepts(5, { name: 'Письмо' })).toBe(true)
  })
})

describe('moving things', () => {
  it('to an empty cell, swapping with a thing, refused where it does not fit', () => {
    let b = bag('dagger', 'rope')
    b = move(b, 0, 3)!
    expect(ids(b).cells).toEqual([null, 'rope', null, 'dagger'])
    b = move(b, 1, 3)!
    expect(ids(b).cells).toEqual([null, 'dagger', null, 'rope'])
    expect(move(b, 3, 'main1')).toBeNull()
    expect(move(b, 0, 2)).toBeNull()
  })
  it('a two-handed weapon empties the other hand; a thing in that hand sends it back', () => {
    let b = bag('shield', 'greatsword', 'dagger')
    b = move(b, 0, 'off1')!
    b = move(b, 1, 'main1')!
    expect(ids(b)).toEqual({ cells: ['shield', null, 'dagger', null], worn: { main1: 'greatsword' } })
    b = move(b, 2, 'off1')!
    expect(ids(b)).toEqual({ cells: ['shield', 'greatsword', null, null], worn: { off1: 'dagger' } })
  })
  it('a swap that would put a thing where it does not fit is refused', () => {
    let b = bag('longsword', 'rope')
    b = move(b, 0, 'main1')!
    expect(move(b, 'main1', 1)).toBeNull()
  })
  it('a new hero: armour and shield, a melee set in hand, a ranged one ready', () => {
    const b = autoEquip(bag('chain-mail', 'shield', 'longsword', 'greatsword', 'shortbow', 'clothes-fine'), { armor: 'chain-mail', shield: true })
    expect(ids(autoEquip(b, {})).worn).toEqual({ armor: 'chain-mail', clothes: 'clothes-fine', main1: 'longsword', off1: 'shield', main2: 'shortbow' })
    const rogue = autoEquip(bag('shortsword', 'dagger', 'shortbow'), {})
    expect(ids(rogue).worn).toEqual({ main1: 'shortsword', off1: 'dagger', main2: 'shortbow' })
  })
})

describe('the sheet follows the hero', () => {
  // a level 1 fighter with Str 16, Dex 14, chain mail on: AC 16
  const base = (): DnDCharacter =>
    withEquipmentText({
      classLevel: 'Воин 1',
      str: '16',
      dex: '14',
      proficiencyBonus: '+2',
      weaponProficiencies: 'Простое и воинское оружие',
      ac: '16',
      equipment: [n('chain-mail'), n('shield'), n('longsword'), n('shortbow')].join(', '),
      attacks: [{ name: 'Огненный снаряд', bonus: '+5', damage: '1к10 огонь', notes: 'заговор' }],
      worn: { armor: { id: 'chain-mail' } }
    })
  const moved = (c: DnDCharacter, from: number | 'main1' | 'off1' | 'armor', to: number | 'main1' | 'off1' | 'armor') =>
    withBag(c, move(bagOf(c), from, to)!)
  const at = (c: DnDCharacter, id: string) => bagOf(c).cells.findIndex((s) => s?.id === id)

  it('a weapon taken in hand gets a row before the cantrips; put away, the row goes', () => {
    let c = base()
    c = moved(c, at(c, 'longsword'), 'main1')
    expect(c.attacks!.map((a) => a.name)).toEqual([n('longsword'), 'Огненный снаряд'])
    expect(c.attacks![0]).toMatchObject({ bonus: '+5', damage: '1к8+3 рубящий' })
    // moving does not change the equipment field
    expect(c.equipment).toBe(base().equipment)
    c = moved(c, 'main1', 10)
    expect(c.attacks!.map((a) => a.name)).toEqual(['Огненный снаряд'])
  })
  it('the armour class follows the armour and the shield by the difference', () => {
    let c = base()
    c = moved(c, at(c, 'shield'), 'off1')
    expect(c.ac).toBe('18')
    c = moved(c, 'armor', 20)
    // no armour: 10 + Dex 2, with the shield
    expect(c.ac).toBe('14')
    c = withBag(c, remove(bagOf(c), 'off1'))
    expect(c.ac).toBe('12')
    expect(c.equipment).not.toContain(n('shield'))
  })
  it('a deleted row puts the weapon away; a written one takes it in hand', () => {
    let c = moved(base(), at(base(), 'longsword'), 'main1')
    c = withAttackEdit(c, { ...c, attacks: c.attacks!.slice(1) })
    expect(bagOf(c).worn.main1).toBeNull()
    const next = { ...c, attacks: [...c.attacks!, { name: n('shortbow') }] }
    expect(bagOf(withAttackEdit(c, next)).worn.main1?.id).toBe('shortbow')
  })
})
