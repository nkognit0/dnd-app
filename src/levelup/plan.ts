// What one class level (no multiclassing) gives and lets the player choose, from the
// class table, the level-up data in the database and what the sheet already has.
import {
  ABILITIES, Ability, abilityName, byId, categoryItems, classFeatures, classOptions, feats, languages, nameOf, ruName,
  skills, speciesOptions, spells, weapons
} from '../data'
import type { ClassFeatureData, ClassLevel, FeatData, LevelUpChoice, LevelUpGrant, SpellData, SubclassData } from '../data'
import { mod } from '../rules/derive'
import type { Option } from '../wizard/fields'
import { ARMOR_RU } from '../wizard/steps/common'
import type { SheetInfo } from './read'

export interface ChoiceDef {
  key: string
  label: string
  // the feature or feat the choice belongs to, shown as the group title
  source: string
  count: number
  // may be left empty (replacements and swaps)
  optional?: boolean
  options: Option[]
  description?: string
}

export interface LevelPicks {
  hp: { method: 'fixed' | 'roll' | null; roll: number | null }
  subclass: string | null
  feat: string | null
  // every other choice, by ChoiceDef.key
  choices: Record<string, string[]>
}

export const emptyPicks = (): LevelPicks => ({ hp: { method: null, roll: null }, subclass: null, feat: null, choices: {} })

const skillName = (id: string) => nameOf(byId.skill[id])
const itemName = (id: string) => nameOf(byId.item[id])
const spellName = (id: string) => nameOf(byId.spell[id])
const options = <T,>(list: T[], value: (x: T) => string, label: (x: T) => string, hint?: (x: T) => string | undefined): Option[] =>
  list.map((x) => ({ value: value(x), label: label(x), hint: hint?.(x) }))

export const row = (info: SheetInfo, level: number): ClassLevel => info.cls.levels[level - 1]
export const nextLevel = (info: SheetInfo) => info.level + 1

const activeAt = (c: { level?: number; levels?: [number, number] }, level: number) =>
  c.level === level || (c.levels ? c.levels[0] <= level && level <= c.levels[1] : false)

// ------------------------------------------------------------------ what the level gives

export function classFeaturesAt(info: SheetInfo, level: number): ClassFeatureData[] {
  return classFeatures.filter((f) => f.class === info.cls.id && f.levels.includes(level) && !/subclass/.test(f.feature))
}

export function subclassOf(info: SheetInfo, picks: LevelPicks): SubclassData | null {
  return info.subclass || (picks.subclass ? byId.subclass[picks.subclass] : null)
}

export function subclassFeaturesAt(sub: SubclassData | null, level: number) {
  return (sub?.features || []).filter((f) => f.level === level)
}

export const subclassStepNeeded = (info: SheetInfo) =>
  !info.subclass && classFeatures.some((f) => f.class === info.cls.id && /subclass$|subclasses$/.test(f.feature) && f.levels.includes(nextLevel(info)))

export function featStepKind(info: SheetInfo): 'asi' | 'epic-boon' | null {
  const features = row(info, nextLevel(info)).features
  if (features.includes('epic-boon')) return 'epic-boon'
  if (features.includes('ability-score-improvement')) return 'asi'
  return null
}

// species traits and lineage spells that start at this character level
export function speciesGainsAt(info: SheetInfo, level: number) {
  const traits = info.species.traits.filter((t) => t.level === level)
  const option = info.speciesOption
  const lineageSpells = (option?.spells || []).filter((x) => x.character_level === level).map((x) => x.spell)
  return { traits, lineageSpells }
}

export function speciesLineageMissing(info: SheetInfo): boolean {
  const level = nextLevel(info)
  const lineage = speciesOptions.some((o) => o.species === info.species.id && o.spells?.some((x) => x.character_level === level))
  return lineage && !info.speciesOption
}

// ------------------------------------------------------------------ feats

function hasSpellcasting(info: SheetInfo, picks: LevelPicks) {
  return Boolean(info.cls.spellcasting || subclassOf(info, picks)?.spellcasting)
}

function hasFightingStyleFeature(info: SheetInfo, level: number) {
  return classFeatures.some((f) => f.class === info.cls.id && f.feature === 'fighting-style' && f.levels[0] <= level)
}

export function featAllowed(info: SheetInfo, picks: LevelPicks, f: FeatData, kind: 'asi' | 'epic-boon'): boolean {
  const level = nextLevel(info)
  if (f.category === 'epic-boon' && kind !== 'epic-boon') return false
  if (f.category === 'fighting-style' && !hasFightingStyleFeature(info, level)) return false
  if (!f.repeatable && info.feats.has(f.id)) return false
  const p = f.prerequisite || {}
  if (p.minimum_level && level < p.minimum_level) return false
  if (p.ability_any && !p.ability_any.some((a) => info.scores[a] >= (p.ability_min ?? 13))) return false
  if (p.armor_training && !info.armor.has(p.armor_training)) return false
  if (p.spellcasting && !hasSpellcasting(info, picks)) return false
  return true
}

export function featOptions(info: SheetInfo, picks: LevelPicks, kind: 'asi' | 'epic-boon'): Option[] {
  const order = kind === 'epic-boon' ? ['epic-boon', 'general', 'origin', 'fighting-style'] : ['general', 'origin', 'fighting-style']
  const cat: Record<string, string> = { 'epic-boon': 'эпический дар', general: 'общая', origin: 'происхождения', 'fighting-style': 'боевой стиль' }
  return feats
    .filter((f) => featAllowed(info, picks, f, kind))
    .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || nameOf(a).localeCompare(nameOf(b), 'ru'))
    .map((f) => ({ value: f.id, label: nameOf(f), hint: cat[f.category] }))
}

// ------------------------------------------------------------------ choice helpers

// Skills the character is proficient in with this level's other picks; the choice being
// built (except) is left out so its own picks stay among its options.
export function proficientSkills(info: SheetInfo, picks: LevelPicks, except?: string): Set<string> {
  const out = new Set(info.skills)
  for (const [key, vals] of Object.entries(picks.choices)) {
    if (key === except) continue
    if (/:skill$|:skill-or-expertise$/.test(key)) vals.forEach((v) => out.add(v))
    if (key === 'ft:skill-or-tool') vals.filter((v) => v.startsWith('skill:')).forEach((v) => out.add(v.slice(6)))
  }
  for (const g of grantsAt(info, picks)) g.skills?.forEach((s) => out.add(s))
  return out
}

const isSpellKey = (key: string) => key.startsWith('sp:') || /:(spell|cantrip|spell-\d)$/.test(key)

function knownSpellIds(info: SheetInfo, picks: LevelPicks, except?: string): Set<string> {
  const out = new Set(info.spells.map((s) => s.id))
  for (const [key, vals] of Object.entries(picks.choices)) if (key !== except && isSpellKey(key)) vals.forEach((v) => out.add(v))
  return out
}

function spellPool(lists: string[] | 'any', level: number | number[], filter?: (s: SpellData) => boolean): SpellData[] {
  const levels = Array.isArray(level) ? level : [level]
  return spells
    .filter((s) => levels.includes(s.level) && (lists === 'any' || s.classes.some((c) => lists.includes(c))))
    .filter((s) => !filter || filter(s))
    .sort((a, b) => a.level - b.level || nameOf(a).localeCompare(nameOf(b), 'ru'))
}

const spellOptions = (list: SpellData[]): Option[] =>
  list.map((s) => ({
    value: s.id,
    label: nameOf(s),
    hint: [s.level ? s.level + ' круг' : 'заговор', s.concentration && 'концентрация', s.ritual && 'ритуал'].filter(Boolean).join(', ')
  }))

// highest spell level the character has slots for at this level (class or subclass spellcasting)
export function maxSpellLevel(info: SheetInfo, picks: LevelPicks, level = nextLevel(info)): number {
  const r = row(info, level)
  if (r.pact_slots) return r.pact_slots.slot_level
  const slots = casterSlots(info, picks, level)
  let max = 0
  slots.forEach((n, i) => { if (n > 0) max = i + 1 })
  return max
}

export function casterSlots(info: SheetInfo, picks: LevelPicks, level: number): number[] {
  const sc = subclassOf(info, picks)?.spellcasting
  if (sc) return sc.levels[String(level)]?.spell_slots || []
  return row(info, level).spell_slots || []
}

const optionGroupName: Record<string, string> = {
  'eldritch-invocation': 'воззвание', metamagic: 'вариант метамагии', maneuvers: 'приём',
  'artificer-magic-item-plans': 'схему', 'blessed-strikes': 'вариант', 'elemental-fury': 'вариант'
}

function knownOptions(info: SheetInfo, picks: LevelPicks, group: string): string[] {
  const out = [...info.options].filter((k) => k.startsWith(group + ':')).map((k) => k.slice(group.length + 1))
  for (const [key, vals] of Object.entries(picks.choices)) if (key.endsWith(':' + group)) out.push(...vals)
  return out
}

function invocationAllowed(o: (typeof classOptions)[string][number], level: number, info: SheetInfo, picks: LevelPicks): boolean {
  if ((o.min_level ?? 1) > level) return false
  const pre = o.prerequisite || ''
  const needInvocation = pre.match(/(Pact of the \w+|Thirsting Blade) Invocation/)
  if (needInvocation) {
    const id = needInvocation[1].toLowerCase().replace(/\s+/g, '-')
    if (!knownOptions(info, picks, 'eldritch-invocation').includes(id)) return false
  }
  if (/Warlock Cantrip That Deals Damage/.test(pre)) {
    const viaAttack = /Attack Roll/.test(pre)
    const ok = [...knownSpellIds(info, picks)].some((id) => {
      const s = byId.spell[id]
      return s && s.level === 0 && s.classes.includes('warlock') && s.damage && (!viaAttack || s.attack_type)
    })
    if (!ok) return false
  }
  return true
}

function grantSummary(g: LevelUpGrant): string {
  const parts: string[] = []
  if (g.skills) parts.push('навыки: ' + g.skills.map(skillName).join(', '))
  if (g.tools) parts.push('инструменты: ' + g.tools.map(itemName).join(', '))
  if (g.weapons) parts.push('оружие: ' + g.weapons.map((w) => (w === 'martial' ? 'воинское' : 'воинское дальнобойное')).join(', '))
  if (g.armor) parts.push('доспехи: ' + g.armor.map((a) => ARMOR_RU[a].toLowerCase()).join(', '))
  if (g.saves) parts.push('спасброски: ' + g.saves.map(abilityName).join(', '))
  if (g.cantrips) parts.push('заговоры: ' + g.cantrips.map(spellName).join(', '))
  if (g.spells) parts.push('всегда подготовлены: ' + g.spells.map(spellName).join(', '))
  if (g.rituals) parts.push('ритуалы: ' + g.rituals.map(spellName).join(', '))
  return parts.join('; ')
}

// fixed grants of the class, subclass and species at this level (feat grants are in featGrants)
export function grantsAt(info: SheetInfo, picks: LevelPicks): (LevelUpGrant & { source: string })[] {
  const level = nextLevel(info)
  const featureName = (feature?: string) =>
    nameOf(classFeatures.find((f) => f.class === info.cls.id && f.feature === feature)) || feature || ''
  const out: (LevelUpGrant & { source: string })[] = []
  for (const g of info.cls.level_up_grants) if (g.level === level) out.push({ ...g, source: featureName(g.feature) })
  const sub = subclassOf(info, picks)
  for (const g of sub?.grants || []) {
    if (g.level !== level) continue
    out.push({ ...g, source: nameOf(sub!.features.find((f) => f.id === g.feature) as never) || nameOf(sub) })
  }
  return out
}

export function grantText(info: SheetInfo, picks: LevelPicks): { source: string; text: string }[] {
  return grantsAt(info, picks).map((g) => ({ source: g.source, text: grantSummary(g) })).filter((x) => x.text)
}

function countOf(c: LevelUpChoice, info: SheetInfo): number {
  if (c.count === 'proficiency_bonus') return row(info, nextLevel(info)).proficiency_bonus
  return c.count ?? 1
}

// one database choice -> one or more UI choices
function choiceDefs(info: SheetInfo, picks: LevelPicks, c: LevelUpChoice, prefix: string, source: string): ChoiceDef[] {
  const level = nextLevel(info)
  const key = `${prefix}${c.id}`
  const count = countOf(c, info)
  switch (c.type) {
    case 'skill': {
      const listed = c.from === 'class-list'
        ? info.cls.skill_proficiencies.choose[0]?.from
        : c.from
      const pool = (listed === 'any' || !listed ? skills.map((s) => s.id) : listed).filter((id) => !proficientSkills(info, picks, key + ':skill').has(id))
      return [{ key: key + ':skill', label: count > 1 ? `Навыки (${count})` : 'Навык', source, count, options: options(pool, (x) => x, skillName) }]
    }
    case 'expertise': {
      const taken = new Set(Object.entries(picks.choices).filter(([k]) => k !== key + ':expertise' && k.endsWith(':expertise')).flatMap(([, v]) => v))
      const prof = [...proficientSkills(info, picks)].filter((id) => !info.expertise.has(id) && !taken.has(id))
      const pool = Array.isArray(c.from) ? prof.filter((id) => (c.from as string[]).includes(id)) : prof
      return [{ key: key + ':expertise', label: count > 1 ? `Экспертность (${count})` : 'Экспертность', source, count, options: options(pool, (x) => x, skillName) }]
    }
    case 'skill-or-expertise': {
      const prof = proficientSkills(info, picks, key + ':skill-or-expertise')
      const pool = (c.from as string[]).filter((id) => !info.expertise.has(id))
      return [{
        key: key + ':skill-or-expertise', label: 'Навык (владение, а если оно уже есть — экспертность)', source, count,
        options: options(pool, (x) => x, skillName, (x) => (prof.has(x) ? 'станет экспертностью' : 'владение'))
      }]
    }
    case 'tool': {
      const pool = categoryItems(c.from_category || '').filter((t) => !info.tools.has(t.id))
      return [{ key: key + ':tool', label: 'Инструменты', source, count, options: options(pool, (x) => x.id, nameOf) }]
    }
    case 'language': {
      const pool = languages.filter((l) => !info.languages.has(l.id))
      return [{ key: key + ':language', label: `Языки (${count})`, source, count, options: options(pool, (x) => x.id, nameOf) }]
    }
    case 'damage-type': {
      const pool = (c.from as string[]) || []
      return [{ key: key + ':damage-type', label: 'Тип урона', source, count, options: options(pool, (x) => x, (x) => ruName('damage_types', x)) }]
    }
    case 'spell': {
      const max = maxSpellLevel(info, picks)
      const lvls = c.spell_level === 'slot-or-cantrip' ? Array.from({ length: max + 1 }, (_, i) => i) : [Number(c.spell_level ?? 1)]
      const known = knownSpellIds(info, picks, key + ':spell')
      const pool = spellPool(c.lists || 'any', lvls, (s) =>
        !known.has(s.id) && (!c.schools || c.schools.includes(s.school)) && (!c.ritual || s.ritual))
      const label = c.spell_level === 'slot-or-cantrip' ? `Заклинания (${count})` : `Заклинание ${lvls[0]} круга` + (count > 1 ? ` (${count})` : '')
      return [{ key: key + ':spell', label, source, count, options: spellOptions(pool) }]
    }
    case 'class-option': {
      const group = c.options_group!
      const known = knownOptions(info, { ...picks, choices: {} }, group)
      let need = count
      if (c.total_from_table) need = Number(row(info, level).columns[c.total_from_table] ?? 0) - known.length
      if (c.total_by_level) {
        const total = Object.entries(c.total_by_level).filter(([l]) => Number(l) <= level).sort((a, b) => Number(a[0]) - Number(b[0])).pop()?.[1] ?? 0
        need = total - known.length
      }
      const all = classOptions[group] || []
      const allowed = all.filter((o) =>
        (group !== 'eldritch-invocation' || invocationAllowed(o, level, info, picks)) &&
        ((o.min_level ?? 1) <= level || group === 'eldritch-invocation'))
      const fresh = allowed.filter((o) => !known.includes(o.id) || (o as { repeatable?: boolean }).repeatable)
      const out: ChoiceDef[] = []
      const word = optionGroupName[group] || 'вариант'
      const swapIn = picks.choices[key + ':replace-in'] || []
      if (need > 0) {
        out.push({
          key: key + ':' + group, label: need > 1 ? `Новые (${need})` : `Новый ${word}`, source, count: need,
          options: options(fresh.filter((o) => !swapIn.includes(o.id)), (o) => o.id, nameOf,
            (o) => (o.min_level && o.min_level > 1 ? `с ${o.min_level}-го уровня` : undefined))
        })
      }
      if (c.replace && known.length) {
        const outKey = key + ':replace-out'
        out.push({ key: outKey, label: `Заменить ${word} (можно не менять)`, source, count: 1, optional: true,
          options: options(known.map((id) => all.find((o) => o.id === id)).filter(Boolean) as typeof all, (o) => o.id, nameOf) })
        if ((picks.choices[outKey] || []).length) {
          out.push({ key: key + ':replace-in', label: 'Взамен', source, count: 1,
            options: options(fresh.filter((o) => !(picks.choices[key + ':' + group] || []).includes(o.id)), (o) => o.id, nameOf) })
        }
      }
      return out
    }
    case 'fighting-style': {
      const styles = feats.filter((f) => f.category === 'fighting-style' && !info.feats.has(f.id) && f.id !== info.fightingStyle)
      const opts = options(styles, (f) => f.id, nameOf)
      if (c.alternative) opts.push({ value: c.alternative.id, label: c.alternative.name_ru, hint: `${c.alternative.cantrips} заговора ${ruName('classes', c.alternative.list, c.alternative.list)}` })
      const out: ChoiceDef[] = [{ key: key + ':style', label: 'Боевой стиль', source, count: 1, options: opts }]
      if (c.alternative && (picks.choices[key + ':style'] || [])[0] === c.alternative.id) {
        const known = knownSpellIds(info, picks, key + ':cantrip')
        out.push({ key: key + ':cantrip', label: `Заговоры (${c.alternative.cantrips})`, source, count: c.alternative.cantrips,
          options: spellOptions(spellPool([c.alternative.list], 0, (s) => !known.has(s.id))) })
      }
      return out
    }
    case 'fighting-style-swap': {
      if (!info.fightingStyle) return []
      const styles = feats.filter((f) => f.category === 'fighting-style' && f.id !== info.fightingStyle && !info.feats.has(f.id))
      return [{ key: key + ':style', label: `Заменить боевой стиль «${nameOf(byId.feat[info.fightingStyle])}» (можно не менять)`, source,
        count: 1, optional: true, options: options(styles, (f) => f.id, nameOf) }]
    }
    case 'spell-mastery': {
      return (c.spell_levels || []).map((l) => ({
        key: `${key}:mastery-${l}`, label: `Заклинание ${l} круга из книги`, source, count: 1,
        options: spellOptions(info.spells.filter((s) => s.level === l).map((s) => byId.spell[s.id]).filter(Boolean))
      }))
    }
    case 'signature-spells': {
      const l = Number(c.spell_level ?? 3)
      return [{ key: key + ':signature', label: `Заклинания ${l} круга из книги (${count})`, source, count,
        options: spellOptions(info.spells.filter((s) => s.level === l).map((s) => byId.spell[s.id]).filter(Boolean)) }]
    }
    default:
      return []
  }
}

// ------------------------------------------------------------------ the features step

export function featureChoices(info: SheetInfo, picks: LevelPicks): ChoiceDef[] {
  const level = nextLevel(info)
  const name = (feature?: string) => nameOf(classFeatures.find((f) => f.class === info.cls.id && f.feature === feature)) || ''
  const out: ChoiceDef[] = []
  for (const c of info.cls.level_up_choices) {
    if (!activeAt(c, level) || c.type === 'spellbook') continue
    out.push(...choiceDefs(info, picks, c, 'f:', name(c.feature)))
  }
  const sub = subclassOf(info, picks)
  for (const c of sub?.choices || []) {
    if (!activeAt(c, level)) continue
    const fname = nameOf(sub!.features.find((f) => f.id === c.feature) as never) || nameOf(sub)
    out.push(...choiceDefs(info, picks, c, 's:', fname))
  }
  // grants with a fallback choice when the character already has the granted proficiency
  for (const g of grantsAt(info, picks)) {
    if (g.tool_fallback) {
      const already = (g.tools || []).filter((t) => info.tools.has(t))
      if (already.length) {
        const pool = categoryItems(g.tool_fallback).filter((t) => !info.tools.has(t.id) && !(g.tools || []).includes(t.id))
        out.push({ key: `g:${g.feature}:tool`, label: `Вместо ${already.map(itemName).join(' и ')} (уже есть)`, source: g.source,
          count: already.length, options: options(pool, (x) => x.id, nameOf) })
      }
    }
    if (g.save_fallback && (g.saves || []).every((a) => info.saves.has(a))) {
      out.push({ key: `g:${g.feature}:save`, label: 'Спасбросок (основной уже есть)', source: g.source, count: 1,
        options: options(g.save_fallback.filter((a) => !info.saves.has(a)), (a) => a, abilityName) })
    }
    if (g.cantrip_fallback_list && (g.cantrips || []).some((id) => info.spells.some((s) => s.id === id))) {
      const known = knownSpellIds(info, picks, `g:${g.feature}:cantrip`)
      out.push({ key: `g:${g.feature}:cantrip`, label: 'Заговор (указанный уже известен)', source: g.source, count: 1,
        options: spellOptions(spellPool([g.cantrip_fallback_list], 0, (s) => !known.has(s.id))) })
    }
  }
  // more weapon masteries from the class table
  const col = (l: number) => Number(row(info, l).columns.weapon_mastery ?? 0)
  if (col(level) > col(level - 1)) {
    const pool = weapons.filter((w) => w.mastery_classes.includes(info.cls.id) && !info.masteries.has(w.id))
    out.push({ key: 'f:weapon-mastery:weapons', label: `Ещё оружие с мастерством (${col(level) - col(level - 1)})`, source: name('weapon-mastery'),
      count: col(level) - col(level - 1),
      options: options(pool, (w) => w.id, (w) => nameOf(w), (w) => ruName('weapon_masteries', w.mastery).toLowerCase()) })
  }
  return out
}

// ------------------------------------------------------------------ feats step

export function featChoices(info: SheetInfo, picks: LevelPicks): ChoiceDef[] {
  const f = picks.feat ? byId.feat[picks.feat] : null
  if (!f) return []
  const source = nameOf(f)
  const out: ChoiceDef[] = []
  for (const ch of f.choices || []) {
    const c = ch as unknown as Omit<LevelUpChoice, 'type'> & { type: string; from_categories?: string[] }
    if (c.type === 'ability-increase') {
      const max = c.max_score ?? 20
      const o = c.options || []
      if (o.some((x) => x.plus_2)) {
        // the Ability Score Improvement feat: +2 to one score or +1 to two
        out.push({ key: 'ft:mode', label: 'Как увеличить', source, count: 1,
          options: [{ value: '2', label: '+2 к одной характеристике' }, { value: '1-1', label: '+1 к двум характеристикам' }] })
        const mode = (picks.choices['ft:mode'] || [])[0]
        if (mode === '2') out.push({ key: 'ft:plus2', label: '+2 к', source, count: 1,
          options: options(ABILITIES.filter((a) => info.scores[a] + 2 <= max), (a) => a, abilityName, (a) => String(info.scores[a])) })
        if (mode === '1-1') out.push({ key: 'ft:plus1', label: '+1 к (две)', source, count: 2,
          options: options(ABILITIES.filter((a) => info.scores[a] + 1 <= max), (a) => a, abilityName, (a) => String(info.scores[a])) })
      } else {
        const from = (o[0]?.from || ABILITIES).filter((a) => info.scores[a] + 1 <= max && (!o[0]?.unproficient_saves_only || !info.saves.has(a)))
        out.push({ key: 'ft:plus1', label: '+1 к', source, count: 1, options: options(from, (a) => a, abilityName, (a) => String(info.scores[a])) })
      }
      continue
    }
    // origin feats taken at a higher level keep their own choices
    if (c.type === 'skill-or-tool') {
      const pool = [
        ...skills.filter((s) => !info.skills.has(s.id)).map((s) => ({ value: 'skill:' + s.id, label: nameOf(s), hint: 'навык' })),
        ...Object.values(byId.item).filter((t) => t.category === 'tool' && !info.tools.has(t.id)).map((t) => ({ value: 'tool:' + t.id, label: nameOf(t), hint: 'инструмент' }))
      ]
      out.push({ key: 'ft:skill-or-tool', label: 'Навыки или инструменты', source, count: Number(c.count) || 3, options: pool })
      continue
    }
    if (c.type === 'spell-list') {
      out.push({ key: 'ft:spell-list', label: 'Список заклинаний', source, count: 1,
        options: ((c.from as string[]) || ['cleric', 'druid', 'wizard']).map((l) => ({ value: l, label: ruName('classes', l, l) })) })
      continue
    }
    if (c.type === 'ability' && f.id === 'magic-initiate') {
      out.push({ key: 'ft:ability', label: 'Заклинательная характеристика', source, count: 1,
        options: options((c.from as Ability[]) || ['int', 'wis', 'cha'], (a) => a, abilityName) })
      continue
    }
    if (c.type === 'spell' && f.id === 'magic-initiate') {
      const list = (picks.choices['ft:spell-list'] || [])[0]
      if (!list) continue
      const lvl = Number((c as { spell_level?: number }).spell_level ?? 0)
      const known = knownSpellIds(info, picks, `ft:spell-${lvl}`)
      out.push({ key: `ft:spell-${lvl}`, label: lvl ? 'Заклинание 1 круга' : 'Заговоры (2)', source, count: Number(c.count) || 1,
        options: spellOptions(spellPool([list], lvl, (s) => !known.has(s.id))) })
      continue
    }
    if (c.type === 'tool') {
      const pool = ((c.from_categories || []) as string[]).flatMap((cat) => categoryItems(cat)).filter((t) => !info.tools.has(t.id))
      out.push({ key: 'ft:tool', label: 'Инструменты', source, count: Number(c.count) || 3, options: options(pool, (x) => x.id, nameOf) })
      continue
    }
    out.push(...choiceDefs(info, picks, c as LevelUpChoice, 'ft-x:', source))
  }
  return out
}

// ------------------------------------------------------------------ spells step

export interface SpellPlan {
  ability: Ability
  list: string
  cantrips: number
  prepared: number
  maxLevel: number
  spellbook: number
  savant: { school: string; count: number; maxLevel: number } | null
  cantripSwap: boolean
  preparedSwap: boolean
  extraLists: string[]
  // spells that become always prepared or known without choosing
  automatic: { id: string; tag: string }[]
}

export function spellPlan(info: SheetInfo, picks: LevelPicks): SpellPlan | null {
  const level = nextLevel(info)
  const sub = subclassOf(info, picks)
  const sc = sub?.spellcasting
  const cls = info.cls
  const automatic: { id: string; tag: string }[] = []
  for (const id of sub?.always_prepared?.[String(level)] || []) automatic.push({ id, tag: 'подкласс' })
  for (const g of grantsAt(info, picks)) {
    for (const id of g.spells || []) automatic.push({ id, tag: 'подкласс' })
    for (const id of g.cantrips || []) if (!info.spells.some((s) => s.id === id)) automatic.push({ id, tag: 'подкласс' })
  }
  for (const id of speciesGainsAt(info, level).lineageSpells) automatic.push({ id, tag: 'вид' })
  if (sc && sub && level === sub.level) for (const id of sc.fixed_cantrips || []) automatic.push({ id, tag: '' })

  const valueAt = (rec: Record<string, number>, l: number) =>
    Object.entries(rec).filter(([k]) => Number(k) <= l).sort((a, b) => Number(a[0]) - Number(b[0])).pop()?.[1] ?? 0

  let plan: SpellPlan | null = null
  if (cls.spellcasting) {
    const r = row(info, level)
    const p = row(info, level - 1)
    const extraLists = cls.level_up_grants.filter((g) => g.extra_spell_lists && (g.level ?? 99) <= level).flatMap((g) => g.extra_spell_lists!)
    plan = {
      ability: cls.spellcasting.ability,
      list: cls.spellcasting.list,
      cantrips: (r.cantrips ?? 0) - (p.cantrips ?? 0),
      prepared: (r.prepared_spells ?? 0) - (p.prepared_spells ?? 0),
      maxLevel: maxSpellLevel(info, picks),
      spellbook: cls.level_up_choices.some((c) => c.type === 'spellbook' && activeAt(c, level)) ? 2 : 0,
      savant: null,
      cantripSwap: cls.spellcasting.cantrip_swap === 'level-up',
      preparedSwap: cls.spellcasting.prepared_swap?.when === 'level-up',
      extraLists,
      automatic
    }
    if (sub?.savant_school) {
      const newSlotLevel = maxSpellLevel(info, picks, level) > maxSpellLevel(info, picks, level - 1)
      if (level === sub.level) plan.savant = { school: sub.savant_school, count: 2, maxLevel: 2 }
      else if (level > sub.level && newSlotLevel) plan.savant = { school: sub.savant_school, count: 1, maxLevel: plan.maxLevel }
    }
  } else if (sc && sub && level >= sub.level) {
    const prev = level - 1 >= sub.level ? sc.levels[String(level - 1)]?.prepared_spells ?? 0 : 0
    plan = {
      ability: sc.ability,
      list: sc.list,
      cantrips: valueAt(sc.cantrips, level) - (level - 1 >= sub.level ? valueAt(sc.cantrips, level - 1) : 0),
      prepared: (sc.levels[String(level)]?.prepared_spells ?? 0) - prev,
      maxLevel: maxSpellLevel(info, picks),
      spellbook: 0,
      savant: null,
      cantripSwap: level > sub.level && sc.cantrip_swap === 'level-up',
      preparedSwap: level > sub.level && sc.prepared_swap?.when === 'level-up',
      extraLists: [],
      automatic
    }
  }
  if (!plan && !automatic.length) return null
  return plan || { ability: 'int', list: '', cantrips: 0, prepared: 0, maxLevel: 0, spellbook: 0, savant: null,
    cantripSwap: false, preparedSwap: false, extraLists: [], automatic }
}

export function spellChoices(info: SheetInfo, picks: LevelPicks): ChoiceDef[] {
  const plan = spellPlan(info, picks)
  if (!plan || !plan.list) return []
  const known = new Set(info.spells.map((s) => s.id))
  const auto = new Set(plan.automatic.map((a) => a.id))
  const taken = (except: string) => {
    const out = new Set<string>([...known, ...auto])
    for (const [k, v] of Object.entries(picks.choices)) if (k !== except && (k.startsWith('sp:') || /spell|cantrip/.test(k))) v.forEach((x) => out.add(x))
    return out
  }
  const lists = [plan.list, ...plan.extraLists]
  const levels = Array.from({ length: plan.maxLevel }, (_, i) => i + 1)
  const source = 'Заклинания'
  const out: ChoiceDef[] = []
  if (plan.cantrips > 0) {
    out.push({ key: 'sp:cantrips', label: `Новые заговоры (${plan.cantrips})`, source, count: plan.cantrips,
      options: spellOptions(spellPool([plan.list], 0, (s) => !taken('sp:cantrips').has(s.id))) })
  }
  if (plan.cantripSwap) {
    const mine = info.spells.filter((s) => s.level === 0 && !s.tag && byId.spell[s.id]?.classes.includes(plan.list))
    if (mine.length) {
      out.push({ key: 'sp:cantrip-out', label: 'Заменить заговор (можно не менять)', source, count: 1, optional: true,
        options: spellOptions(mine.map((s) => byId.spell[s.id])) })
      if ((picks.choices['sp:cantrip-out'] || []).length) {
        out.push({ key: 'sp:cantrip-in', label: 'Новый заговор взамен', source, count: 1,
          options: spellOptions(spellPool([plan.list], 0, (s) => !taken('sp:cantrip-in').has(s.id))) })
      }
    }
  }
  if (plan.spellbook > 0) {
    out.push({ key: 'sp:spellbook', label: `В книгу заклинаний (${plan.spellbook})`, source, count: plan.spellbook,
      description: `Заклинания волшебника, для которых есть ячейки: до ${plan.maxLevel} круга.`,
      options: spellOptions(spellPool([plan.list], levels, (s) => !taken('sp:spellbook').has(s.id))) })
  }
  if (plan.savant) {
    const sv = plan.savant
    out.push({ key: 'sp:savant', label: `Бесплатно в книгу: школа «${ruName('magic_schools', sv.school, sv.school)}» (${sv.count})`, source, count: sv.count,
      options: spellOptions(spellPool([plan.list], Array.from({ length: sv.maxLevel }, (_, i) => i + 1),
        (s) => s.school === sv.school && !taken('sp:savant').has(s.id))) })
  }
  if (plan.prepared > 0) {
    // a wizard prepares from the spellbook, the others from the class list
    const pool = plan.spellbook > 0 || info.cls.id === 'wizard'
      ? [...info.spells.filter((s) => s.level > 0 && !s.prepared).map((s) => s.id), ...(picks.choices['sp:spellbook'] || []), ...(picks.choices['sp:savant'] || [])]
          .map((id) => byId.spell[id]).filter(Boolean)
      : spellPool(lists, levels, (s) => !taken('sp:prepared').has(s.id))
    out.push({ key: 'sp:prepared', label: `Новые подготовленные заклинания (${plan.prepared})`, source, count: plan.prepared,
      description: plan.extraLists.length ? 'Можно брать и из списков жреца, друида и волшебника («Магические тайны»).' : undefined,
      options: spellOptions(pool) })
  }
  if (plan.preparedSwap) {
    const mine = info.spells.filter((s) => s.level > 0 && !s.tag)
    if (mine.length) {
      out.push({ key: 'sp:prepared-out', label: 'Заменить подготовленное заклинание (можно не менять)', source, count: 1, optional: true,
        options: spellOptions(mine.map((s) => byId.spell[s.id]).filter(Boolean)) })
      if ((picks.choices['sp:prepared-out'] || []).length) {
        out.push({ key: 'sp:prepared-in', label: 'Новое заклинание взамен', source, count: 1,
          options: spellOptions(spellPool(lists, levels, (s) => !taken('sp:prepared-in').has(s.id))) })
      }
    }
  }
  return out
}

// ------------------------------------------------------------------ validity

export function choicesValid(defs: ChoiceDef[], picks: LevelPicks): boolean {
  return defs.every((d) => {
    const v = picks.choices[d.key] || []
    return d.optional ? v.length <= d.count : v.length === Math.min(d.count, d.options.length)
  })
}

export function abilityIncreases(picks: LevelPicks): Partial<Record<Ability, number>> {
  const out: Partial<Record<Ability, number>> = {}
  for (const a of picks.choices['ft:plus2'] || []) out[a as Ability] = (out[a as Ability] || 0) + 2
  for (const a of picks.choices['ft:plus1'] || []) out[a as Ability] = (out[a as Ability] || 0) + 1
  return out
}

export function newScores(info: SheetInfo, picks: LevelPicks): Record<Ability, number> {
  const inc = abilityIncreases(picks)
  return Object.fromEntries(ABILITIES.map((a) => [a, info.scores[a] + (inc[a] || 0)])) as Record<Ability, number>
}

// ------------------------------------------------------------------ hit points

export interface HpGain {
  base: number
  con: number
  extras: { label: string; value: number }[]
  total: number
}

export function hpGain(info: SheetInfo, picks: LevelPicks): HpGain | null {
  const { method, roll } = picks.hp
  if (!method || (method === 'roll' && roll == null)) return null
  const level = nextLevel(info)
  const scores = newScores(info, picks)
  const conNew = mod(scores.con)
  const conOld = mod(info.scores.con)
  const base = method === 'fixed' ? info.cls.hit_points.per_level.fixed : roll!
  const extras: { label: string; value: number }[] = []
  // a die roll plus the Constitution modifier gives at least 1 hit point
  const dieAndCon = Math.max(1, base + conNew)
  if (conNew !== conOld) extras.push({ label: 'Телосложение выросло: за прошлые уровни', value: (level - 1) * (conNew - conOld) })
  if (info.species.id === 'dwarf') extras.push({ label: 'Дварфийская выдержка', value: 1 })
  if (info.feats.has('tough')) extras.push({ label: 'Черта «Крепкий»', value: 2 })
  if (picks.feat === 'tough') extras.push({ label: 'Черта «Крепкий» (взята сейчас)', value: 2 * level })
  if (picks.feat === 'boon-of-fortitude') extras.push({ label: 'Дар стойкости', value: 40 })
  const sub = subclassOf(info, picks)
  for (const g of sub?.grants || []) {
    if (!g.hp_per_class_level || g.level == null || level < g.level) continue
    extras.push({ label: nameOf(sub!.features.find((f) => f.id === g.feature) as never), value: level === g.level ? g.hp_per_class_level * level : g.hp_per_class_level })
  }
  return { base, con: conNew, extras, total: dieAndCon + extras.reduce((s, e) => s + e.value, 0) }
}
