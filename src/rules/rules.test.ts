import { describe, expect, it } from 'vitest'
import { byId, nameOf } from '../data'
import { applyUpdate, initialState, Roll, WizardState } from '../wizard/state'
import { rollAbility, rollAbilityScores } from './dice'
import { buildCharacter } from './sheet'

const roll = (total: number): Roll => ({ dice: [], dropped: 0, total })
const STANDARD = [15, 14, 13, 12, 10, 8].map(roll)

describe('dice', () => {
  it('drops the lowest of four d6', () => {
    const seq = [6, 4, 3, 1]
    const r = rollAbility(() => seq.shift()!)
    expect(r).toEqual({ dice: [6, 4, 3, 1], dropped: 1, total: 13 })
  })
  it('rolls six scores between 3 and 18', () => {
    const rolls = rollAbilityScores()
    expect(rolls).toHaveLength(6)
    for (const r of rolls) {
      expect(r.dice).toHaveLength(4)
      expect(r.total).toBeGreaterThanOrEqual(3)
      expect(r.total).toBeLessThanOrEqual(18)
    }
  })
})

describe('wizard state', () => {
  it('resets later steps when an earlier step changes', () => {
    let s = initialState()
    s = applyUpdate(s, 'cls', { classId: 'fighter' })
    s = applyUpdate(s, 'background', { backgroundId: 'soldier' })
    s = applyUpdate(s, 'roll', { rolls: STANDARD })
    expect(s.roll.rolls).toHaveLength(6)
    s = applyUpdate(s, 'cls', { classId: 'wizard' })
    expect(s.background.backgroundId).toBeNull()
    expect(s.roll.rolls).toHaveLength(0)
  })
  it('keeps later steps when nothing changed', () => {
    let s = initialState()
    s = applyUpdate(s, 'cls', { classId: 'fighter' })
    s = applyUpdate(s, 'background', { backgroundId: 'soldier' })
    const same = applyUpdate(s, 'cls', { classId: 'fighter' })
    expect(same.background.backgroundId).toBe('soldier')
  })
})

function dwarfFighter(): WizardState {
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
  return s
}

describe('dwarf fighter (soldier)', () => {
  const { character: c } = buildCharacter(dwarfFighter())
  it('ability scores include the background increase', () => {
    expect([c.str, c.dex, c.con, c.int, c.wis, c.cha]).toEqual(['17', '14', '14', '8', '10', '12'])
  })
  it('saves and skills', () => {
    expect(c.strSave).toBe('+5')
    expect(c.strSaveChecked).toBe(true)
    expect(c.conSave).toBe('+4')
    expect(c.dexSaveChecked).toBe(false)
    expect(c.skillAthletics).toBe('+5')
    expect(c.skillIntimidation).toBe('+3')
    expect(c.skillPerception).toBe('+2')
    expect(c.skillSurvival).toBe('+2')
    expect(c.skillArcana).toBe('-1')
    expect(c.passivePerception).toBe('12')
  })
  it('combat numbers', () => {
    expect(c.ac).toBe('16')
    expect(c.init).toBe('+2')
    expect(c.speed).toBe('30 фт')
    expect(c.maxHp).toBe('13')
    expect(c.hitDiceMax).toBe('1к10')
    expect(c.armorHeavy).toBe(true)
  })
  it('weapon attacks', () => {
    const greatsword = c.attacks!.find((a) => a.name === nameOf(byId.weapon['greatsword']))!
    expect(greatsword.bonus).toBe('+5')
    expect(greatsword.damage).toMatch(/^2к6\+3 /)
    expect(greatsword.notes).toContain('мастерство')
    const shortbow = [...c.attacks!, ...(c.attacksText || '').split('\n').map((t) => ({ name: t }))]
      .find((a) => a.name?.startsWith(nameOf(byId.weapon['shortbow'])))
    expect(shortbow).toBeTruthy()
  })
  it('equipment and money', () => {
    expect(c.gp).toBe('18')
    expect(c.equipment).toContain(nameOf(byId.item['chain-mail']))
    expect(c.toolProficiencies).toBe(nameOf(byId.item['dice']))
    expect(c.languages).toBe(['common', 'dwarvish', 'giant'].map((id) => nameOf(byId.language[id])).join(', '))
  })
  it('feats and traits', () => {
    expect(c.feats).toContain(nameOf(byId.feat['savage-attacker']))
    expect(c.feats).toContain(nameOf(byId.feat['great-weapon-fighting']))
    expect(c.speciesTraits).toContain('120 фт')
  })
})

describe('human noble artificer', () => {
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
  const { character: c } = buildCharacter(s)

  it('scores, proficiencies and defence', () => {
    expect(c.int).toBe('17')
    expect(c.cha).toBe('13')
    expect(c.intSave).toBe('+5')
    expect(c.skillInvestigation).toBe('+5')
    expect(c.skillHistory).toBe('+5')
    expect(c.skillPersuasion).toBe('+3')
    expect(c.skillInsight).toBe('+2')
    expect(c.ac).toBe('15') // studded leather 12 + Dex 1 + shield 2
    expect(c.maxHp).toBe('10')
    expect(c.init).toBe('+1')
  })
  it('spellcasting', () => {
    expect(c.spellSaveDC).toBe('13')
    expect(c.spellAttackBonus).toBe('+5')
    expect(c.lvl1SpellSlotsTotal).toBe('2')
    expect(c.cantrips!.map((x) => x.name)).toContain(nameOf(byId.spell['mending']))
    expect(c.lvl1Spells!.every((x) => x.prepared)).toBe(true)
    const fireBolt = c.attacks!.find((a) => a.name === nameOf(byId.spell['fire-bolt']))!
    expect(fireBolt.bonus).toBe('+5')
    expect(fireBolt.damage).toMatch(/^1к10 /)
  })
  it('equipment: gaming set follows the tool choice, purchases are paid for', () => {
    expect(c.equipment).toContain(nameOf(byId.item['playing-cards']))
    expect(c.gp).toBe('35')
    expect(c.toolProficiencies).toContain(nameOf(byId.item['jewelers-tools']))
  })
})
