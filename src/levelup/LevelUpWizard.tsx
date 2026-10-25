// "New level" wizard: reads the sheet, offers what the next class level gives and
// writes the result back to the sheet.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Box, Button, Group, List, Modal, NavLink, Stack, Text, Title } from '@mantine/core'
import type { DnDCharacter } from 'dnd-sheet'
import { nameOf } from '../data'
import { applyLevelUp } from './apply'
import {
  LevelPicks, choicesValid, emptyPicks, featChoices, featStepKind, featureChoices, hpGain, nextLevel, speciesLineageMissing,
  spellChoices, spellPlan, subclassStepNeeded
} from './plan'
import type { ChoiceDef } from './plan'
import { readSheet } from './read'
import type { SheetInfo } from './read'
import { FeatStep, FeaturesStep, HpStep, LevelStepProps, SpellsStep, StepId, SubclassStep, SummaryStep } from './steps'

// the picks of each step, by key prefix; a step resets every step after it
const ORDER: StepId[] = ['hp', 'subclass', 'feat', 'features', 'spells', 'summary']
const PREFIX: Partial<Record<StepId, RegExp>> = { feat: /^ft(-x)?:/, features: /^[fsg]:/, spells: /^sp:/ }

function resetAfter(p: LevelPicks, step: StepId): LevelPicks {
  const later = ORDER.slice(ORDER.indexOf(step) + 1)
  const next: LevelPicks = { ...p, choices: { ...p.choices } }
  if (later.includes('subclass')) next.subclass = null
  if (later.includes('feat')) next.feat = null
  for (const s of later) {
    const re = PREFIX[s]
    if (re) for (const k of Object.keys(next.choices)) if (re.test(k)) delete next.choices[k]
  }
  return next
}

function defsOf(step: StepId, info: SheetInfo, p: LevelPicks): ChoiceDef[] {
  if (step === 'feat') return featChoices(info, p)
  if (step === 'features') return featureChoices(info, p)
  if (step === 'spells') return spellChoices(info, p)
  return []
}

// drop picks that a changed choice made impossible (and choices that disappeared)
function sanitize(step: StepId, info: SheetInfo, p: LevelPicks): LevelPicks {
  const re = PREFIX[step]
  if (!re) return p
  let cur = p
  for (let pass = 0; pass < 3; pass++) {
    const defs = new Map(defsOf(step, info, cur).map((d) => [d.key, d]))
    const choices = { ...cur.choices }
    let changed = false
    for (const [k, v] of Object.entries(choices)) {
      if (!re.test(k)) continue
      const d = defs.get(k)
      const kept = d ? v.filter((x) => d.options.some((o) => o.value === x)).slice(0, d.count) : []
      if (kept.length !== v.length) {
        changed = true
        if (kept.length) choices[k] = kept
        else delete choices[k]
      }
    }
    if (!changed) return cur
    cur = { ...cur, choices }
  }
  return cur
}

interface StepDef {
  id: StepId
  title: string
  valid: boolean
}

function stepsFor(info: SheetInfo, p: LevelPicks): StepDef[] {
  const kind = featStepKind(info)
  const out: StepDef[] = [{ id: 'hp', title: 'Хиты', valid: hpGain(info, p) != null }]
  if (subclassStepNeeded(info)) out.push({ id: 'subclass', title: 'Подкласс', valid: Boolean(p.subclass) })
  if (kind) {
    out.push({ id: 'feat', title: kind === 'epic-boon' ? 'Эпический дар' : 'Черта', valid: Boolean(p.feat) && choicesValid(featChoices(info, p), p) })
  }
  out.push({ id: 'features', title: 'Умения', valid: !speciesLineageMissing(info) && choicesValid(featureChoices(info, p), p) })
  const plan = spellPlan(info, p)
  const spellDefs = spellChoices(info, p)
  if (spellDefs.length || plan?.automatic.length) out.push({ id: 'spells', title: 'Заклинания', valid: choicesValid(spellDefs, p) })
  out.push({ id: 'summary', title: 'Итог', valid: true })
  return out
}

export function LevelUpWizard(props: { character: DnDCharacter; onClose: () => void; onComplete: (c: DnDCharacter) => void }) {
  const read = useMemo(() => readSheet(props.character), [props.character])
  const [picks, setPicks] = useState<LevelPicks>(emptyPicks)
  const [active, setActive] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const info = read.info

  const steps = info ? stepsFor(info, picks) : []
  const firstOpen = steps.findIndex((s) => !s.valid)
  const maxStep = firstOpen === -1 ? steps.length - 1 : firstOpen
  const current = Math.min(active, maxStep)
  const step = steps[current]

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [current])

  const title = info ? `Новый уровень: ${nameOf(info.cls)} ${nextLevel(info)}` : 'Новый уровень'
  const modalProps = {
    opened: true,
    onClose: props.onClose,
    title,
    size: '72rem',
    styles: {
      content: { display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
      header: { flexShrink: 0 },
      body: { display: 'flex', minHeight: 0 }
    }
  }

  if (!info) {
    return (
      <Modal {...modalProps}>
        <Stack style={{ flex: 1 }}>
          <Alert color='red' variant='light' title='Лист заполнен не полностью'>
            <List size='sm' spacing={4}>
              {read.errors.map((e) => <List.Item key={e}>{e}</List.Item>)}
            </List>
          </Alert>
          <Text size='sm'>Исправьте эти поля листа и откройте визард снова.</Text>
          <Group justify='flex-end'>
            <Button onClick={props.onClose}>Закрыть</Button>
          </Group>
        </Stack>
      </Modal>
    )
  }

  const stepProps: LevelStepProps = {
    info,
    picks,
    update: (patch) => {
      const next = { ...picks, ...patch }
      if (JSON.stringify(next) === JSON.stringify(picks)) return
      setPicks(resetAfter(next, step.id))
    },
    choose: (key, values) => {
      if (JSON.stringify(picks.choices[key] || []) === JSON.stringify(values)) return
      const next = { ...picks, choices: { ...picks.choices, [key]: values } }
      if (!values.length) delete next.choices[key]
      setPicks(sanitize(step.id, info, resetAfter(next, step.id)))
    }
  }
  const result = step.id === 'summary' ? applyLevelUp(props.character, info, picks) : null
  const last = current === steps.length - 1

  return (
    <Modal {...modalProps}>
      <Group align='stretch' wrap='nowrap' gap='xl' style={{ flex: 1, minWidth: 0 }}>
        <Stack gap={2} w={200} style={{ flexShrink: 0, overflowY: 'auto' }}>
          {steps.map((st, i) => (
            <NavLink
              key={st.id}
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
          <Title order={3} style={{ flexShrink: 0 }}>{step.title}</Title>
          <Box ref={scrollRef} style={{ minHeight: 0, overflowY: 'auto', padding: 4, margin: -4 }}>
            {current === 0 && read.warnings.map((w) => <Alert key={w} color='yellow' variant='light' mb='md'>{w}</Alert>)}
            {step.id === 'hp' && <HpStep {...stepProps} />}
            {step.id === 'subclass' && <SubclassStep {...stepProps} />}
            {step.id === 'feat' && <FeatStep {...stepProps} />}
            {step.id === 'features' && <FeaturesStep {...stepProps} />}
            {step.id === 'spells' && <SpellsStep {...stepProps} />}
            {step.id === 'summary' && result && <SummaryStep summary={result.summary} warnings={read.warnings} />}
          </Box>
          <Group justify='space-between' mt='auto' style={{ flexShrink: 0 }}>
            <Button variant='subtle' color='gray' onClick={() => { setPicks(emptyPicks()); setActive(0) }}>
              Начать заново
            </Button>
            <Group>
              <Button variant='default' disabled={current === 0} onClick={() => setActive(current - 1)}>
                Назад
              </Button>
              {last ? (
                <Button onClick={() => result && props.onComplete(result.character)}>Сохранить уровень</Button>
              ) : (
                <Button disabled={!step.valid} onClick={() => setActive(current + 1)}>
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
