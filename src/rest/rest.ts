// Rests by the 2024 rules (SRD 5.2.1), applied to the fields the sheet keeps.
// Long Rest: all lost Hit Points and all spent Hit Point Dice come back, Temporary Hit Points
// end, expended spell slots come back, death saving throws reset (Hit Points are regained), a
// human gains Heroic Inspiration (Resourceful). Short Rest: Hit Point Dice are spent one by one,
// each heals its roll + the Constitution modifier (at least 1); a warlock regains the Pact Magic
// slots. Either rest needs at least 1 Hit Point. Uses of features (Rage, Second Wind...) and
// Exhaustion are not counted on the sheet, so there is nothing to restore for them.
import type { DnDCharacter } from 'dnd-sheet'
import { byId, nameOf, species } from '../data'
import { mod } from '../rules/derive'
import { Why, changelogOf, logEvent } from '../changelog/changelog'

const toInt = (v: unknown): number | null => {
  const m = String(v ?? '').replace('−', '-').match(/-?\d+/)
  return m ? Number(m[0]) : null
}
const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').trim()

// «3к10»: how many dice and their size
export function hitDiceOf(v: unknown): { count: number; die: number } | null {
  const m = String(v ?? '').match(/(\d+)\s*[кkdд]\s*(\d+)/i)
  return m ? { count: Number(m[1]), die: Number(m[2]) } : null
}

const SLOT_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const usedSlots = (c: DnDCharacter) => SLOT_LEVELS.filter((l) => Number(c[`lvl${l}SpellSlotsUsed`] || 0) > 0)

const classIs = (c: DnDCharacter, id: string) => {
  const cls = byId.class[id]
  return !!cls && norm(String(c.classLevel ?? '')).startsWith(norm(nameOf(cls)))
}
// the species whose trait gives Heroic Inspiration after every Long Rest (Resourceful)
function inspiredOnLongRest(c: DnDCharacter): string | null {
  const sp = species.find((s) => norm(String(c.species ?? '')).startsWith(norm(nameOf(s))))
  const trait = sp?.traits?.find((t) => t.grants?.heroic_inspiration === 'on long rest')
  // the only such trait is the human's Resourceful («Находчивость»)
  return trait ? `${nameOf(sp)}: ${trait.id === 'resourceful' ? 'Находчивость' : trait.name}` : null
}

export interface RestState {
  hp: number | null
  maxHp: number | null
  hitDice: { count: number; die: number } | null
  hitDiceMax: { count: number; die: number } | null
  conMod: number
  warlock: boolean
  // the rest gives nothing with 0 Hit Points
  blocked: string | null
}

export function restState(c: DnDCharacter): RestState {
  const hp = toInt(c.hp)
  return {
    hp,
    maxHp: toInt(c.maxHp),
    hitDice: hitDiceOf(c.hitDice),
    hitDiceMax: hitDiceOf(c.hitDiceMax),
    conMod: mod(toInt(c.con) ?? 10),
    warlock: classIs(c, 'warlock'),
    blocked: hp != null && hp < 1 ? 'Чтобы начать отдых, нужен хотя бы 1 хит: сначала героя нужно стабилизировать и вылечить.' : null
  }
}

export interface RestResult {
  character: DnDCharacter
  // what changed, in plain words, for the window of the rest
  changes: string[]
}

const resetDeathSaves = (c: DnDCharacter, out: DnDCharacter, why: Why, changes: string[]) => {
  const marked = (['deathsaveSuccesses', 'deathsaveFailures'] as const).filter((f) => Number(c[f] || 0) > 0)
  if (!marked.length) return
  for (const f of marked) {
    out[f] = 0
    why.field(f, 'Сбрасываются, когда герой восстанавливает хиты')
  }
  changes.push('Спасброски от смерти сброшены')
}

const resetSlots = (c: DnDCharacter, out: DnDCharacter, why: Why, changes: string[], reason: string) => {
  const used = usedSlots(c)
  if (!used.length) return
  for (const l of used) {
    out[`lvl${l}SpellSlotsUsed`] = 0
    why.field(`lvl${l}SpellSlotsUsed`, reason)
  }
  changes.push(`Ячейки заклинаний восстановлены: ${used.map((l) => `${l}-й круг`).join(', ')}`)
}

export function longRest(c: DnDCharacter): RestResult {
  const s = restState(c)
  const out: DnDCharacter = { ...c }
  const why = new Why()
  const changes: string[] = []
  if (s.blocked) return { character: c, changes }
  if (s.maxHp != null && s.hp !== s.maxHp) {
    out.hp = String(s.maxHp)
    why.field('hp', 'Долгий отдых возвращает все потерянные хиты')
    changes.push(`Хиты: ${s.hp ?? '—'} → ${s.maxHp}`)
  }
  if (String(c.tempHp ?? '').trim()) {
    out.tempHp = ''
    why.field('tempHp', 'Временные хиты длятся до конца долгого отдыха')
    changes.push(`Временные хиты (${c.tempHp}) закончились`)
  }
  if (s.hitDiceMax && s.hitDice?.count !== s.hitDiceMax.count) {
    out.hitDice = String(c.hitDiceMax)
    why.field('hitDice', 'Долгий отдых возвращает все потраченные кости хитов')
    changes.push(`Кости хитов: ${c.hitDice || '0'} → ${c.hitDiceMax}`)
  }
  resetDeathSaves(c, out, why, changes)
  resetSlots(c, out, why, changes, 'Долгий отдых возвращает все потраченные ячейки заклинаний')
  const inspiration = inspiredOnLongRest(c)
  if (inspiration && !String(c.inspiration ?? '').trim()) {
    out.inspiration = '✓'
    why.field('inspiration', `${inspiration} — героическое вдохновение после каждого долгого отдыха`)
    changes.push(`Героическое вдохновение (${inspiration})`)
  }
  return { character: changes.length ? logEvent(c, out, why, 'Долгий отдых', changelogOf(c)) : c, changes }
}

// one spent Hit Point Die: the roll and the Hit Points it gives (roll + Con, at least 1)
export const healOf = (roll: number, conMod: number) => Math.max(1, roll + conMod)

export function shortRest(c: DnDCharacter, rolls: number[]): RestResult {
  const s = restState(c)
  const out: DnDCharacter = { ...c }
  const why = new Why()
  const changes: string[] = []
  if (s.blocked) return { character: c, changes }
  const spent = s.hitDice ? Math.min(rolls.length, s.hitDice.count) : 0
  const healed = rolls.slice(0, spent).reduce((sum, r) => sum + healOf(r, s.conMod), 0)
  if (spent && s.hitDice) {
    const hp = s.hp ?? 0
    const next = s.maxHp != null ? Math.min(s.maxHp, hp + healed) : hp + healed
    const dice = rolls.slice(0, spent).map((r) => `${r}${s.conMod ? (s.conMod > 0 ? '+' : '−') + Math.abs(s.conMod) : ''}`).join(', ')
    out.hitDice = `${s.hitDice.count - spent}к${s.hitDice.die}`
    why.field('hitDice', `Потрачено костей хитов: ${spent}`)
    changes.push(`Кости хитов: ${c.hitDice} → ${out.hitDice}`)
    if (next !== hp) {
      out.hp = String(next)
      why.field('hp', `Кости хитов к${s.hitDice.die} + модификатор Телосложения (не меньше 1 за кость): ${dice}`)
      changes.push(`Хиты: ${hp} → ${next}`)
      resetDeathSaves(c, out, why, changes)
    }
  }
  if (s.warlock) resetSlots(c, out, why, changes, 'Магия договора: ячейки колдуна возвращаются после короткого отдыха')
  return { character: changes.length ? logEvent(c, out, why, 'Короткий отдых', changelogOf(c)) : c, changes }
}
