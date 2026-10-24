// Steps 4-5: rolling 4d6 x6 and assigning the results to abilities.
import { Button, Group, Paper, SimpleGrid, Stack, Table, Text } from '@mantine/core'
import { ABILITIES, Ability, abilityName } from '../../data'
import { rollAbilityScores } from '../../rules/dice'
import { mod, signed } from '../../rules/derive'
import type { Derived } from '../../rules/derive'
import type { WizardState } from '../state'
import { Fixed, Pick } from '../fields'
import type { StepProps } from './common'

export function RollStep({ s, set }: StepProps) {
  const rolls = s.roll.rolls
  return (
    <Stack>
      <Text size='sm'>
        Бросьте четыре шестигранника шесть раз; в каждом броске самая низкая кость не считается. На следующем шаге
        каждый результат достанется одной характеристике.
      </Text>
      <Group>
        <Button size='md' onClick={() => set('roll', { rolls: rollAbilityScores() })}>
          {rolls.length ? 'Перебросить 4к6 × 6' : 'Бросить 4к6 × 6'}
        </Button>
        {rolls.length > 0 && (
          <Text size='sm' c='dimmed'>
            Повторный бросок сбросит распределение и все следующие шаги.
          </Text>
        )}
      </Group>
      {rolls.length > 0 && (
        <SimpleGrid cols={{ base: 3, sm: 6 }} spacing='xs'>
          {rolls.map((r, i) => {
            const droppedAt = r.dice.indexOf(r.dropped)
            return (
              <Paper key={i} withBorder py='sm' px={6} radius='md'>
                <Text ta='center' fz={28} fw={700} lh={1.2}>
                  {r.total}
                </Text>
                <Group gap={4} justify='center' wrap='nowrap'>
                  {r.dice.map((die, j) => (
                    <Text
                      key={j}
                      size='sm'
                      c={j === droppedAt ? 'dimmed' : undefined}
                      td={j === droppedAt ? 'line-through' : undefined}
                    >
                      {die}
                    </Text>
                  ))}
                </Group>
              </Paper>
            )
          })}
        </SimpleGrid>
      )}
      {rolls.length > 0 && (
        <Text size='sm' c='dimmed'>
          Сумма всех шести: {rolls.reduce((n, r) => n + r.total, 0)}
        </Text>
      )}
    </Stack>
  )
}

export const rollValid = (s: WizardState) => s.roll.rolls.length === 6

export function AbilitiesStep({ s, d, set }: StepProps) {
  const { rolls } = s.roll
  const a = s.abilities
  const bg = d.bg
  const cls = d.cls
  const counts = new Map<number, number>()
  for (const r of rolls) counts.set(r.total, (counts.get(r.total) || 0) + 1)

  const usedBy = (i: number) => ABILITIES.find((x) => a.assign[x] === i)
  const assignData = (ab: Ability) =>
    rolls
      .map((r, i) => ({ r, i }))
      .filter(({ i }) => {
        const owner = usedBy(i)
        return !owner || owner === ab
      })
      .map(({ r, i }) => ({
        value: String(i),
        label: (counts.get(r.total) || 0) > 1 ? `${r.total} (бросок ${i + 1})` : String(r.total)
      }))

  const bgAbilities = bg?.ability_scores || []
  const abilityOpts = (list: Ability[]) => list.map((x) => ({ value: x, label: abilityName(x) }))

  return (
    <Stack>
      {cls && (
        <Text size='sm'>
          Основная характеристика класса «{cls.name_ru}»:{' '}
          <b>{cls.primary_abilities.map(abilityName).join(cls.primary_ability_mode === 'any' ? ' или ' : ' и ')}</b>.
        </Text>
      )}
      <Table withTableBorder verticalSpacing={4}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Характеристика</Table.Th>
            <Table.Th w={190}>Бросок</Table.Th>
            <Table.Th ta='center'>Бонус</Table.Th>
            <Table.Th ta='center'>Итог</Table.Th>
            <Table.Th ta='center'>Мод.</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {ABILITIES.map((ab) => {
            const base = d.base[ab]
            const total = base != null ? Math.min(20, base + d.bonus[ab]) : null
            return (
              <Table.Tr key={ab}>
                <Table.Td>{abilityName(ab)}</Table.Td>
                <Table.Td>
                  <Pick
                    label=''
                    data={assignData(ab)}
                    value={a.assign[ab] != null ? String(a.assign[ab]) : null}
                    onChange={(v) => set('abilities', { assign: { ...a.assign, [ab]: v == null ? undefined : Number(v) } })}
                  />
                </Table.Td>
                <Table.Td ta='center'>{d.bonus[ab] ? '+' + d.bonus[ab] : '—'}</Table.Td>
                <Table.Td ta='center' fw={700}>{total ?? '—'}</Table.Td>
                <Table.Td ta='center'>{total != null ? signed(mod(total)) : '—'}</Table.Td>
              </Table.Tr>
            )
          })}
        </Table.Tbody>
      </Table>
      <SimpleGrid cols={3}>
        <Pick
          label='Бонус предыстории'
          data={[
            { value: '2-1', label: '+2 и +1' },
            { value: '1-1-1', label: '+1, +1 и +1' }
          ]}
          value={a.mode}
          onChange={(v) => set('abilities', { mode: v as WizardState['abilities']['mode'], plus2: null, plus1: null })}
        />
        {a.mode === '2-1' && (
          <>
            <Pick
              label='+2 к'
              data={abilityOpts(bgAbilities)}
              value={a.plus2}
              onChange={(v) => set('abilities', { plus2: v as Ability, plus1: a.plus1 === v ? null : a.plus1 })}
            />
            <Pick
              label='+1 к'
              data={abilityOpts(bgAbilities.filter((x) => x !== a.plus2))}
              value={a.plus1}
              onChange={(v) => set('abilities', { plus1: v as Ability })}
            />
          </>
        )}
        {a.mode === '1-1-1' && <Fixed label='+1 к' value={bgAbilities.map(abilityName)} />}
      </SimpleGrid>
    </Stack>
  )
}

export function abilitiesValid(s: WizardState, _d: Derived) {
  const a = s.abilities
  if (!ABILITIES.every((x) => a.assign[x] != null)) return false
  if (a.mode === '1-1-1') return true
  return a.mode === '2-1' && Boolean(a.plus2 && a.plus1 && a.plus2 !== a.plus1)
}
