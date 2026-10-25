import { describe, expect, it } from 'vitest'
import type { DnDCharacter } from 'dnd-sheet'
import { byId, classOptions, nameOf, spellsFor, subclasses } from '../data'
import { buildCharacter } from '../rules/sheet'
import { Roll, initialState } from '../wizard/state'
import { applyLevelUp } from './apply'
import {
  LevelPicks, choicesValid, emptyPicks, featChoices, featOptions, featStepKind, featureChoices, hpGain, spellChoices,
  spellPlan, subclassStepNeeded
} from './plan'
import { readSheet } from './read'

const roll = (total: number): Roll => ({ dice: [], dropped: 0, total })
const STANDARD = [15, 14, 13, 12, 10, 8].map(roll)

function info(c: DnDCharacter) {
  const r = readSheet(c)
  expect(r.errors).toEqual([])
  return r.info!
}

// picks every listed choice with its first options
function autoPick(c: DnDCharacter, picks: LevelPicks, keep: Record<string, string[]> = {}): LevelPicks {
  const i = info(c)
  let p = { ...picks, choices: { ...picks.choices, ...keep } }
  for (let pass = 0; pass < 4; pass++) {
    const defs = [...featChoices(i, p), ...featureChoices(i, p), ...spellChoices(i, p)]
    for (const d of defs) {
      // options may appear only after an earlier pick (a wizard prepares from the new spellbook spells)
      if (p.choices[d.key]?.length || d.optional || !d.options.length) continue
      p = { ...p, choices: { ...p.choices, [d.key]: d.options.slice(0, d.count).map((o) => o.value) } }
    }
  }
  return p
}

function level(c: DnDCharacter, picks: Partial<LevelPicks> = {}, keep: Record<string, string[]> = {}) {
  const base = { ...emptyPicks(), hp: { method: 'fixed' as const, roll: null }, ...picks }
  // at feat levels take the Ability Score Improvement (or the first epic boon) unless the test chose a feat
  const kind = featStepKind(info(c))
  if (kind && !base.feat) {
    const opts = featOptions(info(c), base, kind).map((o) => o.value)
    base.feat = kind === 'asi' && opts.includes('ability-score-improvement') ? 'ability-score-improvement' : opts[0]
  }
  const p = autoPick(c, base, keep)
  const i = info(c)
  expect(choicesValid([...featChoices(i, p), ...featureChoices(i, p), ...spellChoices(i, p)], p)).toBe(true)
  return { ...applyLevelUp(c, i, p), picks: p, info: i }
}

function artificer(): DnDCharacter {
  const s = initialState()
  s.cls.classId = 'artificer'
  s.background = { backgroundId: 'noble', toolChoice: ['playing-cards'] }
  s.species = { speciesId: 'human', optionId: null, size: 'medium', skill: 'insight', feat: 'lucky', spellAbility: null }
  s.roll.rolls = STANDARD
  s.abilities = { assign: { int: 0, con: 1, dex: 2, cha: 3, wis: 4, str: 5 }, mode: '2-1', plus2: 'int', plus1: 'cha' }
  s.feats.background.picks = ['skill:deception', 'skill:perception', 'tool:jewelers-tools']
  s.skills = { classSkills: ['investigation', 'arcana'], classTools: ['alchemists-supplies'], languages: ['elvish', 'dwarvish'], extraLanguages: [], expertise: [] }
  s.spells = { cantrips: ['guidance', 'fire-bolt'], prepared: ['cure-wounds', 'faerie-fire'], spellbook: [] }
  s.equipment = { classOption: 'A', bgOption: 'A', picks: {}, purchases: ['shield'] }
  s.personality.name = 'Эдмунд'
  return buildCharacter(s).character
}

describe('reading the sheet', () => {
  it('reads a sheet made by the creation wizard', () => {
    const r = readSheet(artificer())
    expect(r.errors).toEqual([])
    expect(r.info!.cls.id).toBe('artificer')
    expect(r.info!.level).toBe(1)
    expect(r.info!.skills.has('arcana')).toBe(true)
    expect(r.info!.tools.has('alchemists-supplies')).toBe(true)
    expect(r.info!.feats.has('lucky')).toBe(true)
    expect(r.info!.spells.map((s) => s.id)).toEqual(expect.arrayContaining(['guidance', 'fire-bolt', 'mending', 'cure-wounds']))
  })
  it('explains what is missing', () => {
    expect(readSheet({}).errors.join(' ')).toMatch(/уровня/)
    const multi = readSheet({ ...artificer(), classLevel: 'Воин 3 / Плут 2' })
    expect(multi.errors.join(' ')).toMatch(/мультикласс/)
    const noSub = readSheet({ ...artificer(), classLevel: nameOf(byId.class.artificer) + ' 3' })
    expect(noSub.errors.join(' ')).toMatch(/Подкласс/)
    const noScores = readSheet({ ...artificer(), str: '' })
    expect(noScores.errors.join(' ')).toMatch(/Сила/)
    const unknown = readSheet({ ...artificer(), classLevel: 'Повар 2' })
    expect(unknown.errors.join(' ')).toMatch(/не найден/)
  })
})

describe('artificer 1 → 2 → 3 (alchemist)', () => {
  const l1 = artificer()
  const r2 = level(l1)
  const c2 = r2.character
  it('level 2: hit points, plans and the class table', () => {
    expect(c2.classLevel).toBe(nameOf(byId.class.artificer) + ' 2')
    expect(c2.maxHp).toBe('17') // 10 + fixed 5 + Con 2
    expect(c2.hitDiceMax).toBe('2к8')
    const plans = r2.picks.choices['f:plans:artificer-magic-item-plans']
    expect(plans).toHaveLength(4)
    for (const id of plans) expect((classOptions['artificer-magic-item-plans'].find((o) => o.id === id)?.min_level ?? 99)).toBeLessThanOrEqual(2)
    expect(c2.classFeatures).toContain(nameOf(classOptions['artificer-magic-item-plans'].find((o) => o.id === plans[0])))
    expect(c2.classFeatures).toMatch(/Таблица класса \(2-й ур\.\): .*схемы 4/)
  })
  it('level 2: new prepared spells follow the class table', () => {
    const t = byId.class.artificer.levels
    const plan = spellPlan(r2.info, r2.picks)!
    expect(plan.prepared).toBe((t[1].prepared_spells ?? 0) - (t[0].prepared_spells ?? 0))
    expect(c2.lvl1Spells!.filter((s) => s.prepared).length).toBe(t[1].prepared_spells)
  })
  it('level 2: the spellcasting line written at level 1 shows the new numbers', () => {
    const t = byId.class.artificer.levels
    expect(l1.classFeatures).toContain(`подготовленных заклинаний ${t[0].prepared_spells}`)
    expect(c2.classFeatures).toContain(`подготовленных заклинаний ${t[1].prepared_spells}`)
    expect(c2.classFeatures).not.toContain(`подготовленных заклинаний ${t[0].prepared_spells},`)
    expect(r2.summary.some((s) => s.startsWith('Обновлено: Использование заклинаний'))).toBe(true)
  })
  it('a hand-edited line stays as it is', () => {
    const edited = { ...l1, classFeatures: String(l1.classFeatures).replace('ячеек 1 круга 2', 'ячеек 1 круга 2 (моя заметка)') }
    expect(level(edited).character.classFeatures).toContain('(моя заметка)')
  })

  const i2 = info(c2)
  it('level 3: the subclass step comes first', () => {
    expect(subclassStepNeeded(i2)).toBe(true)
  })
  const r3 = level(c2, { subclass: 'alchemist' }, { 'g:tools-of-the-trade:tool': ['smiths-tools'] })
  const c3 = r3.character
  it('level 3: alchemist tools (with the replacement for a tool already known) and spells', () => {
    expect(c3.subclass).toBe(nameOf(byId.subclass.alchemist))
    expect(c3.toolProficiencies).toContain(nameOf(byId.item['herbalism-kit']))
    expect(c3.toolProficiencies).toContain(nameOf(byId.item['smiths-tools']))
    const names = c3.lvl1Spells!.map((s) => s.name)
    expect(names).toContain(nameOf(byId.spell['healing-word']) + ' (подкласс)')
    expect(names).toContain(nameOf(byId.spell['ray-of-sickness']) + ' (подкласс)')
    expect(c3.lvl1SpellSlotsTotal).toBe(String(byId.class.artificer.levels[2].spell_slots![0]))
    expect(c3.classFeatures).toContain(nameOf(byId.subclass.alchemist.features.find((f) => f.id === 'experimental-elixir')))
    expect(c3.maxHp).toBe('24')
  })
})

function dwarfFighter(): DnDCharacter {
  const s = initialState()
  s.cls.classId = 'fighter'
  s.background = { backgroundId: 'soldier', toolChoice: ['dice'] }
  s.species.speciesId = 'dwarf'
  s.roll.rolls = STANDARD
  s.abilities = { assign: { str: 0, dex: 1, con: 2, cha: 3, wis: 4, int: 5 }, mode: '2-1', plus2: 'str', plus1: 'con' }
  s.skills = { classSkills: ['perception', 'survival'], classTools: [], languages: ['dwarvish', 'giant'], extraLanguages: [], expertise: [] }
  s.features = { fightingStyle: 'great-weapon-fighting', order: null, invocations: [], masteries: ['greatsword', 'flail', 'javelin'] }
  s.equipment = { classOption: 'A', bgOption: 'A', picks: {}, purchases: [] }
  s.personality.name = 'Торвин'
  return buildCharacter(s).character
}

describe('dwarf fighter 1 → 5', () => {
  const c2 = level(dwarfFighter()).character
  const c3 = level(c2, { subclass: 'champion' }).character
  const i3 = info(c3)
  it('level 4 offers a feat, and the Ability Score Improvement raises Strength', () => {
    expect(featStepKind(i3)).toBe('asi')
    const opts = featOptions(i3, emptyPicks(), 'asi').map((o) => o.value)
    expect(opts).toContain('ability-score-improvement')
    expect(opts).toContain('great-weapon-master') // Strength 17 meets 13+
    expect(opts).not.toContain('great-weapon-fighting') // already known
  })
  const r4 = level(c3, { feat: 'ability-score-improvement' }, { 'ft:mode': ['2'], 'ft:plus2': ['str'] })
  const c4 = r4.character
  it('level 4: Strength 19 changes saves, skills and attacks; one more weapon mastery', () => {
    expect(c4.str).toBe('19')
    expect(c4.strSave).toBe('+6')
    expect(c4.skillAthletics).toBe('+6')
    const gs = c4.attacks!.find((a) => a.name === nameOf(byId.weapon.greatsword))!
    expect(gs.bonus).toBe('+6')
    expect(gs.damage).toMatch(/^2к6\+4 /)
    expect(r4.picks.choices['f:weapon-mastery:weapons']).toHaveLength(1)
    expect(c4.feats).toContain(nameOf(byId.feat['ability-score-improvement']))
    // d10 fixed 6 + Con 2 + Dwarven Toughness 1, three times
    expect(c4.maxHp).toBe(String(13 + 3 * 9))
  })
  const c5 = level(c4).character
  it('level 5: proficiency bonus +3 adds to proficient saves, skills and attacks', () => {
    expect(c5.proficiencyBonus).toBe('+3')
    expect(c5.strSave).toBe('+7')
    expect(c5.dexSave).toBe('+2')
    expect(c5.skillPerception).toBe('+3')
    expect(c5.passivePerception).toBe('13')
    expect(c5.attacks!.find((a) => a.name === nameOf(byId.weapon.greatsword))!.bonus).toBe('+7')
    expect(c5.classFeatures).toContain(nameOf(byId.class.fighter) === '' ? '' : 'Дополнительная атака')
  })
  it('level 5: Second Wind and Stonecunning follow the level and the proficiency bonus', () => {
    expect(c5.classFeatures).toContain('1к10 + 5 хитов')
    expect(c5.speciesTraits).toContain('Знание камня: чувство вибрации 60 фт на 10 минут, 3 раза за долгий отдых')
    expect(c4.speciesTraits).toContain('2 раза за долгий отдых')
  })
})

describe('wizard 1 → 2', () => {
  const s = initialState()
  s.cls.classId = 'wizard'
  s.background = { backgroundId: 'criminal', toolChoice: [] }
  s.species = { speciesId: 'human', optionId: null, size: 'medium', skill: 'insight', feat: 'tough', spellAbility: null }
  s.roll.rolls = STANDARD
  s.abilities = { assign: { int: 0, con: 1, dex: 2, wis: 3, cha: 4, str: 5 }, mode: '2-1', plus2: 'int', plus1: 'con' }
  s.skills = { classSkills: ['arcana', 'history'], classTools: [], languages: ['elvish', 'draconic'], extraLanguages: [], expertise: [] }
  const l1 = spellsFor('wizard', 1).map((x) => x.id)
  s.spells = { cantrips: spellsFor('wizard', 0).slice(0, 3).map((x) => x.id), spellbook: l1.slice(0, 6), prepared: l1.slice(0, 4) }
  s.equipment = { classOption: 'A', bgOption: 'A', picks: {}, purchases: [] }
  s.personality.name = 'Мира'
  const c1 = buildCharacter(s).character
  const r2 = level(c1, {}, { 'f:scholar:expertise': ['arcana'] })
  const c2 = r2.character
  it('two spells added to the spellbook and Scholar expertise', () => {
    expect(r2.picks.choices['sp:spellbook']).toHaveLength(2)
    expect(c2.lvl1Spells!.length).toBe(8)
    expect(c2.skillArcana).toBe('+7') // Int 17 (+3) + 2 × 2
  })
  it('Tough adds 2 hit points per level', () => {
    expect(hpGain(info(c1), r2.picks)!.extras.map((e) => e.value)).toContain(2)
  })
})

describe('every subclass levels from 1 to 20', () => {
  for (const sub of subclasses) {
    it(`${sub.class} / ${sub.id}`, () => {
      const cls = byId.class[sub.class]
      let c: DnDCharacter = {
        classLevel: `${nameOf(cls)} 1`, species: nameOf(byId.species.human),
        str: '14', dex: '14', con: '14', int: '14', wis: '14', cha: '14', maxHp: String(cls.hit_die + 2), hp: String(cls.hit_die + 2),
        hitDiceMax: `1к${cls.hit_die}`, hitDice: `1к${cls.hit_die}`
      }
      for (let l = 2; l <= 20; l++) {
        const r = level(c, l === 3 ? { subclass: sub.id } : {})
        c = r.character
        expect(c.classLevel).toBe(`${nameOf(cls)} ${l}`)
      }
      expect(c.proficiencyBonus).toBe('+6')
      expect(c.hitDiceMax).toBe(`20к${cls.hit_die}`)
      expect(Number(c.maxHp)).toBeGreaterThan(cls.hit_die + 2 + 19)
      expect(c.subclass).toBe(nameOf(sub))
    })
  }
})

describe('warlock pact slots move up a level', () => {
  const s = initialState()
  s.cls.classId = 'warlock'
  s.background = { backgroundId: 'criminal', toolChoice: [] }
  s.species = { speciesId: 'human', optionId: null, size: 'medium', skill: 'insight', feat: 'alert', spellAbility: null }
  s.roll.rolls = STANDARD
  s.abilities = { assign: { cha: 0, con: 1, dex: 2, wis: 3, int: 4, str: 5 }, mode: '2-1', plus2: 'int', plus1: 'cha' }
  s.skills = { classSkills: ['arcana', 'deception'], classTools: [], languages: ['elvish', 'draconic'], extraLanguages: [], expertise: [] }
  s.features = { fightingStyle: null, order: null, invocations: ['armor-of-shadows'], masteries: [] }
  s.spells = { cantrips: ['eldritch-blast', 'minor-illusion'], prepared: spellsFor('warlock', 1).slice(0, 2).map((x) => x.id), spellbook: [] }
  s.equipment = { classOption: 'A', bgOption: 'A', picks: {}, purchases: [] }
  s.personality.name = 'Вейл'
  const c2 = level(buildCharacter(s).character).character
  it('level 2: two more invocations', () => {
    expect(info(c2).options).toHaveLength(3)
  })
  const c3 = level(c2, { subclass: 'fiend-patron' }).character
  it('level 3: slots are level 2', () => {
    expect(c3.lvl1SpellSlotsTotal).toBe('')
    expect(c3.lvl2SpellSlotsTotal).toBe('2')
  })
})
