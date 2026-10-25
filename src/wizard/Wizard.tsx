import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Button, Group, Modal, NavLink, Stack, Text, Title } from '@mantine/core'
import type { DnDCharacter } from 'dnd-sheet'
import { derive } from '../rules/derive'
import type { Derived } from '../rules/derive'
import { buildCharacter } from '../rules/sheet'
import { useHistory } from './history'
import { UndoRedo } from './UndoRedo'
import { StepKey, WizardState, applyUpdate, initialState } from './state'
import type { StepProps } from './steps/common'
import { BackgroundStep, ClassStep, SpeciesStep, backgroundValid, classValid, speciesValid } from './steps/origin'
import { AbilitiesStep, RollStep, abilitiesValid, rollValid } from './steps/abilities'
import { FeatsStep, FeaturesStep, SkillsStep, featsValid, featuresValid, skillsValid } from './steps/proficiencies'
import { SpellsStep, spellsValid } from './steps/spells'
import { EquipmentStep, equipmentValid } from './steps/equipment'
import { PersonalityStep, personalityValid } from './steps/personality'
import { SummaryStep } from './steps/summary'

interface StepDef {
  title: string
  Comp: (p: StepProps) => JSX.Element | null
  valid: (s: WizardState, d: Derived) => boolean
}

const STEPS: StepDef[] = [
  { title: 'Класс', Comp: ClassStep, valid: classValid },
  { title: 'Предыстория', Comp: BackgroundStep, valid: backgroundValid },
  { title: 'Вид', Comp: SpeciesStep, valid: speciesValid },
  { title: 'Броски', Comp: RollStep, valid: rollValid },
  { title: 'Характеристики', Comp: AbilitiesStep, valid: abilitiesValid },
  { title: 'Черты', Comp: FeatsStep, valid: featsValid },
  { title: 'Навыки и языки', Comp: SkillsStep, valid: skillsValid },
  { title: 'Умения класса', Comp: FeaturesStep, valid: featuresValid },
  { title: 'Заклинания', Comp: SpellsStep, valid: spellsValid },
  { title: 'Снаряжение', Comp: EquipmentStep, valid: equipmentValid },
  { title: 'Личность', Comp: PersonalityStep, valid: personalityValid },
  { title: 'Итог', Comp: SummaryStep, valid: () => true }
]

export function Wizard(props: { opened: boolean; onClose: () => void; onComplete: (c: DnDCharacter) => void }) {
  const history = useHistory<WizardState>(initialState)
  const state = history.value
  const [active, setActive] = useState(0)
  const d = useMemo(() => derive(state), [state])
  const scrollRef = useRef<HTMLDivElement>(null)
  // the step on screen, for the history to know where a change was made
  const currentRef = useRef(0)

  // A step can be opened when every step before it is complete.
  const validity = STEPS.map((st) => st.valid(state, d))
  const firstOpen = validity.findIndex((v) => !v)
  const maxStep = firstOpen === -1 ? STEPS.length - 1 : firstOpen

  const { change } = history
  const set = useCallback(<K extends StepKey>(key: K, patch: Partial<WizardState[K]>, typing?: boolean) => {
    change((prev) => applyUpdate(prev, key, patch), currentRef.current, typing ? key + ':' + Object.keys(patch).join() : undefined)
  }, [change])

  // starting over is an action too, so it can be undone
  const reset = () => {
    change((prev) => (JSON.stringify(prev) === JSON.stringify(initialState()) ? prev : initialState()), currentRef.current)
    setActive(0)
  }

  const finish = () => {
    props.onComplete(buildCharacter(state).character)
    history.clear(initialState())
    setActive(0)
  }

  // undo and redo open the step where the change was made
  const show = (step: number | null) => step != null && setActive(step)

  const current = Math.min(active, maxStep)
  currentRef.current = current
  const step = STEPS[current]
  const Comp = step.Comp
  const last = current === STEPS.length - 1

  // every step opens at its top
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [current])

  return (
    <Modal
      opened={props.opened}
      onClose={props.onClose}
      title='Новый персонаж'
      size='72rem'
      // the step list and the buttons stay in place, only the step itself scrolls
      styles={{
        content: { display: 'flex', flexDirection: 'column', overflow: 'hidden' },
        header: { flexShrink: 0 },
        body: { display: 'flex', minHeight: 0 }
      }}
    >
      <Group align='stretch' wrap='nowrap' gap='xl' style={{ flex: 1, minWidth: 0 }}>
        <Stack gap={2} w={200} style={{ flexShrink: 0, overflowY: 'auto' }}>
          {STEPS.map((st, i) => (
            <NavLink
              key={st.title}
              component='button'
              label={`${i + 1}. ${st.title}`}
              active={i === current}
              disabled={i > maxStep}
              onClick={() => setActive(i)}
              rightSection={i !== current && i < maxStep ? <Text size='xs' c='teal'>✓</Text> : null}
              styles={{ root: { borderRadius: 6, padding: '6px 10px' } }}
            />
          ))}
        </Stack>
        <Stack style={{ flex: 1, minWidth: 0 }} gap='md'>
          <Title order={3} style={{ flexShrink: 0 }}>
            {step.title}
          </Title>
          <Box ref={scrollRef} style={{ minHeight: 0, overflowY: 'auto', padding: 4, margin: -4 }}>
            <Comp s={state} d={d} set={set} />
          </Box>
          <Group justify='space-between' mt='auto' style={{ flexShrink: 0 }}>
            <Button variant='subtle' color='gray' onClick={reset}>
              Начать заново
            </Button>
            <Group>
              <UndoRedo
                canUndo={history.canUndo}
                canRedo={history.canRedo}
                onUndo={() => show(history.undo())}
                onRedo={() => show(history.redo())}
              />
              <Button variant='default' disabled={current === 0} onClick={() => setActive(current - 1)}>
                Назад
              </Button>
              {last ? (
                <Button onClick={finish}>Создать лист</Button>
              ) : (
                <Button disabled={!validity[current]} onClick={() => setActive(current + 1)}>
                  Далее
                </Button>
              )}
            </Group>
          </Group>
        </Stack>
      </Group>
    </Modal>
  )
}
