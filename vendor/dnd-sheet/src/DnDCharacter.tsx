// One row of the "Weapons & Damage Cantrips" table.
export interface DnDAttack {
  name?: string
  bonus?: string
  damage?: string
  notes?: string
}

// One line of a spell list; `prepared` is the circle in front of the name.
export interface DnDSpell {
  name?: string
  prepared?: boolean
}

// All values the sheets display. Every field is optional and free-form, so an
// app can fill some of them and the player can still edit everything.
export default class DnDCharacter {
  [key: string]: any

  name?: string
  classLevel?: string
  subclass?: string
  background?: string
  playerName?: string
  species?: string
  size?: string
  alignment?: string
  xp?: string

  str?: string
  dex?: string
  con?: string
  int?: string
  wis?: string
  cha?: string

  // Heroic Inspiration
  inspiration?: string
  proficiencyBonus?: string

  strSave?: string
  strSaveChecked?: boolean
  dexSave?: string
  dexSaveChecked?: boolean
  conSave?: string
  conSaveChecked?: boolean
  intSave?: string
  intSaveChecked?: boolean
  wisSave?: string
  wisSaveChecked?: boolean
  chaSave?: string
  chaSaveChecked?: boolean

  skillAcrobatics?: string
  skillAcrobaticsChecked?: boolean
  skillAnimalHandling?: string
  skillAnimalHandlingChecked?: boolean
  skillArcana?: string
  skillArcanaChecked?: boolean
  skillAthletics?: string
  skillAthleticsChecked?: boolean
  skillDeception?: string
  skillDeceptionChecked?: boolean
  skillHistory?: string
  skillHistoryChecked?: boolean
  skillInsight?: string
  skillInsightChecked?: boolean
  skillIntimidation?: string
  skillIntimidationChecked?: boolean
  skillInvestigation?: string
  skillInvestigationChecked?: boolean
  skillMedicine?: string
  skillMedicineChecked?: boolean
  skillNature?: string
  skillNatureChecked?: boolean
  skillPerception?: string
  skillPerceptionChecked?: boolean
  skillPerformance?: string
  skillPerformanceChecked?: boolean
  skillPersuasion?: string
  skillPersuasionChecked?: boolean
  skillReligion?: string
  skillReligionChecked?: boolean
  // key keeps the upstream spelling
  skillSlightOfHand?: string
  skillSlightOfHandChecked?: boolean
  skillStealth?: string
  skillStealthChecked?: boolean
  skillSurvival?: string
  skillSurvivalChecked?: boolean

  passivePerception?: string

  // Equipment Training & Proficiencies (2024)
  armorLight?: boolean
  armorMedium?: boolean
  armorHeavy?: boolean
  armorShields?: boolean
  weaponProficiencies?: string
  toolProficiencies?: string
  languages?: string

  ac?: string
  init?: string
  speed?: string

  maxHp?: string
  hp?: string
  tempHp?: string

  hitDiceMax?: string
  hitDice?: string

  deathsaveSuccesses?: number
  deathsaveFailures?: number

  attacks?: DnDAttack[]
  attacksText?: string

  cp?: string
  sp?: string
  gp?: string
  pp?: string
  equipment?: string
  equipment2?: string

  personalityTraits?: string
  ideals?: string
  bonds?: string
  flaws?: string

  // 2024 splits "Features & Traits" into three blocks
  classFeatures?: string
  speciesTraits?: string
  feats?: string

  age?: string
  height?: string
  weight?: string
  eyes?: string
  skin?: string
  hair?: string

  appearance?: string
  backstory?: string

  // Allies & Organizations
  faction?: string
  factionImg?: string
  factionRank?: string
  allies?: string
  allies2?: string

  additionalFeatures?: string
  additionalFeatures2?: string

  // Magic Item Attunement (2024: up to three items)
  attunedItem1?: string
  attunedItem2?: string
  attunedItem3?: string
  treasure?: string
  treasure2?: string

  spellcastingClass?: string
  preparedSpellsTotal?: string
  spellSaveDC?: string
  spellAttackBonus?: string

  cantrips?: DnDSpell[]

  lvl1SpellSlotsTotal?: string
  lvl1SpellSlotsUsed?: number
  lvl1Spells?: DnDSpell[]

  lvl2SpellSlotsTotal?: string
  lvl2SpellSlotsUsed?: number
  lvl2Spells?: DnDSpell[]

  lvl3SpellSlotsTotal?: string
  lvl3SpellSlotsUsed?: number
  lvl3Spells?: DnDSpell[]

  lvl4SpellSlotsTotal?: string
  lvl4SpellSlotsUsed?: number
  lvl4Spells?: DnDSpell[]

  lvl5SpellSlotsTotal?: string
  lvl5SpellSlotsUsed?: number
  lvl5Spells?: DnDSpell[]

  lvl6SpellSlotsTotal?: string
  lvl6SpellSlotsUsed?: number
  lvl6Spells?: DnDSpell[]

  lvl7SpellSlotsTotal?: string
  lvl7SpellSlotsUsed?: number
  lvl7Spells?: DnDSpell[]

  lvl8SpellSlotsTotal?: string
  lvl8SpellSlotsUsed?: number
  lvl8Spells?: DnDSpell[]

  lvl9SpellSlotsTotal?: string
  lvl9SpellSlotsUsed?: number
  lvl9Spells?: DnDSpell[]
}
