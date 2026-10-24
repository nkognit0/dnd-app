import type { Ability } from '../data'

// One 4d6 roll: all four dice, the dropped lowest die and the sum of the rest.
export interface Roll {
  dice: number[]
  dropped: number
  total: number
}

// Choices inside one origin feat (only the fields that feat uses are filled).
export interface FeatPicks {
  spellList: string | null
  ability: Ability | null
  cantrips: string[]
  spell: string | null
  // Skilled: "skill:<id>" / "tool:<id>"; Crafter and Musician: tool ids
  picks: string[]
}

export interface PersonalityState {
  name: string
  playerName: string
  alignment: string | null
  age: string
  height: string
  weight: string
  eyes: string
  skin: string
  hair: string
  traits: string
  ideals: string
  bonds: string
  flaws: string
  deity: string
  backstory: string
}

export interface WizardState {
  cls: { classId: string | null }
  background: { backgroundId: string | null; toolChoice: string[] }
  species: {
    speciesId: string | null
    optionId: string | null
    size: string | null
    skill: string | null
    feat: string | null
    spellAbility: Ability | null
  }
  roll: { rolls: Roll[] }
  abilities: {
    // index into roll.rolls for every ability
    assign: Partial<Record<Ability, number>>
    mode: '2-1' | '1-1-1' | null
    plus2: Ability | null
    plus1: Ability | null
  }
  feats: { background: FeatPicks; species: FeatPicks }
  skills: {
    classSkills: string[]
    classTools: string[]
    languages: string[]
    extraLanguages: string[]
    expertise: string[]
  }
  features: {
    fightingStyle: string | null
    order: string | null
    invocations: string[]
    masteries: string[]
  }
  spells: { cantrips: string[]; prepared: string[]; spellbook: string[] }
  equipment: {
    classOption: string | null
    bgOption: string | null
    // "class:<index>" / "bg:<index>" -> chosen item for "choose from a category" positions
    picks: Record<string, string | null>
    purchases: string[]
  }
  personality: PersonalityState
}

export type StepKey = keyof WizardState

// Order matters: changing a step resets every step after it.
export const STEP_ORDER: StepKey[] = [
  'cls',
  'background',
  'species',
  'roll',
  'abilities',
  'feats',
  'skills',
  'features',
  'spells',
  'equipment',
  'personality'
]

const emptyFeat = (): FeatPicks => ({ spellList: null, ability: null, cantrips: [], spell: null, picks: [] })

export function initialStep<K extends StepKey>(key: K): WizardState[K] {
  const init: { [P in StepKey]: () => WizardState[P] } = {
    cls: () => ({ classId: null }),
    background: () => ({ backgroundId: null, toolChoice: [] }),
    species: () => ({ speciesId: null, optionId: null, size: null, skill: null, feat: null, spellAbility: null }),
    roll: () => ({ rolls: [] }),
    abilities: () => ({ assign: {}, mode: null, plus2: null, plus1: null }),
    feats: () => ({ background: emptyFeat(), species: emptyFeat() }),
    skills: () => ({ classSkills: [], classTools: [], languages: [], extraLanguages: [], expertise: [] }),
    features: () => ({ fightingStyle: null, order: null, invocations: [], masteries: [] }),
    spells: () => ({ cantrips: [], prepared: [], spellbook: [] }),
    equipment: () => ({ classOption: null, bgOption: null, picks: {}, purchases: [] }),
    personality: () => ({
      name: '', playerName: '', alignment: null, age: '', height: '', weight: '', eyes: '', skin: '',
      hair: '', traits: '', ideals: '', bonds: '', flaws: '', deity: '', backstory: ''
    })
  }
  return init[key]()
}

export function initialState(): WizardState {
  return Object.fromEntries(STEP_ORDER.map((k) => [k, initialStep(k)])) as unknown as WizardState
}

// Applies a change to one step. If anything really changed, every later step
// goes back to its initial value, so later choices never rest on stale ones.
export function applyUpdate<K extends StepKey>(
  state: WizardState,
  key: K,
  patch: Partial<WizardState[K]>
): WizardState {
  const next = { ...state[key], ...patch }
  if (JSON.stringify(next) === JSON.stringify(state[key])) return state
  const result = { ...state, [key]: next } as WizardState
  const from = STEP_ORDER.indexOf(key)
  for (const later of STEP_ORDER.slice(from + 1)) {
    ;(result as any)[later] = initialStep(later)
  }
  return result
}
