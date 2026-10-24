// Wizard state -> every field of the character sheet.
import type { DnDAttack, DnDCharacter, DnDSpell } from 'dnd-sheet'
import { ABILITIES, Ability, abilityShort, byId, nameOf, ruName, skills } from '../data'
import type { WizardState } from '../wizard/state'
import {
  Derived, KnownSpell, PROFICIENCY_BONUS as PB, armorClass, derive, initiative, inventory, maxHitPoints,
  ownedWeapons, purchasesCp, signed, skillBonus, knownSpells, spellAttack, spellSaveDC, startingGoldCp
} from './derive'
import { classFeatureLines, dice, featLines, speciesTraitLines } from './text'

// sheet field name for each skill (keys come from the sheet component)
export const SKILL_FIELD: Record<string, string> = {
  acrobatics: 'skillAcrobatics', 'animal-handling': 'skillAnimalHandling', arcana: 'skillArcana',
  athletics: 'skillAthletics', deception: 'skillDeception', history: 'skillHistory', insight: 'skillInsight',
  intimidation: 'skillIntimidation', investigation: 'skillInvestigation', medicine: 'skillMedicine',
  nature: 'skillNature', perception: 'skillPerception', performance: 'skillPerformance',
  persuasion: 'skillPersuasion', religion: 'skillReligion', 'sleight-of-hand': 'skillSlightOfHand',
  stealth: 'skillStealth', survival: 'skillSurvival'
}

const NOTE_RU: Record<string, string> = {
  prayers: 'молитвы', history: 'история', philosophy: 'философия', 'occult lore': 'оккультные знания'
}

const damageName = (id: string) => ruName('damage_types', id).toLowerCase()
const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

function rangeRu(range: string): string {
  return range
    .replace(/(\d+)\s*feet/i, '$1 фт')
    .replace(/^Self$/i, 'на себя')
    .replace(/^Touch$/i, 'касание')
}

function weaponRows(d: Derived, s: WizardState, inv: ReturnType<typeof inventory>): DnDAttack[] {
  return ownedWeapons(inv).map(({ line, weapon: w }) => {
    const finesse = w.properties.includes('finesse')
    const ability: Ability = finesse ? (d.mods.dex > d.mods.str ? 'dex' : 'str') : w.type === 'ranged' ? 'dex' : 'str'
    const m = d.mods[ability]
    const proficient = d.weaponIds.has(w.id)
    const props = w.properties.map((p) => {
      const name = lc(ruName('weapon_properties', p))
      const det = w.property_details
      if (p === 'ammunition' && det.ammunition) return `${name} (${det.ammunition.range_normal}/${det.ammunition.range_long})`
      if (p === 'thrown' && det.thrown) return `${name} (${det.thrown.range_normal}/${det.thrown.range_long})`
      if (p === 'versatile' && det.versatile) return `${name} (${dice(det.versatile.damage_dice)})`
      return name
    })
    const notes = [props.join(', ')]
    if (s.features.masteries.includes(w.id)) notes.push('мастерство: ' + lc(ruName('weapon_masteries', w.mastery)))
    if (!proficient) notes.push('нет владения')
    return {
      name: nameOf(w) + (line.qty > 1 && !byId.item[w.id]?.ammunition ? ` ×${line.qty}` : ''),
      bonus: signed(m + (proficient ? PB : 0)),
      damage: `${dice(w.damage_dice)}${m ? signed(m) : ''} ${damageName(w.damage_type)}`,
      notes: notes.filter(Boolean).join('; ')
    }
  })
}

function cantripRows(d: Derived, known: KnownSpell[]): DnDAttack[] {
  return known
    .filter((k) => k.spell.level === 0 && k.spell.damage)
    .map((k) => {
      const sp = k.spell
      const dmg = sp.damage!
      const base = dmg.at_slot_level?.['0'] || dmg.at_character_level?.['1'] || ''
      return {
        name: nameOf(sp),
        bonus: sp.attack_type ? signed(spellAttack(d, k.ability)) : `Сл ${spellSaveDC(d, k.ability)}${sp.save ? ' ' + abilityShort(sp.save) : ''}`,
        damage: `${dice(base)} ${damageName(dmg.type)}`,
        notes: ['заговор', rangeRu(sp.range || '')].filter(Boolean).join(', ')
      }
    })
}

function weaponTrainingText(d: Derived): string {
  const cls = d.cls
  if (!cls) return ''
  const rule = cls.weapon_proficiencies
  const martialFromOrder = d.order?.grants?.weapon_proficiencies?.includes('martial')
  if (rule.categories.includes('martial') || martialFromOrder) return 'Простое и воинское оружие'
  if (rule.martial_with_any_property) {
    const props = rule.martial_with_any_property.map((p) => '«' + ruName('weapon_properties', p) + '»').join(' или ')
    return `Простое оружие; воинское со свойством ${props}`
  }
  return 'Простое оружие'
}

function coins(cp: number) {
  const total = Math.max(0, cp)
  return { gp: Math.floor(total / 100), sp: Math.floor((total % 100) / 10), cp: total % 10 }
}

export interface BuiltCharacter {
  character: DnDCharacter
  derived: Derived
  acFormula: string
  warnings: string[]
}

export function buildCharacter(s: WizardState): BuiltCharacter {
  const d = derive(s)
  const p = s.personality
  const cls = d.cls
  const inv = inventory(d, s)
  const ac = armorClass(d, s, inv)
  const known = knownSpells(d, s)
  const warnings: string[] = []
  if (ac.speedPenalty) warnings.push(`${nameOf(ac.armor)} требует Силу ${ac.armor?.strength_requirement}: скорость −10 фт`)

  const c: DnDCharacter = {}
  c.name = p.name
  c.playerName = p.playerName
  c.classLevel = cls ? nameOf(cls) + ' 1' : ''
  c.subclass = ''
  c.background = nameOf(d.bg)
  c.species = nameOf(d.sp) + (d.spOption && d.sp?.id !== 'aasimar' ? ` (${nameOf(d.spOption)})` : '')
  c.size = d.size ? ruName('sizes', d.size) : ''
  c.alignment = p.alignment ? nameOf(byId.alignment[p.alignment]) : ''
  c.xp = '0'

  for (const a of ABILITIES) c[a] = String(d.scores[a])
  c.proficiencyBonus = signed(PB)
  for (const a of ABILITIES) {
    const prof = !!cls?.saving_throws.includes(a)
    c[a + 'Save'] = signed(d.mods[a] + (prof ? PB : 0))
    c[a + 'SaveChecked'] = prof
  }
  for (const sk of skills) {
    const field = SKILL_FIELD[sk.id]
    c[field] = signed(skillBonus(d, sk.id, sk.ability))
    c[field + 'Checked'] = d.skills.has(sk.id)
  }
  c.passivePerception = String(10 + skillBonus(d, 'perception', 'wis'))

  c.armorLight = d.armorTraining.has('light')
  c.armorMedium = d.armorTraining.has('medium')
  c.armorHeavy = d.armorTraining.has('heavy')
  c.armorShields = d.armorTraining.has('shield')
  c.weaponProficiencies = weaponTrainingText(d)
  c.toolProficiencies = [...d.tools.keys()].map((id) => nameOf(byId.item[id])).join(', ')
  c.languages = [...d.languages.keys()].map((id) => nameOf(byId.language[id])).join(', ')

  c.ac = String(ac.value)
  c.init = signed(initiative(d))
  c.speed = `${d.speed - ac.speedPenalty} фт`
  const hp = maxHitPoints(d)
  c.maxHp = String(hp)
  c.hp = String(hp)
  c.hitDiceMax = cls ? '1к' + cls.hit_die : ''
  c.hitDice = c.hitDiceMax

  const rows = [...weaponRows(d, s, inv), ...cantripRows(d, known)]
  c.attacks = rows.slice(0, 5)
  c.attacksText = rows.slice(5).map((r) => `${r.name}: ${r.bonus}, ${r.damage}${r.notes ? '; ' + r.notes : ''}`).join('\n')

  const money = coins(startingGoldCp(d, s) - purchasesCp(s))
  c.gp = String(money.gp)
  c.sp = money.sp ? String(money.sp) : ''
  c.cp = money.cp ? String(money.cp) : ''
  c.equipment = inv
    .map((l) => nameOf(l.item) + (l.qty > 1 ? ` ×${l.qty}` : '') + (l.note ? ` (${NOTE_RU[l.note] || l.note})` : ''))
    .join(', ')

  c.personalityTraits = p.traits
  c.ideals = p.ideals
  c.bonds = p.bonds
  c.flaws = p.flaws
  c.classFeatures = classFeatureLines(d, s).join('\n')
  c.speciesTraits = speciesTraitLines(d, s).join('\n')
  c.feats = featLines(d, s).join('\n')

  c.age = p.age
  c.height = p.height
  c.weight = p.weight
  c.eyes = p.eyes
  c.skin = p.skin
  c.hair = p.hair
  c.backstory = [p.backstory, p.deity ? 'Божество: ' + p.deity : ''].filter(Boolean).join('\n\n')

  // spell sheet: the class ability if the class casts, otherwise a feat or species ability
  const mainAbility: Ability | null = cls?.spellcasting?.ability || known.find((k) => k.ability)?.ability || null
  if (known.length) {
    const mainSource = cls?.spellcasting ? nameOf(cls) : known.some((k) => k.source === 'feat') ? 'Посвящённый в магию' : nameOf(d.sp)
    // the full ability name does not fit the sheet's field
    c.spellcastingClass = mainAbility ? `${mainSource} (${abilityShort(mainAbility)})` : mainSource
    c.spellSaveDC = String(spellSaveDC(d, mainAbility))
    c.spellAttackBonus = signed(spellAttack(d, mainAbility))
    const l1 = cls?.levels[0]
    c.preparedSpellsTotal = l1?.prepared_spells ? String(l1.prepared_spells) : ''
    const suffix = (k: KnownSpell) => (k.source === 'species' ? ' (вид)' : k.source === 'feat' ? ' (черта)' : '')
    c.cantrips = known.filter((k) => k.spell.level === 0).map<DnDSpell>((k) => ({ name: nameOf(k.spell) + suffix(k) }))
    c.lvl1Spells = known
      .filter((k) => k.spell.level === 1)
      .map<DnDSpell>((k) => ({ name: nameOf(k.spell) + suffix(k), prepared: k.prepared }))
    const slots = l1?.pact_slots ? l1.pact_slots.count : l1?.spell_slots?.[0]
    c.lvl1SpellSlotsTotal = slots ? String(slots) : ''
  }

  return { character: c, derived: d, acFormula: ac.formula, warnings }
}
