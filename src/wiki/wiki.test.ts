import { describe, expect, it } from 'vitest'
import { byId, equipment, nameOf, spells } from '../data'
import { findLinks, linkAt } from './lookup'
import { areaOf, castingTime, duration, range, spellDamage, utilize } from './ru'

describe('wiki: finding names in sheet fields', () => {
  it('equipment list: each entry without its quantity or note', () => {
    const text = `${nameOf(byId.item['leather-armor'])}, ${nameOf(byId.item.dagger)} ×2, ${nameOf(byId.item['thieves-tools'])}, мешочек с монетами`
    const links = findLinks('equipment', text)
    expect(links.map((l) => [text.slice(l.start, l.end), l.ref.kind, l.ref.id])).toEqual([
      [nameOf(byId.item['leather-armor']), 'armor', 'leather-armor'],
      [nameOf(byId.item.dagger), 'weapon', 'dagger'],
      [nameOf(byId.item['thieves-tools']), 'tool', 'thieves-tools']
    ])
    const dagger = links[1]
    expect(linkAt('equipment', text, dagger.start + 2)).toEqual({ kind: 'weapon', id: 'dagger' })
    expect(linkAt('equipment', text, text.length - 2)).toBeNull()
  })
  it('the field decides: «Щит» is a spell in the spell list and armor in the equipment', () => {
    const shield = nameOf(byId.spell.shield)
    expect(linkAt('spell', shield, 0)).toEqual({ kind: 'spell', id: 'shield' })
    expect(linkAt('equipment', shield, 1)).toEqual({ kind: 'armor', id: 'shield' })
  })
  it('spell rows with a source tag, English names, attack overflow lines', () => {
    expect(linkAt('spell', `${nameOf(byId.spell['disguise-self'])} (вид)`, 0)).toEqual({ kind: 'spell', id: 'disguise-self' })
    expect(linkAt('spell', 'fire bolt', 0)).toEqual({ kind: 'spell', id: 'fire-bolt' })
    const lines = `${nameOf(byId.weapon.javelin)}: +5, 1к6+3 колющий\n${nameOf(byId.spell['fire-bolt'])}: +5, 1к10 огонь`
    expect(findLinks('attackText', lines).map((l) => l.ref.id)).toEqual(['javelin', 'fire-bolt'])
  })
})

describe('wiki: Russian wording of the cards', () => {
  const english = /[A-Za-z]/
  it('every spell casting time, range and duration is in Russian', () => {
    for (const s of spells) {
      expect(castingTime(s.casting_time), s.id).not.toMatch(english)
      expect(range(s.range), s.id).not.toMatch(english)
      expect(duration(s.duration), s.id).not.toMatch(english)
    }
  })
  it('every tool use is in Russian', () => {
    for (const t of equipment.filter((e) => e.tool)) expect(utilize(t.tool!.utilize), t.id).not.toMatch(english)
  })
  it('damage, scaling and area', () => {
    expect(spellDamage(byId.spell.fireball)).toBe('8к6 огонь; +1к6 за каждый круг выше 3-го')
    expect(spellDamage(byId.spell['fire-bolt'])).toBe('1к10 огонь; на 5, 11 и 17 уровнях: 2к10, 3к10, 4к10')
    expect(areaOf(byId.spell.fireball.description)).toBe('сфера радиусом 20 фт')
    expect(duration('up to 1 minute')).toBe('до 1 минуты')
    expect(range('1 mile')).toBe('1 миля')
  })
})
