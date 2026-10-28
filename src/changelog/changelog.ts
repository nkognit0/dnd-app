// The change log kept in the character (field `changelog`): one event per creation or level
// up, one entry per changed value, each with the reason in plain words. The wizards record
// the reasons while they fill the sheet (Why); the entries come from comparing the sheet
// before and after, so nothing that changed is left out.
import type { DnDAttack, DnDCharacter, DnDSpell } from 'dnd-sheet'
import { labels as L } from 'dnd-sheet'
import { ABILITIES, abilityName, byId, nameOf, skills } from '../data'

export interface ChangeEntry {
  // the sheet field (as in DnDCharacter), used to point at it in the sheet
  field: string
  label: string
  from: string
  to: string
  why: string
}

export interface ChangeEvent {
  id: string
  title: string
  at: string
  entries: ChangeEntry[]
}

export const changelogOf = (c: DnDCharacter): ChangeEvent[] => (Array.isArray(c.changelog) ? c.changelog : [])

// reasons collected while a wizard fills the sheet: for a field, or for one line / item of it
export class Why {
  private fields = new Map<string, string[]>()
  private parts = new Map<string, string>()
  field(key: string, reason: string) {
    const list = this.fields.get(key) || []
    if (!list.includes(reason)) list.push(reason)
    this.fields.set(key, list)
  }
  part(key: string, text: string, reason: string) {
    this.parts.set(key + '\n' + norm(text), reason)
  }
  forField(key: string) {
    return (this.fields.get(key) || []).join('; ')
  }
  forPart(key: string, text: string) {
    return this.parts.get(key + '\n' + norm(text)) || this.forField(key)
  }
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()

// Russian names of the sheet fields
const SKILL_OF: Record<string, string> = {
  skillAcrobatics: 'acrobatics', skillAnimalHandling: 'animal-handling', skillArcana: 'arcana', skillAthletics: 'athletics',
  skillDeception: 'deception', skillHistory: 'history', skillInsight: 'insight', skillIntimidation: 'intimidation',
  skillInvestigation: 'investigation', skillMedicine: 'medicine', skillNature: 'nature', skillPerception: 'perception',
  skillPerformance: 'performance', skillPersuasion: 'persuasion', skillReligion: 'religion', skillSlightOfHand: 'sleight-of-hand',
  skillStealth: 'stealth', skillSurvival: 'survival'
}
const LABELS: Record<string, string> = {
  name: L.characterName, playerName: L.playerName, classLevel: L.classLevel, subclass: L.subclass, background: L.background,
  species: L.species, size: L.size, alignment: L.alignment, xp: L.xp, proficiencyBonus: L.proficiencyBonus,
  inspiration: L.heroicInspiration, passivePerception: L.passivePerception, ac: 'КД', init: L.initiative, speed: L.speed,
  maxHp: L.hitPointMaximum, hp: L.currentHitPoints, tempHp: L.temporaryHitPoints, hitDiceMax: 'Кости хитов (максимум)',
  hitDice: L.hitDice, armorLight: 'Тренированность: лёгкие доспехи', armorMedium: 'Тренированность: средние доспехи',
  armorHeavy: 'Тренированность: тяжёлые доспехи', armorShields: 'Тренированность: щиты', weaponProficiencies: 'Владение оружием',
  toolProficiencies: 'Владение инструментами', languages: L.languages, attacks: L.weaponsAndCantrips,
  attacksText: L.weaponsAndCantrips, cp: 'Медные монеты', sp: 'Серебряные монеты',
  gp: 'Золотые монеты', pp: 'Платиновые монеты', equipment: L.equipment, equipment2: L.equipment,
  personalityTraits: L.personalityTraits, ideals: L.ideals, bonds: L.bonds, flaws: L.flaws, classFeatures: L.classFeatures,
  speciesTraits: L.speciesTraits, feats: L.feats, age: L.age, height: L.height, weight: L.weight, eyes: L.eyes, skin: L.skin,
  hair: L.hair, backstory: L.backstory, spellcastingClass: L.spellcastingClass, preparedSpellsTotal: 'Подготовленные заклинания',
  deathsaveSuccesses: 'Спасброски от смерти: успехи', deathsaveFailures: 'Спасброски от смерти: провалы',
  spellSaveDC: 'Сл спасброска от заклинаний', spellAttackBonus: 'Бонус атаки заклинаниями', cantrips: L.cantrips
}

export function fieldLabel(key: string): string {
  if (LABELS[key]) return LABELS[key]
  const a = ABILITIES.find((x) => key === x || key === x + 'Save' || key === x + 'SaveChecked')
  if (a) return key === a ? abilityName(a) : key.endsWith('Checked') ? `Владение спасброском: ${abilityName(a)}` : `Спасбросок: ${abilityName(a)}`
  const skill = SKILL_OF[key.replace(/Checked$/, '')]
  if (skill) {
    const name = nameOf(skills.find((x) => x.id === skill)) || nameOf(byId.skill[skill])
    return key.endsWith('Checked') ? `Владение навыком: ${name}` : `Навык: ${name}`
  }
  const slots = key.match(/^lvl(\d)SpellSlotsTotal$/)
  if (slots) return `Ячейки ${slots[1]} круга`
  const used = key.match(/^lvl(\d)SpellSlotsUsed$/)
  if (used) return `Потраченные ячейки ${used[1]} круга`
  const list = key.match(/^lvl(\d)Spells$/)
  if (list) return `Заклинания ${list[1]} круга`
  return key
}

// the element in the sheet that shows a field (checkbox fields live in the row of their value)
export const fieldTarget = (key: string) => key.replace(/(Save|^skill\w+)Checked$/, '$1').replace(/SpellSlotsUsed$/, 'SpellSlotsTotal')

const LINE_FIELDS = new Set(['classFeatures', 'speciesTraits', 'feats', 'attacksText', 'backstory', 'equipment2', 'personalityTraits', 'ideals', 'bonds', 'flaws'])
const LIST_FIELDS = new Set(['weaponProficiencies', 'toolProficiencies', 'languages', 'equipment'])

const text = (v: unknown) => (v == null || v === false ? '' : v === true ? 'да' : String(v))

function diffParts(key: string, before: string[], after: string[], why: Why, out: ChangeEntry[]) {
  const was = new Set(before.map(norm))
  const now = new Set(after.map(norm))
  const gone = before.filter((x) => !now.has(norm(x)))
  const added = after.filter((x) => !was.has(norm(x)))
  // a line rewritten with new numbers keeps its start («Второе дыхание:», «Таблица класса (»): it reads as "old → new"
  const head = (x: string) => norm(x.split(/[:(]/)[0])
  for (const x of added) {
    const i = gone.findIndex((g) => head(g) === head(x))
    const from = i >= 0 ? gone.splice(i, 1)[0] : ''
    out.push({ field: key, label: fieldLabel(key), from, to: x, why: why.forPart(key, x) })
  }
  for (const x of gone) out.push({ field: key, label: fieldLabel(key), from: x, to: '', why: why.forPart(key, x) || 'Удалено' })
}

const attackText = (a: DnDAttack) => [a.bonus, a.damage, a.notes].filter(Boolean).join(', ')

function diffRows(key: string, before: (DnDAttack | DnDSpell)[], after: (DnDAttack | DnDSpell)[], why: Why, out: ChangeEntry[]) {
  const named = (rows: (DnDAttack | DnDSpell)[]) => new Map(rows.filter((r) => r?.name).map((r) => [norm(String(r.name)), r]))
  const was = named(before)
  const now = named(after)
  const show = (r: DnDAttack | DnDSpell) =>
    key === 'attacks' ? `${r.name}: ${attackText(r as DnDAttack)}` : `${r.name}${(r as DnDSpell).prepared ? ' (подготовлено)' : ''}`
  for (const [k, r] of now) {
    const old = was.get(k)
    if (!old) out.push({ field: key, label: fieldLabel(key), from: '', to: show(r), why: why.forPart(key, String(r.name)) })
    else if (show(old) !== show(r)) out.push({ field: key, label: fieldLabel(key), from: show(old), to: show(r), why: why.forPart(key, String(r.name)) })
  }
  for (const [k, r] of was) if (!now.has(k)) out.push({ field: key, label: fieldLabel(key), from: show(r), to: '', why: why.forPart(key, String(r.name)) })
}

export function diffCharacter(before: DnDCharacter, after: DnDCharacter, why: Why): ChangeEntry[] {
  const out: ChangeEntry[] = []
  const keys = [...new Set([...Object.keys(after), ...Object.keys(before)])].filter((k) => k !== 'changelog' && k !== 'inventory' && k !== 'worn')
  for (const key of keys) {
    const a = before[key]
    const b = after[key]
    if (Array.isArray(a) || Array.isArray(b)) {
      diffRows(key, (a || []) as DnDAttack[], (b || []) as DnDAttack[], why, out)
      continue
    }
    if (text(a) === text(b)) continue
    if (LINE_FIELDS.has(key)) diffParts(key, text(a).split('\n').filter((x) => x.trim()), text(b).split('\n').filter((x) => x.trim()), why, out)
    else if (LIST_FIELDS.has(key)) diffParts(key, text(a).split(/,\s*/).filter((x) => x.trim()), text(b).split(/,\s*/).filter((x) => x.trim()), why, out)
    else out.push({ field: key, label: fieldLabel(key), from: text(a), to: text(b), why: why.forField(key) })
  }
  return out
}

// the event appended to the character's log
export function logEvent(before: DnDCharacter, after: DnDCharacter, why: Why, title: string, keep: ChangeEvent[]): DnDCharacter {
  const entries = diffCharacter(before, after, why)
  const event: ChangeEvent = { id: `${Date.now().toString(36)}-${keep.length}`, title, at: new Date().toISOString(), entries }
  return { ...after, changelog: [...keep, event] }
}
