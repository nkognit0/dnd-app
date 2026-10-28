import { describe, expect, it } from 'vitest'
import { byId, nameOf } from '../data'
import { applyUpdate, initialState, Roll, WizardState } from '../wizard/state'
import { rollAbility, rollAbilityScores } from './dice'
import { buildCharacter } from './sheet'
import { derive } from './derive'
import { speciesValid } from '../wizard/steps/origin'
import { bagOf } from '../inventory/worn'

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
  it('the inventory tab starts with the starting equipment, one cell per item; the hero is dressed', () => {
    const { cells, worn } = bagOf(c)
    expect(worn.armor?.id).toBe('chain-mail')
    expect(worn.main1?.id).toBe('greatsword')
    expect(worn.main2?.id).toBe('shortbow')
    expect(cells.filter((s) => s?.id === 'javelin')).toHaveLength(8)
    expect(cells.some((s) => s?.id === 'greatsword')).toBe(false)
    // the attack table: the weapons in hands, not every weapon owned
    expect((c.attacks || []).map((a) => a.name)).toEqual([nameOf(byId.weapon['greatsword']), nameOf(byId.weapon['shortbow'])])
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
  s.species = { speciesId: 'human', optionId: null, size: 'medium', skills: ['insight'], tool: null, feat: 'lucky', spellAbility: null, resistance: null }
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

// the dwarf fighter above with another species: Str 17, Dex 14, Con 14, chain mail
function fighterAs(species: Partial<WizardState['species']>): WizardState {
  const s = dwarfFighter()
  s.species = { ...s.species, size: 'medium', ...species }
  return s
}

describe('species from Eberron and Ravenloft', () => {
  it('every choice is required before the species step is complete', () => {
    const s = fighterAs({ speciesId: 'warforged', skills: ['insight'] })
    expect(speciesValid(s, derive(s))).toBe(false)
    s.species.tool = 'smiths-tools'
    expect(speciesValid(s, derive(s))).toBe(true)
    const ch = fighterAs({ speciesId: 'changeling', skills: ['deception'] })
    expect(speciesValid(ch, derive(ch))).toBe(false)
    ch.species.skills = ['deception', 'persuasion']
    expect(speciesValid(ch, derive(ch))).toBe(true)
  })
  it('Warforged: +1 AC over armor, a skill and a tool', () => {
    const { character: c } = buildCharacter(fighterAs({ speciesId: 'warforged', skills: ['insight'], tool: 'smiths-tools' }))
    expect(c.ac).toBe('17')
    expect(c.skillInsightChecked).toBe(true)
    expect(c.toolProficiencies).toContain(nameOf(byId.item['smiths-tools']))
    expect(c.speciesTraits).toContain('Тип существа: Конструкт')
    expect(c.speciesTraits).toContain(`Специальная сборка: ${nameOf(byId.skill.insight)}, ${nameOf(byId.item['smiths-tools'])}`)
  })
  it('Hexblood: Disguise Self and Hex with the chosen ability', () => {
    const { character: c } = buildCharacter(fighterAs({ speciesId: 'hexblood', size: 'small', spellAbility: 'cha' }))
    expect(c.size).toBe('Маленький')
    expect(c.lvl1Spells!.map((x) => x.name)).toEqual([`${nameOf(byId.spell['disguise-self'])} (вид)`, `${nameOf(byId.spell.hex)} (вид)`])
    expect(c.spellcastingClass).toBe(`${nameOf(byId.species.hexblood)} (ХАР)`)
    expect(c.spellSaveDC).toBe('11')
    expect(c.speciesTraits).toContain('Тип существа: Фея')
  })
  it('Reborn: chosen skill and resistance, Knowledge from a Past Life by the proficiency bonus', () => {
    const { character: c } = buildCharacter(fighterAs({ speciesId: 'reborn', skills: ['history'], resistance: 'cold' }))
    expect(c.skillHistory).toBe('+1')
    expect(c.speciesTraits).toContain('Знание прошлой жизни: +1к6 к проваленной проверке характеристики, 2 раза за долгий отдых')
    expect(c.speciesTraits).toContain('сопротивление (холод)')
  })
  it('Changeling: two skills', () => {
    const { character: c } = buildCharacter(fighterAs({ speciesId: 'changeling', skills: ['deception', 'persuasion'] }))
    expect(c.skillDeception).toBe('+3')
    expect(c.skillPersuasionChecked).toBe(true)
  })
  it('Shifter: the Shifting benefit goes into the species field and the trait line', () => {
    const { character: c } = buildCharacter(fighterAs({ speciesId: 'shifter', skills: ['acrobatics'], optionId: 'longtooth' }))
    expect(c.species).toBe(`${nameOf(byId.species.shifter)} (${nameOf(byId.speciesOption.longtooth)})`)
    expect(c.speciesTraits).toContain('бонусным действием на 1 минуту, 4 временных хитов; укус бонусным действием, 1к6 + 3 колющего; 2 раза за долгий отдых')
  })
  it('Khoravar: Friends and a tool through Skill Versatility', () => {
    const { character: c } = buildCharacter(fighterAs({ speciesId: 'khoravar', spellAbility: 'wis', tool: 'herbalism-kit' }))
    expect(c.toolProficiencies).toContain(nameOf(byId.item['herbalism-kit']))
    expect(c.cantrips!.map((x) => x.name)).toContain(`${nameOf(byId.spell.friends)} (вид)`)
  })
  it('Dhampir, Kalashtar and Lupin numbers', () => {
    const dh = buildCharacter(fighterAs({ speciesId: 'dhampir' })).character
    expect(dh.speed).toBe('35 фт')
    expect(dh.speciesTraits).toContain('Укус вампира: безоружный удар 1к4 + 2 колющего; вытягивание или усиление 2 раза за долгий отдых')
    const ka = buildCharacter(fighterAs({ speciesId: 'kalashtar' })).character
    expect(ka.speciesTraits).toContain('Связь разумов: телепатия 10 фт')
    const lu = buildCharacter(fighterAs({ speciesId: 'lupin', skills: ['stealth'] })).character
    expect(lu.speciesTraits).toContain('спасбросок Мдр Сл 12')
  })
})
