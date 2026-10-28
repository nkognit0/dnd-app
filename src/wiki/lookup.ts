// Finds database objects named in sheet fields. Names are matched by their Russian or
// English name after normalisation; the field decides what kind of object a name can be,
// so «Щит» in the spell list is the spell and in the equipment the shield.
import { byId, equipment, spells } from '../data'

export type WikiKind = 'spell' | 'weapon' | 'armor' | 'tool' | 'item'
export interface WikiRef { kind: WikiKind; id: string }
export interface LinkRange { start: number; end: number; ref: WikiRef }

// the sheet fields that can hold links (the same names as in dnd-sheet)
export type LinkField = 'spell' | 'attack' | 'attackText' | 'equipment' | 'tools'

export const norm = (s: string) =>
  s.toLowerCase().replace(/ё/g, 'е').replace(/[«»"“”]/g, '').replace(/\s+/g, ' ').trim()

const index = new Map<string, WikiRef[]>()
function add(name: string | null | undefined, ref: WikiRef) {
  if (!name) return
  const key = norm(name)
  const list = index.get(key) || []
  if (!list.some((r) => r.kind === ref.kind && r.id === ref.id)) list.push(ref)
  index.set(key, list)
}
for (const s of spells) {
  add(s.name_ru, { kind: 'spell', id: s.id })
  add(s.name, { kind: 'spell', id: s.id })
}
for (const e of equipment) {
  const kind: WikiKind = byId.weapon[e.id] ? 'weapon' : byId.armor[e.id] ? 'armor' : e.category === 'tool' ? 'tool' : 'item'
  add(e.name_ru, { kind, id: e.id })
  add(e.name, { kind, id: e.id })
}

export function lookup(name: string, kinds: WikiKind[]): WikiRef | null {
  const found = index.get(norm(name)) || []
  for (const k of kinds) {
    const r = found.find((x) => x.kind === k)
    if (r) return r
  }
  return null
}

const KINDS: Record<LinkField, WikiKind[]> = {
  spell: ['spell'],
  attack: ['weapon', 'spell', 'item'],
  attackText: ['weapon', 'spell', 'item'],
  equipment: ['weapon', 'armor', 'tool', 'item'],
  tools: ['tool', 'item']
}

// the quantity at the end of an entry: «×2», «x 2», «х2» (Cyrillic), «(20)», «(20 шт.)»
const COUNT_END = /(?:\s*×|\s+[xх*])\s*(\d+)\s*$/i
const COUNT_BRACKETS = /\s*\((\d+)(?:\s*шт\.?)?\)\s*$/i
const NOTE_END = /\s*\([^)]*\)\s*$/
const clean = (s: string) => s.replace(/[\s.;:]+$/, '')

export interface EntryParts {
  // the length of the leading whitespace; the name starts after it
  lead: number
  name: string
  // notes in brackets after a known name, «(молитвы)»
  note: string
  count: number | null
  ref: WikiRef | null
}

// One entry of a list field: the name without the quantity, notes in brackets and edge
// punctuation. A database name may have brackets itself («Корм (в день)»), so notes are taken
// off one by one until the name is known. An unknown name keeps its brackets.
export function splitEntry(text: string, field: LinkField): EntryParts {
  const kinds = KINDS[field]
  const lead = text.match(/^\s*/)![0].length
  const body = text.slice(lead).replace(/\s+$/, '')
  let b = body
  let count: number | null = null
  const notes: string[] = []
  for (;;) {
    const ref = lookup(clean(b), kinds)
    if (ref) return { lead, name: clean(b), note: notes.join(' '), count, ref }
    const m: RegExpMatchArray | null = count == null ? b.match(COUNT_END) || b.match(COUNT_BRACKETS) : null
    if (m) {
      count = Number(m[1])
      b = b.slice(0, m.index)
      continue
    }
    const n = b.match(NOTE_END)
    if (!n) break
    notes.unshift(n[0].trim())
    b = b.slice(0, n.index)
  }
  const own = body.match(COUNT_END) || body.match(COUNT_BRACKETS)
  return { lead, name: clean(own ? body.slice(0, own.index) : body), note: '', count: own ? Number(own[1]) : null, ref: null }
}

// entries separated by commas, semicolons or line breaks, with their positions
function entries(text: string): { text: string; from: number }[] {
  const out: { text: string; from: number }[] = []
  let from = 0
  for (const part of text.split(/([,;\n])/)) {
    if (part !== ',' && part !== ';' && part !== '\n') out.push({ text: part, from })
    from += part.length
  }
  return out
}

export function findLinks(field: LinkField, text: string): LinkRange[] {
  const out: LinkRange[] = []
  const tryEntry = (t: string, from: number) => {
    const e = splitEntry(t, field)
    if (e.ref) out.push({ start: from + e.lead, end: from + e.lead + e.name.length, ref: e.ref })
  }
  if (field === 'spell' || field === 'attack') tryEntry(text, 0)
  else if (field === 'attackText') {
    // overflow attack lines: «Name: +5, 1к6 колющий; notes»
    let from = 0
    for (const line of text.split('\n')) {
      tryEntry(line.split(':')[0], from)
      from += line.length + 1
    }
  } else for (const e of entries(text)) tryEntry(e.text, e.from)
  return out
}

// the link at a caret position, or the first one when the field holds a single name
export function linkAt(field: LinkField, text: string, offset: number): WikiRef | null {
  const links = findLinks(field, text)
  if (field === 'spell' || field === 'attack') return links[0]?.ref ?? null
  return links.find((l) => offset >= l.start && offset <= l.end)?.ref ?? null
}
