// Step 11: free-form details. Only the name is required.
import { SimpleGrid, Stack, TextInput, Textarea } from '@mantine/core'
import { alignments, nameOf } from '../../data'
import type { PersonalityState, WizardState } from '../state'
import { Pick } from '../fields'
import type { StepProps } from './common'

export function PersonalityStep({ s, set }: StepProps) {
  const p = s.personality
  const text = (key: keyof PersonalityState, label: string, required = false) => (
    <TextInput
      label={label}
      withAsterisk={required}
      value={(p[key] as string) || ''}
      onChange={(e) => set('personality', { [key]: e.currentTarget.value } as Partial<PersonalityState>, true)}
    />
  )
  const area = (key: keyof PersonalityState, label: string, rows = 2) => (
    <Textarea
      label={label}
      autosize
      minRows={rows}
      value={(p[key] as string) || ''}
      onChange={(e) => set('personality', { [key]: e.currentTarget.value } as Partial<PersonalityState>, true)}
    />
  )
  return (
    <Stack>
      <SimpleGrid cols={2}>
        {text('name', 'Имя персонажа', true)}
        {text('playerName', 'Игрок')}
        <Pick
          label='Мировоззрение'
          data={alignments.filter((a) => a.selectable).map((a) => ({ value: a.id, label: nameOf(a) }))}
          value={p.alignment}
          onChange={(v) => set('personality', { alignment: v })}
        />
        {text('deity', 'Божество')}
      </SimpleGrid>
      <SimpleGrid cols={3}>
        {text('age', 'Возраст')}
        {text('height', 'Рост')}
        {text('weight', 'Вес')}
        {text('eyes', 'Глаза')}
        {text('skin', 'Кожа')}
        {text('hair', 'Волосы')}
      </SimpleGrid>
      <SimpleGrid cols={2}>
        {area('traits', 'Черты характера')}
        {area('ideals', 'Идеалы')}
        {area('bonds', 'Привязанности')}
        {area('flaws', 'Слабости')}
      </SimpleGrid>
      {area('backstory', 'История персонажа', 3)}
    </Stack>
  )
}

export const personalityValid = (s: WizardState) => s.personality.name.trim().length > 0
