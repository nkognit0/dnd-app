import { describe, expect, it } from 'vitest'
import type { DnDCharacter } from 'dnd-sheet'
import { buildCharacter } from '../rules/sheet'
import { initialState, Roll } from '../wizard/state'
import { applyLevelUp } from '../levelup/apply'
import { readSheet } from '../levelup/read'
import { emptyPicks, featStepKind } from '../levelup/plan'
import type { LevelPicks } from '../levelup/plan'
import { ChangeEvent, Why, changelogOf, diffCharacter, fieldTarget } from './changelog'

const roll = (total: number): Roll => ({ dice: [], dropped: 0, total })

function dwarfFighter(): DnDCharacter {
  const s = initialState()
  s.cls.classId = 'fighter'
  s.background = { backgroundId: 'soldier', toolChoice: ['dice'] }
  s.species.speciesId = 'dwarf'
  s.roll.rolls = [15, 14, 13, 12, 10, 8].map(roll)
  s.abilities = { assign: { str: 0, dex: 1, con: 2, cha: 3, wis: 4, int: 5 }, mode: '2-1', plus2: 'str', plus1: 'con' }
  s.skills = { classSkills: ['perception', 'survival'], classTools: [], languages: ['dwarvish', 'giant'], extraLanguages: [], expertise: [] }
  s.features = { fightingStyle: 'great-weapon-fighting', order: null, invocations: [], masteries: ['greatsword', 'flail', 'javelin'] }
  s.equipment = { classOption: 'A', bgOption: 'A', picks: {}, purchases: [] }
  s.personality.name = 'Торвин'
  return buildCharacter(s).character
}

function up(c: DnDCharacter, level: number): DnDCharacter {
  const i = readSheet(c).info!
  const p: LevelPicks = { ...emptyPicks(), hp: { method: 'fixed', roll: null } }
  if (level === 3) p.subclass = 'champion'
  if (featStepKind(i)) {
    p.feat = 'ability-score-improvement'
    p.choices = { 'ft:mode': ['2'], 'ft:plus2': ['str'], 'f:weapon-mastery:weapons': ['longsword'] }
  }
  return applyLevelUp(c, i, p).character
}

const find = (ev: ChangeEvent, field: string) => ev.entries.find((e) => e.field === field)!

describe('change log', () => {
  const c1 = dwarfFighter()
  it('creation: every filled field is an entry with its reason', () => {
    const [ev] = changelogOf(c1)
    expect(ev.title).toBe('Создание персонажа: Торвин, Воин 1')
    expect(ev.entries.length).toBeGreaterThan(50)
    expect(ev.entries.filter((e) => !e.why)).toEqual([])
    expect(find(ev, 'maxHp').why).toMatch(/к10.*Телосложения \+2.*Дварфийской выдержки/)
    expect(find(ev, 'str').why).toBe('Бросок 4к6 (три лучших кости): 15; +2 от предыстории «Солдат»')
    expect(find(ev, 'skillAthleticsChecked').why).toBe('Владение даёт предыстория «Солдат»')
  })
  let c = c1
  for (let l = 2; l <= 5; l++) c = up(c, l)
  const events = changelogOf(c)
  it('every level up adds an event; nothing changes without a reason', () => {
    expect(events.map((e) => e.title)).toEqual([
      'Создание персонажа: Торвин, Воин 1', 'Уровень 2: Воин', 'Уровень 3: Воин (Чемпион)', 'Уровень 4: Воин (Чемпион)', 'Уровень 5: Воин (Чемпион)'
    ])
    for (const ev of events) expect(ev.entries.filter((e) => !e.why), ev.title).toEqual([])
  })
  it('level 4 and 5: the causes in plain words', () => {
    const l4 = events[3]
    expect(find(l4, 'str')).toMatchObject({ from: '17', to: '19', why: 'Черта «Увеличение характеристик» на 4-м уровне: +2' })
    expect(find(l4, 'strSave').why).toBe('Пересчёт: модификатор: Сила +3 → +4')
    const l5 = events[4]
    expect(find(l5, 'proficiencyBonus').why).toMatch(/5, 9, 13 и 17/)
    expect(find(l5, 'skillPerception').why).toBe('Пересчёт: бонус мастерства +2 → +3')
    // the class table line is rewritten, not added a second time
    const table = l5.entries.find((e) => e.field === 'classFeatures' && e.to.startsWith('Таблица класса'))!
    expect(table.from).toMatch(/^Таблица класса \(4-й ур\.\)/)
  })
  it('lines, list items and table rows are separate entries', () => {
    const why = new Why()
    why.part('languages', 'Эльфийский', 'выбор')
    const entries = diffCharacter(
      { languages: 'Общий', attacks: [{ name: 'Кинжал', bonus: '+4' }], classFeatures: 'А' },
      { languages: 'Общий, Эльфийский', attacks: [{ name: 'Кинжал', bonus: '+5' }], classFeatures: 'А\nБ' },
      why
    )
    expect(entries.map((e) => [e.field, e.from, e.to])).toEqual([
      ['languages', '', 'Эльфийский'],
      ['attacks', 'Кинжал: +4', 'Кинжал: +5'],
      ['classFeatures', '', 'Б']
    ])
    expect(entries[0].why).toBe('выбор')
  })
  it('a checkbox entry points at the row of its value', () => {
    expect(fieldTarget('skillArcanaChecked')).toBe('skillArcana')
    expect(fieldTarget('strSaveChecked')).toBe('strSave')
    expect(fieldTarget('armorLight')).toBe('armorLight')
  })
})
