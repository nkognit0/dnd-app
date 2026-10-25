// Typed access to the rules database in ../dnd-db/data (only the fields the app uses).
import abilitiesJson from '@data/abilities.json'
import skillsJson from '@data/skills.json'
import alignmentsJson from '@data/alignments.json'
import languagesJson from '@data/languages.json'
import classesJson from '@data/classes.json'
import classOptionsJson from '@data/class-options.json'
import backgroundsJson from '@data/backgrounds.json'
import speciesJson from '@data/species.json'
import speciesOptionsJson from '@data/species-options.json'
import featsJson from '@data/feats.json'
import spellsJson from '@data/spells.json'
import equipmentJson from '@data/equipment.json'
import equipmentCategoriesJson from '@data/equipment-categories.json'
import weaponsJson from '@data/weapons.json'
import armorJson from '@data/armor.json'
import classFeaturesJson from '@data/class-features.json'
import subclassesJson from '@data/subclasses.json'
import ruJson from '@data/i18n/ru.json'

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
export const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

export interface Named {
  id: string
  name: string
  name_ru?: string | null
  source?: string
}

export interface ChoiceGroup {
  count: number
  from?: string[] | 'any'
  from_categories?: string[]
}

export interface Proficiencies {
  fixed: string[]
  choose: ChoiceGroup[]
}

export interface EquipItemRef {
  item?: string | null
  qty: number
  note?: string
  category?: string
  categories?: string[]
  same_as?: 'tool_proficiency'
}

export interface EquipOption {
  id: string
  gp: number
  items?: EquipItemRef[]
}

export interface StartingEquipment {
  text: string
  options: EquipOption[]
}

export interface ClassChoice {
  id: string
  type: 'spell' | 'feat' | 'weapon-mastery' | 'expertise' | 'language' | 'class-option'
  count: number
  feature?: string
  list?: string
  spell_level?: number
  feat_category?: string
  options_group?: string
  rule?: string
  from?: string
  max_prerequisite_level?: number
  bonus_if?: Record<string, string | number>
}

export interface ClassLevel {
  level: number
  proficiency_bonus: number
  features: string[]
  cantrips?: number
  prepared_spells?: number
  spell_slots?: number[]
  pact_slots?: { count: number; slot_level: number }
  columns: Record<string, number | string | null>
}

export interface ClassFeature {
  id: string
  name: string
  name_ru?: string | null
  grants?: Record<string, unknown>
}

// ---- level-up vocabulary shared by classes, subclasses and feats (see dnd-db/README.md)
export interface LevelUpChoice {
  id: string
  feature?: string
  type:
    | 'skill' | 'expertise' | 'skill-or-expertise' | 'tool' | 'language' | 'damage-type' | 'spell' | 'class-option'
    | 'fighting-style' | 'fighting-style-swap' | 'spellbook' | 'spell-mastery' | 'signature-spells' | 'ability-increase'
  level?: number
  levels?: [number, number]
  count?: number | 'proficiency_bonus'
  from?: string[] | 'any' | 'class-list'
  from_category?: string
  options_group?: string
  total_from_table?: string
  total_by_level?: Record<string, number>
  replace?: number
  optional?: boolean
  spell_level?: number | 'slot-or-cantrip'
  spell_levels?: number[]
  lists?: string[] | 'any'
  schools?: string[]
  ritual?: boolean
  always_prepared?: boolean
  alternative?: { id: string; name: string; name_ru: string; cantrips: number; list: string; ability: Ability }
  // ability-increase
  max_score?: number
  options?: { from?: Ability[]; plus_1?: number; plus_2?: number; unproficient_saves_only?: boolean }[]
}

export interface LevelUpGrant {
  feature?: string
  level?: number
  skills?: string[]
  tools?: string[]
  tool_fallback?: string
  weapons?: string[]
  armor?: string[]
  saves?: Ability[]
  save_fallback?: Ability[]
  cantrips?: string[]
  cantrip_fallback_list?: string
  not_counted?: boolean
  spells?: string[]
  rituals?: string[]
  ability?: Ability
  hp_per_class_level?: number
  hp_bonus?: number
  hp_bonus_per_level?: number
  speed_bonus?: number
  initiative_bonus?: string
  jack_of_all_trades?: boolean
  extra_spell_lists?: string[]
  all_skills?: boolean
  save_of_increased_ability?: boolean
}

export interface ClassFeatureData {
  id: string
  class: string
  feature: string
  name: string
  name_ru?: string | null
  levels: number[]
}

export interface SubclassSpellcasting {
  feature: string
  list: string
  ability: Ability
  cantrips: Record<string, number>
  fixed_cantrips?: string[]
  cantrip_swap?: string
  prepared_swap?: { when: string; count: string }
  levels: Record<string, { prepared_spells: number; spell_slots: number[] }>
}

export interface SubclassData extends Named {
  class: string
  level: number
  link: string
  features: { id: string; level: number; name: string; name_ru: string }[]
  always_prepared?: Record<string, string[]>
  grants?: LevelUpGrant[]
  choices?: LevelUpChoice[]
  note?: string
  savant_school?: string
  spellcasting?: SubclassSpellcasting
}

export interface ClassData extends Named {
  primary_abilities: Ability[]
  primary_ability_mode: 'all' | 'any'
  hit_die: number
  hit_points: { per_level: { roll: string; fixed: number } }
  saving_throws: Ability[]
  skill_proficiencies: Proficiencies
  tool_proficiencies: Proficiencies
  armor_training: string[]
  weapon_proficiencies: { categories: string[]; martial_with_any_property?: string[] }
  weapon_ids: string[]
  languages: { fixed: string[]; choose?: ChoiceGroup[] }
  starting_equipment: StartingEquipment
  spellcasting: null | {
    ability: Ability
    kind: 'prepared' | 'pact'
    list: string
    cantrip_swap?: 'level-up' | 'long-rest' | null
    prepared_swap?: { when: 'level-up' | 'long-rest'; count: 'one' | 'any' }
  }
  level_1_features: ClassFeature[]
  level_1_choices: ClassChoice[]
  levels: ClassLevel[]
  subclasses: { id: string; name: string; source: string }[]
  level_up_choices: LevelUpChoice[]
  level_up_grants: LevelUpGrant[]
  level_up_unsupported?: { feature: string; level: number; note: string }[]
}

export interface ClassOption extends Named {
  class?: string
  min_level?: number
  prerequisite?: string
  grants?: {
    weapon_proficiencies?: string[]
    armor_training?: string[]
    extra_cantrips?: number
    skill_check_bonus?: { skills: string[]; bonus: string; min: number }
  }
}

export interface BackgroundData extends Named {
  ability_scores: Ability[]
  feat: { id: string; spell_list?: string }
  skill_proficiencies: string[]
  tool_proficiencies: Proficiencies
  starting_equipment: StartingEquipment
}

export interface SpeciesChoice {
  id: string
  type: 'size' | 'skill' | 'feat' | 'ability' | 'species-option'
  count: number
  from?: string[] | 'any'
  options_group?: string
  feat_category?: string
}

export interface SpeciesData extends Named {
  size_options: { size: string; height: string }[]
  speed: number
  darkvision: number | null
  resistances: string[]
  traits: { id: string; name: string; level?: number; grants?: Record<string, unknown> }[]
  choices: SpeciesChoice[]
}

export interface SpeciesOption extends Named {
  group: string
  species: string
  resistances: string[]
  spells: { spell: string; character_level: number }[]
  darkvision?: number
  speed?: number
  breath_weapon_damage_type?: string
}

export interface FeatChoice {
  id: string
  type: 'spell-list' | 'ability' | 'spell' | 'skill-or-tool' | 'tool' | 'ability-increase'
  count: number
  from?: string[] | 'any'
  from_categories?: string[]
  list?: string
  spell_level?: number
}

export interface FeatData extends Named {
  category: 'origin' | 'general' | 'fighting-style' | 'epic-boon'
  repeatable: boolean
  choices?: FeatChoice[]
  grants?: Record<string, unknown>
  link?: string
  prerequisite?: {
    minimum_level?: number
    ability_any?: Ability[]
    ability_min?: number
    armor_training?: string
    spellcasting?: boolean
    feature_named?: string
  }
}

export interface SpellData extends Named {
  level: number
  school: string
  classes: string[]
  attack_type?: 'melee' | 'ranged'
  save?: Ability
  damage?: { type: string; at_slot_level?: Record<string, string>; at_character_level?: Record<string, string> }
  range: string
  concentration: boolean
  ritual: boolean
}

export interface EquipmentData extends Named {
  category: string
  subcategory: string | null
  categories: string[]
  cost: { amount: number; unit: string } | null
  cost_cp: number | null
  ammunition?: { bundle_size: number }
}

export interface WeaponData extends Named {
  category: 'simple' | 'martial'
  type: 'melee' | 'ranged'
  damage_dice: string
  damage_type: string
  properties: string[]
  property_details: {
    ammunition?: { range_normal: number; range_long: number }
    thrown?: { range_normal: number; range_long: number }
    versatile?: { damage_dice: string }
  }
  mastery: string
  mastery_classes: string[]
}

export interface ArmorData extends Named {
  type: 'light' | 'medium' | 'heavy' | 'shield'
  armor_class: { base?: number; add_dex?: boolean; dex_max?: number | null; bonus?: number }
  strength_requirement: number | null
}

interface RuNames {
  [section: string]: Record<string, string | { name: string; abbr: string }>
}

export const abilities = abilitiesJson as unknown as (Named & { abbr: string; abbr_ru: string })[]
export const skills = skillsJson as unknown as (Named & { ability: Ability })[]
export const alignments = alignmentsJson as unknown as (Named & { selectable: boolean })[]
export const languages = languagesJson as unknown as (Named & { rarity: 'standard' | 'rare' })[]
export const classes = classesJson as unknown as ClassData[]
export const classOptions = classOptionsJson as unknown as Record<string, ClassOption[]>
export const backgrounds = backgroundsJson as unknown as BackgroundData[]
export const species = speciesJson as unknown as SpeciesData[]
export const speciesOptions = speciesOptionsJson as unknown as SpeciesOption[]
export const feats = featsJson as unknown as FeatData[]
export const spells = spellsJson as unknown as SpellData[]
export const equipment = equipmentJson as unknown as EquipmentData[]
export const equipmentCategories = equipmentCategoriesJson as unknown as (Named & { items: string[] })[]
export const weapons = weaponsJson as unknown as WeaponData[]
export const armor = armorJson as unknown as ArmorData[]
export const classFeatures = classFeaturesJson as unknown as ClassFeatureData[]
export const subclasses = subclassesJson as unknown as SubclassData[]
export const ru = ruJson as unknown as RuNames

function index<T extends { id: string }>(list: T[]): Record<string, T> {
  return Object.fromEntries(list.map((x) => [x.id, x]))
}

export const byId = {
  skill: index(skills),
  language: index(languages),
  class: index(classes),
  background: index(backgrounds),
  species: index(species),
  speciesOption: index(speciesOptions),
  feat: index(feats),
  spell: index(spells),
  item: index(equipment),
  category: index(equipmentCategories),
  weapon: index(weapons),
  armor: index(armor),
  alignment: index(alignments),
  subclass: index(subclasses)
}

// Russian name of any record, falling back to the English one.
export function nameOf(x: Named | undefined | null): string {
  if (!x) return ''
  return x.name_ru || x.name
}

export function ruName(section: string, id: string, fallback = id): string {
  const v = ru[section]?.[id]
  if (!v) return fallback
  return typeof v === 'string' ? v : v.name
}

export function abilityName(a: Ability): string {
  return ruName('abilities', a)
}

export function abilityShort(a: Ability): string {
  const v = ru.abilities?.[a]
  return v && typeof v !== 'string' ? v.abbr : a.toUpperCase()
}

export function categoryItems(categoryId: string): EquipmentData[] {
  return (byId.category[categoryId]?.items || []).map((id) => byId.item[id]).filter(Boolean)
}

export function spellsFor(list: string, level: number): SpellData[] {
  return spells
    .filter((s) => s.level === level && s.classes.includes(list))
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'ru'))
}

export const originFeats = feats.filter((f) => f.category === 'origin')
export const fightingStyles = feats.filter((f) => f.category === 'fighting-style')
export const toolItems = equipment.filter((e) => e.category === 'tool')
