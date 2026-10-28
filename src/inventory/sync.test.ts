import { describe, expect, it } from 'vitest'
import type { DnDCharacter } from 'dnd-sheet'
import { byId, equipment, nameOf } from '../data'
import { splitEntry } from '../wiki/lookup'
import { INVENTORY_SIZE, addItem, inventoryOf } from './inventory'
import { inventoryFromText, syncSaved, withBag, withEquipmentText } from './sync'
import { bagOf, remove } from './worn'

const n = (id: string) => nameOf(byId.item[id])
// a character whose cells were built from its fields
const sheet = (equipment: string, equipment2 = ''): DnDCharacter => withEquipmentText({ equipment, equipment2 })
const ids = (c: DnDCharacter) => inventoryOf(c).map((s) => (s ? s.id ?? s.name : null))
const add = (c: DnDCharacter, id: string) => withBag(c, { ...bagOf(c), cells: addItem(inventoryOf(c), { id })! })
const removeAt = (c: DnDCharacter, i: number) => withBag(c, remove(bagOf(c), i))

describe('entries of the equipment fields', () => {
  it('every item of the database is found by its Russian name', () => {
    for (const e of equipment) expect(splitEntry(nameOf(e), 'equipment').ref?.id).toBe(e.id)
  })
  it('quantity and notes come off the name; a name with brackets is kept whole', () => {
    expect(splitEntry(' Кинжал ×2', 'equipment')).toMatchObject({ lead: 1, name: 'Кинжал', count: 2 })
    expect(splitEntry('Кинжал х3', 'equipment')).toMatchObject({ name: 'Кинжал', count: 3 })
    expect(splitEntry('Стрелы (20)', 'equipment')).toMatchObject({ name: 'Стрелы', count: 20 })
    expect(splitEntry(n('feed') + ' ×3', 'equipment')).toMatchObject({ count: 3, ref: { id: 'feed' } })
    expect(splitEntry(n('book') + ' (молитвы)', 'equipment')).toMatchObject({ note: '(молитвы)', ref: { id: 'book' } })
    expect(splitEntry('Любовное письмо (от Лиры) ×2', 'equipment')).toMatchObject({ name: 'Любовное письмо (от Лиры)', count: 2, ref: null })
  })
})

describe('the inventory and the equipment fields stay in step', () => {
  it('a thing got or removed in the inventory is written into the field', () => {
    let c = sheet(n('longsword'))
    c = add(c, 'dagger')
    expect(c.equipment).toBe(`${n('longsword')}, ${n('dagger')}`)
    c = add(c, 'dagger')
    expect(c.equipment).toBe(`${n('longsword')}, ${n('dagger')} ×2`)
    expect(ids(c).slice(0, 3)).toEqual(['longsword', 'dagger', 'dagger'])
    c = removeAt(c, 1)
    expect(c.equipment).toBe(`${n('longsword')}, ${n('dagger')}`)
    c = removeAt(c, 0)
    expect(c.equipment).toBe(n('dagger'))
  })
  it('ammunition: one cell per bundle, the field counts pieces', () => {
    let c = sheet(`${n('arrows')} ×35`)
    expect(ids(c).filter((x) => x === 'arrows')).toHaveLength(2)
    c = add(c, 'arrows')
    expect(c.equipment).toBe(`${n('arrows')} ×55`)
    c = removeAt(c, 0)
    expect(c.equipment).toBe(`${n('arrows')} ×35`)
  })
  it('only the changed entry is rewritten: spelling, notes and other entries stay', () => {
    let c = sheet('Arrows ×20 (в колчане); Любовное письмо\nКинжал')
    expect(ids(c).slice(0, 4)).toEqual(['arrows', 'Любовное письмо', 'dagger', null])
    c = add(c, 'arrows')
    expect(c.equipment).toBe('Arrows ×40 (в колчане); Любовное письмо\nКинжал')
    c = removeAt(c, 1)
    expect(c.equipment).toBe('Arrows ×40 (в колчане)\nКинжал')
  })
  it('an edit of the field rebuilds the cells; things that stay keep their cells', () => {
    let c = sheet(`${n('longsword')}, ${n('dagger')}, ${n('rope')}`)
    c = withEquipmentText({ ...c, equipment: `${n('longsword')}, ${n('rope')}, ${n('torch')} ×2, Любовное письмо` })
    expect(ids(c).slice(0, 6)).toEqual(['longsword', 'torch', 'rope', 'torch', 'Любовное письмо', null])
  })
  it('new things go to the second field once it is in use; the second field counts too', () => {
    let c = sheet(n('longsword'), n('dagger'))
    expect(ids(c).slice(0, 2)).toEqual(['longsword', 'dagger'])
    c = add(c, 'rope')
    expect(c.equipment).toBe(n('longsword'))
    expect(c.equipment2).toBe(`${n('dagger')}, ${n('rope')}`)
  })
  it('what does not fit stays in the field and is not lost when the inventory changes', () => {
    let c = sheet(`${n('torch')} ×80`)
    expect(inventoryOf(c).every((s) => s?.id === 'torch')).toBe(true)
    c = removeAt(c, 0)
    expect(c.equipment).toBe(`${n('torch')} ×79`)
  })
  it('an old save: stacks become cells, things only in the inventory are written in', () => {
    const c = syncSaved({ equipment: n('dagger'), inventory: [{ id: 'dagger', qty: 1 }, { id: 'rope', qty: 1 }] })
    expect(c.equipment).toBe(`${n('dagger')}, ${n('rope')}`)
    expect(ids(c).slice(0, 3)).toEqual(['dagger', 'rope', null])
    // saved before the inventory existed
    expect(ids(syncSaved({ equipment: `${n('dagger')} ×2` })).slice(0, 3)).toEqual(['dagger', 'dagger', null])
    expect(syncSaved({})).toEqual({})
  })
  it('the cells hold at most 72 things', () => {
    expect(inventoryFromText({ equipment: `${n('dagger')} ×100` }).cells.filter(Boolean)).toHaveLength(INVENTORY_SIZE)
  })
})
