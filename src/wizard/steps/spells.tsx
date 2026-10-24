// Step 9: cantrips and level 1 spells of the class.
import { Stack, Text } from '@mantine/core'
import { abilityName, byId, nameOf, spellsFor } from '../../data'
import type { SpellData } from '../../data'
import { knownSpells } from '../../rules/derive'
import type { Derived } from '../../rules/derive'
import type { WizardState } from '../state'
import { Fixed, PickMany } from '../fields'
import type { Option } from '../fields'
import type { StepProps } from './common'

const spellOption = (x: SpellData): Option => ({
  value: x.id,
  label: nameOf(x),
  hint: [x.concentration && 'концентрация', x.ritual && 'ритуал'].filter(Boolean).join(', ')
})

function counts(d: Derived) {
  const l1 = d.cls?.levels[0]
  const extra = d.order?.grants?.extra_cantrips || 0
  return {
    cantrips: l1?.cantrips ? l1.cantrips + extra : 0,
    prepared: l1?.prepared_spells || 0,
    spellbook: d.cls?.id === 'wizard' ? 6 : 0
  }
}

// spells the character gets without choosing them here (species, feats, class features)
function otherSpells(d: Derived, s: WizardState) {
  return knownSpells(d, { ...s, spells: { cantrips: [], prepared: [], spellbook: [] } })
}

export function SpellsStep({ s, d, set }: StepProps) {
  const sc = d.cls?.spellcasting
  const other = otherSpells(d, s)
  const otherIds = new Set(other.map((k) => k.spell.id))
  const n = counts(d)
  const sp = s.spells

  if (!sc) {
    return (
      <Stack>
        <Text size='sm'>У класса «{nameOf(d.cls)}» на 1-м уровне нет заклинаний.</Text>
        {other.length > 0 && <Fixed label='Заклинания от вида и черт' value={other.map((k) => nameOf(k.spell))} />}
      </Stack>
    )
  }

  const list = sc.list
  const cantripPool = spellsFor(list, 0).filter((x) => !otherIds.has(x.id))
  const l1Pool = spellsFor(list, 1).filter((x) => !otherIds.has(x.id))

  return (
    <Stack>
      <Text size='sm'>
        Заклинательная характеристика: <b>{abilityName(sc.ability)}</b>.
      </Text>
      {other.length > 0 && (
        <Fixed
          label='Уже известны или всегда подготовлены'
          value={other.map((k) => nameOf(k.spell) + (k.source === 'species' ? ' (вид)' : k.source === 'feat' ? ' (черта)' : ''))}
        />
      )}
      {n.cantrips > 0 && (
        <PickMany
          label='Заговоры'
          data={cantripPool.map(spellOption)}
          max={n.cantrips}
          value={sp.cantrips}
          onChange={(v) => set('spells', { cantrips: v })}
        />
      )}
      {n.spellbook > 0 ? (
        <>
          <PickMany
            label='Книга заклинаний: заклинания 1 круга'
            data={l1Pool.map(spellOption)}
            max={n.spellbook}
            value={sp.spellbook}
            onChange={(v) => set('spells', { spellbook: v, prepared: sp.prepared.filter((id) => v.includes(id)) })}
          />
          <PickMany
            label='Подготовленные заклинания (из книги)'
            data={sp.spellbook.map((id) => spellOption(byId.spell[id]))}
            max={n.prepared}
            value={sp.prepared}
            onChange={(v) => set('spells', { prepared: v })}
            disabled={sp.spellbook.length === 0}
          />
        </>
      ) : (
        <PickMany
          label='Подготовленные заклинания 1 круга'
          data={l1Pool.map(spellOption)}
          max={n.prepared}
          value={sp.prepared}
          onChange={(v) => set('spells', { prepared: v })}
        />
      )}
    </Stack>
  )
}

export function spellsValid(s: WizardState, d: Derived) {
  if (!d.cls?.spellcasting) return true
  const n = counts(d)
  const sp = s.spells
  return (
    sp.cantrips.length === n.cantrips &&
    sp.prepared.length === n.prepared &&
    sp.spellbook.length === n.spellbook
  )
}
