// Everything the wizard computes from the choices made so far. Steps use it to
// build their option lists (and to exclude what the character already has);
// the final sheet is assembled from the same values.
import {
  ABILITIES, Ability, ArmorData, ClassData, ClassOption, EquipItemRef, EquipOption, EquipmentData,
  FeatData, SpeciesData, SpeciesOption, SpellData, BackgroundData, byId, classOptions, nameOf, weapons
} from '../data'
import type { FeatPicks, WizardState } from '../wizard/state'

export const PROFICIENCY_BONUS = 2 // character level 1

export const mod = (score: number | undefined) => (score == null ? 0 : Math.floor((score - 10) / 2))
export const signed = (n: number) => (n >= 0 ? '+' + n : String(n))

export interface FeatSlot {
  slot: 'background' | 'species'
  feat: FeatData
  // Magic Initiate list fixed by the background ("Magic Initiate (Cleric)")
  fixedList?: string
  picks: FeatPicks
}

export interface InventoryLine {
  item: EquipmentData
  qty: number
  note?: string
}

export interface KnownSpell {
  spell: SpellData
  ability: Ability | null
  prepared: boolean
  source: 'class' | 'species' | 'feat' | 'feature'
}

export interface Derived {
  cls?: ClassData
  bg?: BackgroundData
  sp?: SpeciesData
  spOption?: SpeciesOption
  order?: ClassOption
  size: string | null
  sizeOptions: string[]
  base: Partial<Record<Ability, number>>
  bonus: Record<Ability, number>
  scores: Record<Ability, number>
  mods: Record<Ability, number>
  featSlots: FeatSlot[]
  // proficiency -> where it comes from (Russian label)
  skills: Map<string, string>
  tools: Map<string, string>
  languages: Map<string, string>
  expertise: Set<string>
  armorTraining: Set<string>
  weaponIds: Set<string>
  speed: number
  darkvision: number | null
  resistances: string[]
}

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0)

export function featSlots(s: WizardState): FeatSlot[] {
  const out: FeatSlot[] = []
  const bg = s.background.backgroundId ? byId.background[s.background.backgroundId] : undefined
  if (bg && byId.feat[bg.feat.id]) {
    out.push({ slot: 'background', feat: byId.feat[bg.feat.id], fixedList: bg.feat.spell_list, picks: s.feats.background })
  }
  if (s.species.feat && byId.feat[s.species.feat]) {
    out.push({ slot: 'species', feat: byId.feat[s.species.feat], picks: s.feats.species })
  }
  return out
}

function featLabel(f: FeatData) {
  return 'черта «' + nameOf(f) + '»'
}

export function derive(s: WizardState): Derived {
  const cls = s.cls.classId ? byId.class[s.cls.classId] : undefined
  const bg = s.background.backgroundId ? byId.background[s.background.backgroundId] : undefined
  const sp = s.species.speciesId ? byId.species[s.species.speciesId] : undefined
  const spOption = s.species.optionId ? byId.speciesOption[s.species.optionId] : undefined
  const orderGroup = cls?.id === 'cleric' ? 'divine-order' : cls?.id === 'druid' ? 'primal-order' : null
  const order = orderGroup && s.features.order
    ? (classOptions[orderGroup] || []).find((o) => o.id === s.features.order)
    : undefined

  // size: the only option, or the chosen one
  const sizeOptions = sp ? sp.size_options.map((o) => o.size) : []
  const size = sizeOptions.length === 1 ? sizeOptions[0] : s.species.size

  // ability scores: rolled value + background increase (never above 20)
  const base: Partial<Record<Ability, number>> = {}
  for (const a of ABILITIES) {
    const i = s.abilities.assign[a]
    if (i != null && s.roll.rolls[i]) base[a] = s.roll.rolls[i].total
  }
  const bonus = Object.fromEntries(ABILITIES.map((a) => [a, 0])) as Record<Ability, number>
  if (bg && s.abilities.mode === '1-1-1') for (const a of bg.ability_scores) bonus[a] += 1
  if (bg && s.abilities.mode === '2-1') {
    if (s.abilities.plus2) bonus[s.abilities.plus2] += 2
    if (s.abilities.plus1) bonus[s.abilities.plus1] += 1
  }
  const scores = Object.fromEntries(
    ABILITIES.map((a) => [a, Math.min(20, (base[a] ?? 10) + bonus[a])])
  ) as Record<Ability, number>
  const mods = Object.fromEntries(ABILITIES.map((a) => [a, mod(scores[a])])) as Record<Ability, number>

  const slots = featSlots(s)

  // skills
  const skills = new Map<string, string>()
  for (const id of bg?.skill_proficiencies || []) skills.set(id, 'предыстория')
  if (s.species.skill) skills.set(s.species.skill, 'вид')
  for (const slot of slots) {
    for (const p of slot.picks.picks) if (p.startsWith('skill:')) skills.set(p.slice(6), featLabel(slot.feat))
  }
  for (const id of s.skills.classSkills) skills.set(id, 'класс')

  // tools
  const tools = new Map<string, string>()
  for (const id of bg?.tool_proficiencies.fixed || []) tools.set(id, 'предыстория')
  for (const id of s.background.toolChoice) tools.set(id, 'предыстория')
  for (const slot of slots) {
    for (const p of slot.picks.picks) {
      if (p.startsWith('tool:')) tools.set(p.slice(5), featLabel(slot.feat))
      else if (!p.startsWith('skill:')) tools.set(p, featLabel(slot.feat))
    }
  }
  for (const id of cls?.tool_proficiencies.fixed || []) tools.set(id, 'класс')
  for (const id of s.skills.classTools) tools.set(id, 'класс')

  // languages
  const languages = new Map<string, string>([['common', 'все персонажи']])
  for (const id of s.skills.languages) languages.set(id, 'на выбор')
  for (const id of cls?.languages.fixed || []) languages.set(id, 'класс')
  for (const id of s.skills.extraLanguages) languages.set(id, 'класс')

  // armor and weapons
  const armorTraining = new Set(cls?.armor_training || [])
  for (const a of order?.grants?.armor_training || []) armorTraining.add(a)
  const weaponIds = new Set(cls?.weapon_ids || [])
  if (order?.grants?.weapon_proficiencies?.includes('martial')) {
    for (const w of weapons) if (w.category === 'martial') weaponIds.add(w.id)
  }

  const darkvision = spOption?.darkvision ?? sp?.darkvision ?? null
  const resistances = [...new Set([...(sp?.resistances || []), ...(spOption?.resistances || [])])]

  return {
    cls, bg, sp, spOption, order, size, sizeOptions, base, bonus, scores, mods, featSlots: slots,
    skills, tools, languages, expertise: new Set(s.skills.expertise), armorTraining, weaponIds,
    speed: spOption?.speed ?? sp?.speed ?? 30, darkvision, resistances
  }
}

// ---------------------------------------------------------------- equipment

function resolveRef(ref: EquipItemRef, key: string, s: WizardState, sameAsTool: string | undefined): EquipmentData | undefined {
  if (ref.item) return byId.item[ref.item]
  if (ref.same_as) return sameAsTool ? byId.item[sameAsTool] : undefined
  const picked = s.equipment.picks[key]
  return picked ? byId.item[picked] : undefined
}

export function optionLines(src: 'class' | 'bg', opt: EquipOption | undefined, s: WizardState): InventoryLine[] {
  if (!opt) return []
  const sameAsTool = src === 'class' ? s.skills.classTools[0] : s.background.toolChoice[0]
  const out: InventoryLine[] = []
  ;(opt.items || []).forEach((ref, i) => {
    const item = resolveRef(ref, src + ':' + i, s, sameAsTool)
    if (item) out.push({ item, qty: ref.qty, note: ref.note })
  })
  return out
}

export function classEquipOption(d: Derived, s: WizardState) {
  return d.cls?.starting_equipment.options.find((o) => o.id === s.equipment.classOption)
}

export function bgEquipOption(d: Derived, s: WizardState) {
  return d.bg?.starting_equipment.options.find((o) => o.id === s.equipment.bgOption)
}

export function startingGoldCp(d: Derived, s: WizardState): number {
  return ((classEquipOption(d, s)?.gp || 0) + (bgEquipOption(d, s)?.gp || 0)) * 100
}

export function purchasesCp(s: WizardState): number {
  return sum(s.equipment.purchases.map((id) => byId.item[id]?.cost_cp || 0))
}

// Starting kit + purchases, merged by item.
export function inventory(d: Derived, s: WizardState): InventoryLine[] {
  const lines = [
    ...optionLines('class', classEquipOption(d, s), s),
    ...optionLines('bg', bgEquipOption(d, s), s),
    ...s.equipment.purchases.map((id) => {
      const item = byId.item[id]
      return { item, qty: item?.ammunition ? item.ammunition.bundle_size : 1 }
    })
  ].filter((l) => l.item)
  const merged = new Map<string, InventoryLine>()
  for (const l of lines) {
    const prev = merged.get(l.item.id)
    if (prev) prev.qty += l.qty
    else merged.set(l.item.id, { ...l })
  }
  return [...merged.values()]
}

// ---------------------------------------------------------------- combat

export interface ArmorClassResult {
  value: number
  armor?: ArmorData
  shield: boolean
  formula: string
  // Speed penalty when the armor's Strength requirement is not met
  speedPenalty: number
}

export function armorClass(d: Derived, s: WizardState, inv: InventoryLine[]): ArmorClassResult {
  const dex = d.mods.dex
  const owned = inv.map((l) => byId.armor[l.item.id]).filter(Boolean)
  const shieldOk = owned.some((a) => a.type === 'shield') && d.armorTraining.has('shield')
  const defense = s.features.fightingStyle === 'defense' ? 1 : 0
  const candidates: ArmorClassResult[] = []

  const clsId = d.cls?.id
  if (clsId === 'monk') {
    candidates.push({ value: 10 + dex + d.mods.wis, shield: false, formula: '10 + Лов + Мдр (защита без доспехов)', speedPenalty: 0 })
  } else if (clsId === 'barbarian') {
    const sh = shieldOk ? 2 : 0
    candidates.push({ value: 10 + dex + d.mods.con + sh, shield: shieldOk, formula: '10 + Лов + Тел' + (sh ? ' + щит' : '') + ' (защита без доспехов)', speedPenalty: 0 })
  } else {
    const sh = shieldOk ? 2 : 0
    candidates.push({ value: 10 + dex + sh, shield: shieldOk, formula: '10 + Лов' + (sh ? ' + щит' : ''), speedPenalty: 0 })
  }

  for (const a of owned) {
    if (a.type === 'shield' || !d.armorTraining.has(a.type)) continue
    const ac = a.armor_class
    const dexPart = ac.add_dex ? Math.min(dex, ac.dex_max ?? 99) : 0
    const sh = shieldOk ? 2 : 0
    const penalty = a.strength_requirement && d.scores.str < a.strength_requirement ? 10 : 0
    candidates.push({
      value: (ac.base || 10) + dexPart + sh + defense,
      armor: a,
      shield: shieldOk,
      formula: nameOf(a) + ' ' + ac.base + (ac.add_dex ? ' + Лов' + (ac.dex_max != null ? ' (макс. ' + ac.dex_max + ')' : '') : '') +
        (sh ? ' + щит' : '') + (defense ? ' + Оборона' : ''),
      speedPenalty: penalty
    })
  }
  return candidates.sort((x, y) => y.value - x.value)[0]
}

export function maxHitPoints(d: Derived): number {
  if (!d.cls) return 0
  let hp = d.cls.hit_die + d.mods.con
  if (d.sp?.id === 'dwarf') hp += 1 // Dwarven Toughness
  if (d.featSlots.some((f) => f.feat.id === 'tough')) hp += 2 // Tough: twice the level
  return Math.max(1, hp)
}

export function initiative(d: Derived): number {
  return d.mods.dex + (d.featSlots.some((f) => f.feat.id === 'alert') ? PROFICIENCY_BONUS : 0)
}

export function skillBonus(d: Derived, skillId: string, ability: Ability): number {
  let v = d.mods[ability]
  if (d.skills.has(skillId)) v += PROFICIENCY_BONUS
  if (d.expertise.has(skillId)) v += PROFICIENCY_BONUS
  const extra = d.order?.grants?.skill_check_bonus
  if (extra && extra.skills.includes(skillId)) v += Math.max(extra.min, d.mods.wis)
  return v
}

// ---------------------------------------------------------------- spells

// Every spell the character starts with, with its spellcasting ability.
export function knownSpells(d: Derived, s: WizardState): KnownSpell[] {
  const out: KnownSpell[] = []
  const add = (id: string, ability: Ability | null, prepared: boolean, source: KnownSpell['source']) => {
    const spell = byId.spell[id]
    if (spell && !out.some((k) => k.spell.id === id)) out.push({ spell, ability, prepared, source })
  }
  const clsAbility = d.cls?.spellcasting?.ability || null

  for (const id of s.spells.cantrips) add(id, clsAbility, true, 'class')
  for (const id of s.spells.prepared) add(id, clsAbility, true, 'class')
  for (const id of s.spells.spellbook) add(id, clsAbility, s.spells.prepared.includes(id), 'class')
  for (const f of d.cls?.level_1_features || []) {
    const g = f.grants as { always_prepared_spells?: string[]; cantrips?: string[] } | undefined
    for (const id of g?.always_prepared_spells || []) add(id, clsAbility, true, 'feature')
    for (const id of g?.cantrips || []) add(id, clsAbility, true, 'feature')
  }

  // species: lineage spells available at level 1, Thaumaturgy, Light
  const spAbility = d.sp?.id === 'aasimar' ? 'cha' : s.species.spellAbility
  for (const x of d.spOption?.spells || []) if (x.character_level <= 1) add(x.spell, spAbility, true, 'species')
  for (const t of d.sp?.traits || []) {
    const g = t.grants as { cantrips?: string[] } | undefined
    for (const id of g?.cantrips || []) add(id, spAbility, true, 'species')
  }

  // Magic Initiate
  for (const slot of d.featSlots) {
    if (slot.feat.id !== 'magic-initiate') continue
    for (const id of slot.picks.cantrips) add(id, slot.picks.ability, true, 'feat')
    if (slot.picks.spell) add(slot.picks.spell, slot.picks.ability, true, 'feat')
  }
  return out
}

export function spellSaveDC(d: Derived, ability: Ability | null): number {
  return 8 + PROFICIENCY_BONUS + (ability ? d.mods[ability] : 0)
}

export function spellAttack(d: Derived, ability: Ability | null): number {
  return PROFICIENCY_BONUS + (ability ? d.mods[ability] : 0)
}

// Weapons the character owns, in inventory order.
export function ownedWeapons(inv: InventoryLine[]) {
  return inv.map((l) => ({ line: l, weapon: byId.weapon[l.item.id] })).filter((x) => x.weapon)
}
