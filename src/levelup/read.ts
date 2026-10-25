// Character sheet (filled by the creation wizard or by hand) -> what levelling up needs.
// Everything is read from the visible fields; what cannot be read is an error, not a guess.
import type { DnDCharacter } from 'dnd-sheet'
import {
  ABILITIES, Ability, abilityName, classFeatures, classOptions, classes, feats, languages, nameOf, skills, species,
  speciesOptions, spells, subclasses, toolItems, weapons
} from '../data'
import type { ClassData, Named, SpeciesData, SpeciesOption, SubclassData } from '../data'
import { mod } from '../rules/derive'
import { SKILL_FIELD } from '../rules/sheet'

export const MAX_LEVEL = 20

// option groups whose known options are found by name in the class features text
export const NAMED_OPTION_GROUPS = [
  'eldritch-invocation', 'metamagic', 'maneuvers', 'artificer-magic-item-plans', 'blessed-strikes',
  'elemental-fury', 'divine-order', 'primal-order'
]

export interface SheetSpell {
  id: string
  level: number
  prepared: boolean
  // text in parentheses after the name, e.g. "вид", "черта", "подкласс"
  tag: string
}

export interface SheetInfo {
  cls: ClassData
  level: number
  subclass: SubclassData | null
  species: SpeciesData
  speciesOption: SpeciesOption | null
  scores: Record<Ability, number>
  maxHp: number
  saves: Set<Ability>
  skills: Set<string>
  expertise: Set<string>
  tools: Set<string>
  languages: Set<string>
  armor: Set<string>
  martialWeapons: boolean
  feats: Set<string>
  fightingStyle: string | null
  masteries: Set<string>
  // "group:id" of class options named in the class features text, once per mention
  // (repeatable invocations can be known several times)
  options: string[]
  spells: SheetSpell[]
}

export interface ReadResult {
  info: SheetInfo | null
  errors: string[]
  warnings: string[]
}

export const norm = (s: string) =>
  s.toLowerCase().replace(/ё/g, 'е').replace(/[«»"'’`]/g, '').replace(/\s+/g, ' ').trim()

const toInt = (v: unknown): number | null => {
  const m = String(v ?? '').replace(/[−–]/g, '-').match(/^\s*([+-]?\d+)\s*$/)
  return m ? Number(m[1]) : null
}

const matches = (x: Named, text: string) => [nameOf(x), x.name].some((n) => n && norm(n) === norm(text))
const mentions = (x: Named, text: string) => [nameOf(x), x.name].some((n) => n && text.includes(norm(n)))

// The level number in "Класс и уровень", or null. Used by the toolbar to show the level-up button.
export function sheetLevel(c: DnDCharacter): number | null {
  const nums = String(c.classLevel ?? '').match(/\d+/g)
  return nums ? Number(nums[nums.length - 1]) : null
}

function readClass(text: string, errors: string[]): { cls: ClassData; level: number } | null {
  const nums = text.match(/\d+/g) || []
  if (!nums.length) {
    errors.push('В поле «Класс и уровень» нет номера уровня.')
    return null
  }
  if (nums.length > 1 || /[/,+]/.test(text)) {
    errors.push('В поле «Класс и уровень» несколько классов: мультикласс визард пока не поддерживает.')
    return null
  }
  const level = Number(nums[0])
  const name = text.replace(/\d+/g, '').replace(/[()]/g, ' ').trim()
  const cls = classes.find((c) => matches(c, name))
  if (!cls) {
    errors.push(`Класс «${name || text}» не найден. Напишите его так, как в списке классов, например «${nameOf(classes[0])} ${level}».`)
    return null
  }
  if (level < 1 || level > MAX_LEVEL) {
    errors.push(`Уровень ${level} вне диапазона 1–${MAX_LEVEL}.`)
    return null
  }
  return { cls, level }
}

function readSpecies(text: string, errors: string[]) {
  const [, base, opt] = text.match(/^([^(]*)(?:\((.*)\))?/) || []
  const sp = species.find((s) => matches(s, base || ''))
  if (!sp) {
    errors.push(text.trim() ? `Вид «${text.trim()}» не найден среди видов.` : 'Не заполнено поле «Вид».')
    return null
  }
  const option = opt ? speciesOptions.find((o) => o.species === sp.id && matches(o, opt)) || null : null
  return { sp, option }
}

function readSpells(c: DnDCharacter, warnings: string[]): SheetSpell[] {
  const out: SheetSpell[] = []
  const unknown: string[] = []
  for (let level = 0; level <= 9; level++) {
    const list = (level === 0 ? c.cantrips : c[`lvl${level}Spells`]) || []
    for (const s of list as { name?: string; prepared?: boolean }[]) {
      const raw = (s?.name || '').trim()
      if (!raw) continue
      const [, name, tag] = raw.match(/^(.*?)\s*(?:\(([^)]*)\))?$/) || []
      const spell = spells.find((x) => x.level === level && matches(x, name)) || spells.find((x) => matches(x, name))
      if (!spell) {
        unknown.push(raw)
        continue
      }
      out.push({ id: spell.id, level: spell.level, prepared: level === 0 || Boolean(s.prepared), tag: (tag || '').trim() })
    }
  }
  if (unknown.length) warnings.push('Не распознаны заклинания (останутся в листе как есть): ' + unknown.join(', ') + '.')
  return out
}

export function readSheet(c: DnDCharacter): ReadResult {
  const errors: string[] = []
  const warnings: string[] = []
  const head = readClass(String(c.classLevel ?? ''), errors)
  if (head && head.level >= MAX_LEVEL) errors.push(`Персонаж уже ${MAX_LEVEL}-го уровня — это максимум.`)

  const scores = {} as Record<Ability, number>
  const missing: string[] = []
  for (const a of ABILITIES) {
    const v = toInt(c[a])
    if (v == null || v < 1 || v > 30) missing.push(abilityName(a))
    else scores[a] = v
  }
  if (missing.length) errors.push('Не заполнены значения характеристик: ' + missing.join(', ') + '.')

  const maxHp = toInt(c.maxHp)
  if (maxHp == null || maxHp < 1) errors.push('Не заполнен максимум хитов.')

  const sp = readSpecies(String(c.species ?? ''), errors)

  let subclass: SubclassData | null = null
  const subText = String(c.subclass ?? '').trim()
  if (head) {
    const own = subclasses.filter((s) => s.class === head.cls.id)
    if (subText) {
      subclass = own.find((s) => matches(s, subText)) || own.find((s) => norm(subText).includes(norm(nameOf(s)))) || null
      if (!subclass) errors.push(`Подкласс «${subText}» не найден среди подклассов класса «${nameOf(head.cls)}».`)
    } else if (head.level >= (own[0]?.level ?? 3)) {
      errors.push(`Не заполнено поле «Подкласс»: с ${own[0]?.level ?? 3}-го уровня он есть у каждого класса.`)
    }
  }
  if (errors.length || !head || !sp || maxHp == null) return { info: null, errors, warnings }

  const pb = head.cls.levels[head.level - 1].proficiency_bonus
  const saves = new Set(ABILITIES.filter((a) => Boolean(c[a + 'SaveChecked'])))
  const known = new Set<string>()
  const expertise = new Set<string>()
  for (const sk of skills) {
    const field = SKILL_FIELD[sk.id]
    if (!c[field + 'Checked']) continue
    known.add(sk.id)
    const v = toInt(c[field])
    if (v != null && v - mod(scores[sk.ability]) >= 2 * pb) expertise.add(sk.id)
  }

  const toolText = norm(String(c.toolProficiencies ?? ''))
  const langText = norm(String(c.languages ?? ''))
  const featText = norm(String(c.feats ?? ''))
  // keep the lines: some features are recognised by the line they start
  const featureLines = String(c.classFeatures ?? '').split('\n').map(norm)
  const featureText = featureLines.join('\n')
  const featIds = new Set(feats.filter((f) => mentions(f, featText)).map((f) => f.id))
  // every line about a feature (the level 1 line and the lines added at later levels)
  const lineOf = (feature: string) => {
    const name = classFeatures.find((f) => f.feature === feature)?.name_ru
    return name ? featureLines.filter((l) => l.startsWith(norm(name))).join('\n') : ''
  }
  const styleLine = lineOf('fighting-style')
  const style = feats.find((f) => f.category === 'fighting-style' && (featIds.has(f.id) || (styleLine && mentions(f, styleLine))))

  const options: string[] = []
  for (const group of NAMED_OPTION_GROUPS) {
    for (const o of classOptions[group] || []) {
      if (o.class && o.class !== head.cls.id) continue
      const name = norm(nameOf(o))
      const times = name ? featureText.split(name).length - 1 : 0
      for (let i = 0; i < times; i++) options.push(group + ':' + o.id)
    }
  }
  const masteryLine = lineOf('weapon-mastery')
  const masteries = new Set(weapons.filter((w) => masteryLine && masteryLine.includes(norm(nameOf(w)))).map((w) => w.id))

  const info: SheetInfo = {
    cls: head.cls,
    level: head.level,
    subclass,
    species: sp.sp,
    speciesOption: sp.option,
    scores,
    maxHp,
    saves,
    skills: known,
    expertise,
    tools: new Set(toolItems.filter((t) => mentions(t, toolText)).map((t) => t.id)),
    languages: new Set(languages.filter((l) => mentions(l, langText)).map((l) => l.id)),
    armor: new Set(
      [c.armorLight && 'light', c.armorMedium && 'medium', c.armorHeavy && 'heavy', c.armorShields && 'shield'].filter(Boolean) as string[]
    ),
    martialWeapons: /воинск|martial/i.test(String(c.weaponProficiencies ?? '')),
    feats: featIds,
    fightingStyle: style?.id ?? null,
    masteries,
    options,
    spells: readSpells(c, warnings)
  }
  return { info, errors, warnings }
}
