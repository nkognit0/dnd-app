// Step 12: everything the wizard computed, before the sheet is filled.
import { Alert, Paper, Stack, Table, Text, Title } from '@mantine/core'
import type { CSSProperties } from 'react'
import { ABILITIES, abilityName, nameOf, skills } from '../../data'
import { mod, signed } from '../../rules/derive'
import { SKILL_FIELD, buildCharacter } from '../../rules/sheet'
import type { StepProps } from './common'

// as many columns as fit the modal (not the window), each at least `min` wide
const autoGrid = (min: string): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fit, minmax(${min}, 1fr))`,
  gap: 'var(--mantine-spacing-sm)',
  alignItems: 'start'
})

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Paper withBorder p='xs' radius='md' title={hint}>
      <Text size='xs' c='dimmed'>{label}</Text>
      <Text fw={700} size='lg'>{value || '—'}</Text>
    </Paper>
  )
}

export function SummaryStep({ s }: StepProps) {
  const { character: c, acFormula, warnings, derived: d } = buildCharacter(s)
  const skillRows = skills.filter((x) => d.skills.has(x.id))
  return (
    <Stack>
      <Title order={4}>
        {c.name} — {c.classLevel}, {c.species}, {c.background}
      </Title>
      {warnings.map((w) => (
        <Alert key={w} color='yellow' variant='light'>{w}</Alert>
      ))}
      <div style={{ ...autoGrid('6.5rem'), alignItems: 'stretch' }}>
        <Stat label='Хиты' value={c.maxHp || ''} />
        <Stat label='Класс доспеха' value={c.ac || ''} hint={acFormula} />
        <Stat label='Инициатива' value={c.init || ''} />
        <Stat label='Скорость' value={c.speed || ''} />
        <Stat label='Бонус мастерства' value={c.proficiencyBonus || ''} />
        <Stat label='Пассивное восприятие' value={c.passivePerception || ''} />
      </div>
      <Text size='xs' c='dimmed'>КД: {acFormula}</Text>
      <div style={autoGrid('18rem')}>
        <Table withTableBorder verticalSpacing={2}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Характеристика</Table.Th>
              <Table.Th ta='center'>Значение</Table.Th>
              <Table.Th ta='center'>Спасбросок</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {ABILITIES.map((a) => (
              <Table.Tr key={a}>
                <Table.Td>{abilityName(a)}</Table.Td>
                <Table.Td ta='center'>{c[a]} ({signed(mod(Number(c[a])))})</Table.Td>
                <Table.Td ta='center' fw={c[a + 'SaveChecked'] ? 700 : 400}>{c[a + 'Save']}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <Table withTableBorder verticalSpacing={2}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Навык с владением</Table.Th>
              <Table.Th ta='center'>Бонус</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {skillRows.map((x) => (
              <Table.Tr key={x.id}>
                <Table.Td>{nameOf(x)}{d.expertise.has(x.id) ? ' (компетентность)' : ''}</Table.Td>
                <Table.Td ta='center'>{c[SKILL_FIELD[x.id]]}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </div>
      {(c.attacks?.length || 0) > 0 && (
        <Table withTableBorder verticalSpacing={2}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Атака</Table.Th>
              <Table.Th>Бонус / Сл</Table.Th>
              <Table.Th>Урон</Table.Th>
              <Table.Th>Примечания</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {c.attacks!.map((r, i) => (
              <Table.Tr key={i}>
                <Table.Td>{r.name}</Table.Td>
                <Table.Td>{r.bonus}</Table.Td>
                <Table.Td>{r.damage}</Table.Td>
                <Table.Td>{r.notes}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      {c.spellcastingClass && (
        <Text size='sm'>
          Заклинания: {c.spellcastingClass}, Сл {c.spellSaveDC}, бонус атаки {c.spellAttackBonus}
          {c.lvl1SpellSlotsTotal ? `, ячеек 1 круга: ${c.lvl1SpellSlotsTotal}` : ''}.
        </Text>
      )}
      <Text size='sm'>
        Деньги: {[c.gp && c.gp + ' зм', c.sp && c.sp + ' см', c.cp && c.cp + ' мм'].filter(Boolean).join(', ') || '0 зм'}.
        Языки: {c.languages}.
      </Text>
      <Text size='xs' c='dimmed'>
        Всё это попадёт в лист; любое поле там можно будет поправить вручную.
      </Text>
    </Stack>
  )
}
