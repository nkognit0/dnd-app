import { describe, expect, it } from 'vitest'
import { byId } from '../data'
import { INVENTORY_SIZE, addItem, iconUrl, inventoryOf, pay, removeItem, searchItems, totalCp, unitQty, walletFields, walletOf, withoutElectrum } from './inventory'

describe('inventory cells', () => {
  it('72 cells, one thing per cell; a new thing takes the first free cell', () => {
    let inv = inventoryOf({})
    expect(inv).toHaveLength(INVENTORY_SIZE)
    inv = addItem(inv, { id: 'dagger' })!
    inv = addItem(inv, { id: 'rope' })!
    inv = addItem(inv, { id: 'dagger' })!
    expect(inv.slice(0, 4)).toEqual([{ id: 'dagger' }, { id: 'rope' }, { id: 'dagger' }, null])
    inv = removeItem(inv, 1)
    expect(addItem(inv, { name: 'Письмо' })![1]).toEqual({ name: 'Письмо' })
  })
  it('no room in a full inventory; arrows come in a bundle of 20', () => {
    const full = Array.from({ length: INVENTORY_SIZE }, (_, i) => ({ id: 'x' + i }))
    expect(addItem(full, { id: 'dagger' })).toBeNull()
    expect(unitQty(byId.item.arrows)).toBe(20)
  })
  it('a stack saved before one thing per cell becomes as many cells', () => {
    const inv = inventoryOf({ inventory: [{ id: 'dagger', qty: 2 }, { id: 'arrows', qty: 40 }, null, { id: 'rope', qty: 1 }] })
    expect(inv.slice(0, 6)).toEqual([{ id: 'dagger' }, { id: 'arrows' }, { id: 'dagger' }, { id: 'rope' }, { id: 'arrows' }, null])
  })
})

describe('money', () => {
  it('reads the coin fields, empty fields are zero', () => {
    expect(walletOf({ gp: '15', sp: '', cp: '7' })).toEqual({ pp: 0, gp: 15, sp: 0, cp: 7 })
  })
  it('pays with small coins first and gets change for a broken coin', () => {
    // 2 gp from 5 sp and 10 gp: the silver goes, one gold coin is broken, 5 sp come back
    expect(pay({ pp: 0, gp: 10, sp: 5, cp: 0 }, 200)).toEqual({ pp: 0, gp: 8, sp: 5, cp: 0 })
    // 15 gp from 1 pp and 10 gp: the platinum coin is broken, 5 gp come back
    const w = pay({ pp: 1, gp: 10, sp: 0, cp: 0 }, 1500)!
    expect(totalCp(w)).toBe(500)
    // 1 pp = 10 gp = 100 sp = 1000 cp
    expect(pay({ pp: 1, gp: 0, sp: 0, cp: 0 }, 1)).toEqual({ pp: 0, gp: 9, sp: 9, cp: 9 })
    expect(pay({ pp: 0, gp: 1, sp: 0, cp: 0 }, 101)).toBeNull()
  })
  it('writes back only the coins it has, keeps empty fields empty', () => {
    expect(walletFields({ gp: '10' }, { pp: 0, gp: 8, sp: 5, cp: 0 })).toEqual({ pp: '', gp: '8', sp: '5', cp: '' })
  })
  it('electrum of an old save goes into gold and silver', () => {
    expect(withoutElectrum({ gp: '3', ep: '3' })).toEqual({ pp: '', gp: '4', sp: '5', cp: '' })
    expect(withoutElectrum({ gp: '3', ep: '' })).toEqual({ gp: '3' })
    expect(withoutElectrum({ gp: '3' })).toEqual({ gp: '3' })
  })
})

describe('search and icons', () => {
  it('finds items by the Russian and the English name, best matches first', () => {
    expect(searchItems('кинж')[0].id).toBe('dagger')
    expect(searchItems('LONGSWORD')[0].id).toBe('longsword')
    // «е» finds «ё»
    expect(searchItems('проклепанный')[0].id).toBe('studded-leather-armor')
    expect(searchItems('   ')).toEqual([])
  })
  it('an item without its own icon gets the sack', () => {
    expect(iconUrl('dagger')).toBe('icons/items/dagger.svg')
    expect(iconUrl('musket')).toBe('icons/items/_item.svg')
  })
})
