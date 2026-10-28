import { describe, expect, it } from 'vitest'
import type { DnDCharacter } from 'dnd-sheet'
import { changelogOf } from '../changelog/changelog'
import { healOf, hitDiceOf, longRest, restState, shortRest } from './rest'

// a wounded level 3 fighter, Con 14 (+2)
const hurt = (more: DnDCharacter = {}): DnDCharacter => ({
  classLevel: 'Воин 3',
  species: 'Дварф',
  con: '14',
  maxHp: '31',
  hp: '12',
  tempHp: '5',
  hitDiceMax: '3к10',
  hitDice: '1к10',
  deathsaveSuccesses: 1,
  deathsaveFailures: 2,
  lvl1SpellSlotsTotal: '3',
  lvl1SpellSlotsUsed: 2,
  ...more
})

describe('long rest', () => {
  it('all Hit Points and Hit Point Dice back, temporary ones gone, slots and death saves reset', () => {
    const r = longRest(hurt())
    expect(r.character).toMatchObject({ hp: '31', tempHp: '', hitDice: '3к10', deathsaveSuccesses: 0, deathsaveFailures: 0, lvl1SpellSlotsUsed: 0 })
    expect(r.changes).toContain('Хиты: 12 → 31')
    // the change log gets an event with the reasons
    const log = changelogOf(r.character)
    const event = log[log.length - 1]
    expect(event.title).toBe('Долгий отдых')
    expect(event.entries.find((e) => e.field === 'hp')?.why).toMatch(/все потерянные хиты/)
  })
  it('a human gains Heroic Inspiration', () => {
    expect(longRest(hurt({ species: 'Человек' })).character.inspiration).toBe('✓')
    expect(longRest(hurt()).character.inspiration).toBeUndefined()
  })
  it('nothing to restore: no event', () => {
    const rested = longRest(hurt()).character
    const again = longRest(rested)
    expect(again.changes).toEqual([])
    expect(again.character).toBe(rested)
  })
  it('no rest with 0 Hit Points', () => {
    expect(restState(hurt({ hp: '0' })).blocked).toBeTruthy()
    expect(longRest(hurt({ hp: '0' })).character.hp).toBe('0')
  })
})

describe('short rest', () => {
  it('each spent die heals its roll + Con, at least 1; not above the maximum', () => {
    expect(healOf(1, -3)).toBe(1)
    const r = shortRest(hurt(), [7])
    expect(r.character).toMatchObject({ hp: '21', hitDice: '0к10', tempHp: '5', lvl1SpellSlotsUsed: 2 })
    expect(r.character.deathsaveFailures).toBe(0)
    expect(shortRest(hurt({ hp: '30', hitDice: '2к10' }), [10, 10]).character).toMatchObject({ hp: '31', hitDice: '0к10' })
    // no more dice than the hero has
    expect(shortRest(hurt(), [5, 5, 5]).character.hitDice).toBe('0к10')
  })
  it('a warlock regains the Pact Magic slots', () => {
    expect(shortRest(hurt({ classLevel: 'Колдун 3' }), []).character.lvl1SpellSlotsUsed).toBe(0)
  })
  it('reads hit dice', () => {
    expect(hitDiceOf('3к10')).toEqual({ count: 3, die: 10 })
    expect(hitDiceOf('2d8')).toEqual({ count: 2, die: 8 })
    expect(hitDiceOf('')).toBeNull()
  })
})
