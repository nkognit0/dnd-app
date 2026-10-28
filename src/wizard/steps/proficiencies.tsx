// Steps 6-8: origin feat choices, skills/tools/languages, level 1 class choices.
import { Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import {
  abilityName, byId, categoryItems, classOptions, fightingStyles, languages, nameOf, ruName, skills, spellsFor,
  toolItems, weapons
} from '../../data'
import type { ClassChoice } from '../../data'
import type { Derived, FeatSlot } from '../../rules/derive'
import { invocationName } from '../../rules/text'
import type { FeatPicks, WizardState } from '../state'
import { Fixed, Pick, PickMany, options } from '../fields'
import type { StepProps } from './common'

const skillName = (id: string) => nameOf(byId.skill[id])
const itemName = (id: string) => nameOf(byId.item[id])

// ---------------------------------------------------------------- origin feats

// Skills and tools known before the feat step, not counting the given slot.
function knownBeforeFeats(d: Derived, s: WizardState, except: FeatSlot['slot']) {
  const skillSet = new Set<string>(d.bg?.skill_proficiencies || [])
  for (const id of s.species.skills) skillSet.add(id)
  const toolSet = new Set<string>([...(d.bg?.tool_proficiencies.fixed || []), ...s.background.toolChoice])
  if (s.species.tool) toolSet.add(s.species.tool)
  for (const slot of d.featSlots) {
    if (slot.slot === except) continue
    for (const p of slot.picks.picks) {
      if (p.startsWith('skill:')) skillSet.add(p.slice(6))
      else if (p.startsWith('tool:')) toolSet.add(p.slice(5))
      else toolSet.add(p)
    }
  }
  return { skillSet, toolSet }
}

function FeatCard({ slot, s, d, set }: StepProps & { slot: FeatSlot }) {
  const p = slot.picks
  const update = (patch: Partial<FeatPicks>) =>
    set('feats', { [slot.slot]: { ...p, ...patch } } as Partial<WizardState['feats']>)
  const { skillSet, toolSet } = knownBeforeFeats(d, s, slot.slot)
  const from = slot.slot === 'background' ? 'от предыстории' : 'от вида'
  let body: JSX.Element
  switch (slot.feat.id) {
    case 'skilled': {
      const data = [
        { group: 'Навыки', items: skills.filter((x) => !skillSet.has(x.id)).map((x) => ({ value: 'skill:' + x.id, label: nameOf(x) })) },
        { group: 'Инструменты', items: toolItems.filter((x) => !toolSet.has(x.id)).map((x) => ({ value: 'tool:' + x.id, label: nameOf(x) })) }
      ]
      body = <PickMany label='Навыки или инструменты' data={data} max={3} value={p.picks} onChange={(v) => update({ picks: v })} />
      break
    }
    case 'magic-initiate': {
      const other = d.featSlots.find((x) => x.slot !== slot.slot && x.feat.id === 'magic-initiate')
      const otherList = other ? other.fixedList || other.picks.spellList : null
      const list = slot.fixedList || p.spellList
      body = (
        <SimpleGrid cols={2}>
          <Pick
            label='Список заклинаний'
            data={['cleric', 'druid', 'wizard'].filter((x) => x !== otherList).map((x) => ({ value: x, label: ruName('classes', x) }))}
            value={list}
            onChange={(v) => update({ spellList: v, cantrips: [], spell: null })}
            disabled={Boolean(slot.fixedList)}
          />
          <Pick
            label='Заклинательная характеристика'
            data={(['int', 'wis', 'cha'] as const).map((a) => ({ value: a, label: abilityName(a) }))}
            value={p.ability}
            onChange={(v) => update({ ability: v as FeatPicks['ability'] })}
          />
          <PickMany
            label='Заговоры'
            data={list ? options(spellsFor(list, 0), (x) => x.id, (x) => nameOf(x)) : []}
            max={2}
            value={p.cantrips}
            onChange={(v) => update({ cantrips: v })}
            disabled={!list}
          />
          <Pick
            label='Заклинание 1 круга'
            data={list ? options(spellsFor(list, 1), (x) => x.id, (x) => nameOf(x)) : []}
            value={p.spell}
            onChange={(v) => update({ spell: v })}
            disabled={!list}
            searchable
          />
        </SimpleGrid>
      )
      break
    }
    case 'crafter':
    case 'musician': {
      const choice = slot.feat.choices?.find((c) => c.type === 'tool')
      const pool = Array.isArray(choice?.from)
        ? choice!.from
        : (choice?.from_categories || []).flatMap((c) => categoryItems(c).map((x) => x.id))
      body = (
        <PickMany
          label='Инструменты'
          data={options(pool.filter((id) => !toolSet.has(id)), (id) => id, itemName)}
          max={choice?.count || 3}
          value={p.picks}
          onChange={(v) => update({ picks: v })}
        />
      )
      break
    }
    default:
      body = <Text size='sm' c='dimmed'>У этой черты нет выбора.</Text>
  }
  return (
    <Paper withBorder p='md' radius='md'>
      <Title order={5} mb='xs'>
        {nameOf(slot.feat)} <Text span size='sm' c='dimmed'>({from})</Text>
      </Title>
      {body}
    </Paper>
  )
}

export function FeatsStep(props: StepProps) {
  return (
    <Stack>
      {props.d.featSlots.map((slot) => (
        <FeatCard key={slot.slot} slot={slot} {...props} />
      ))}
    </Stack>
  )
}

function featSlotValid(slot: FeatSlot) {
  const p = slot.picks
  switch (slot.feat.id) {
    case 'skilled':
      return p.picks.length === 3
    case 'magic-initiate':
      return Boolean((slot.fixedList || p.spellList) && p.ability && p.cantrips.length === 2 && p.spell)
    case 'crafter':
    case 'musician':
      return p.picks.length === (slot.feat.choices?.find((c) => c.type === 'tool')?.count || 3)
    default:
      return true
  }
}

export const featsValid = (_s: WizardState, d: Derived) => d.featSlots.every(featSlotValid)

// ---------------------------------------------------------------- skills, tools, languages

function skillPool(d: Derived, known: Set<string>) {
  const group = d.cls?.skill_proficiencies.choose[0]
  if (!group) return { count: 0, pool: [] as string[] }
  const listed = group.from === 'any' || !group.from ? skills.map((x) => x.id) : group.from
  let pool = listed.filter((id) => !known.has(id))
  // if almost everything is already known, any skill may be taken instead
  if (pool.length < group.count) pool = skills.map((x) => x.id).filter((id) => !known.has(id))
  return { count: group.count, pool }
}

function knownBeforeClass(d: Derived, s: WizardState) {
  const skillsKnown = new Map(d.skills)
  for (const id of s.skills.classSkills) skillsKnown.delete(id)
  const toolsKnown = new Map(d.tools)
  for (const id of s.skills.classTools) toolsKnown.delete(id)
  return { skillsKnown, toolsKnown }
}

const choiceOf = (d: Derived, type: ClassChoice['type']) => d.cls?.level_1_choices.find((c) => c.type === type)

export function SkillsStep({ s, d, set }: StepProps) {
  const cls = d.cls!
  const { skillsKnown, toolsKnown } = knownBeforeClass(d, s)
  const { count, pool } = skillPool(d, new Set(skillsKnown.keys()))
  const expertise = choiceOf(d, 'expertise')
  const extraLang = choiceOf(d, 'language')
  const proficient = [...skillsKnown.keys(), ...s.skills.classSkills]
  const classLangs = cls.languages.fixed || []
  const knownLangs = new Set(['common', ...classLangs, ...s.skills.languages])
  const toolGroups = cls.tool_proficiencies.choose
  const toolPool = toolGroups.flatMap((g) => (g.from_categories || []).flatMap((c) => categoryItems(c).map((x) => x.id)))

  return (
    <Stack>
      <Fixed
        label='Навыки, которые уже есть'
        value={[...skillsKnown.entries()].map(([id, src]) => `${skillName(id)} (${src})`)}
      />
      <PickMany
        label='Навыки класса'
        data={options(pool, (id) => id, skillName)}
        max={count}
        value={s.skills.classSkills}
        onChange={(v) =>
          set('skills', {
            classSkills: v,
            expertise: s.skills.expertise.filter((x) => skillsKnown.has(x) || v.includes(x))
          })
        }
      />
      {expertise && (
        <PickMany
          label='Компетентность'
          data={options(proficient, (id) => id, skillName)}
          max={expertise.count}
          value={s.skills.expertise}
          onChange={(v) => set('skills', { expertise: v })}
        />
      )}
      {[...toolsKnown.values()].some((src) => src !== 'класс') && (
        <Fixed
          label='Инструменты, которые уже есть'
          value={[...toolsKnown.entries()].filter(([, src]) => src !== 'класс').map(([id, src]) => `${itemName(id)} (${src})`)}
        />
      )}
      <SimpleGrid cols={2}>
        {cls.tool_proficiencies.fixed.length > 0 && (
          <Fixed label='Инструменты класса' value={cls.tool_proficiencies.fixed.map(itemName)} />
        )}
        {toolGroups.length > 0 && (
          <PickMany
            label='Инструменты на выбор'
            data={options(toolPool.filter((id) => !toolsKnown.has(id)), (id) => id, itemName)}
            max={toolGroups.reduce((n, g) => n + g.count, 0)}
            value={s.skills.classTools}
            onChange={(v) => set('skills', { classTools: v })}
          />
        )}
      </SimpleGrid>
      <SimpleGrid cols={2}>
        <Fixed label='Язык' value={nameOf(byId.language.common)} description='Его знают все персонажи' />
        <PickMany
          label='Стандартные языки'
          data={options(
            languages.filter((l) => l.rarity === 'standard' && !['common', ...classLangs].includes(l.id)),
            (l) => l.id,
            (l) => nameOf(l)
          )}
          max={2}
          value={s.skills.languages}
          onChange={(v) => set('skills', { languages: v })}
        />
        {classLangs.length > 0 && <Fixed label='Языки класса' value={classLangs.map((id) => nameOf(byId.language[id]))} />}
        {extraLang && (
          <Pick
            label='Ещё один язык (воровской жаргон)'
            data={options(languages.filter((l) => !knownLangs.has(l.id) || s.skills.extraLanguages.includes(l.id)), (l) => l.id, (l) => nameOf(l))}
            value={s.skills.extraLanguages[0] ?? null}
            onChange={(v) => set('skills', { extraLanguages: v ? [v] : [] })}
          />
        )}
      </SimpleGrid>
    </Stack>
  )
}

export function skillsValid(s: WizardState, d: Derived) {
  if (!d.cls) return false
  const { skillsKnown } = knownBeforeClass(d, s)
  const { count } = skillPool(d, new Set(skillsKnown.keys()))
  const toolsNeed = d.cls.tool_proficiencies.choose.reduce((n, g) => n + g.count, 0)
  const expertise = choiceOf(d, 'expertise')
  const extraLang = choiceOf(d, 'language')
  return (
    s.skills.classSkills.length === count &&
    s.skills.classTools.length === toolsNeed &&
    s.skills.languages.length === 2 &&
    (!expertise || s.skills.expertise.length === expertise.count) &&
    (!extraLang || s.skills.extraLanguages.length === extraLang.count)
  )
}

// ---------------------------------------------------------------- level 1 class choices

const FEATURE_TYPES = ['feat', 'class-option', 'weapon-mastery']

export function FeaturesStep({ s, d, set }: StepProps) {
  const cls = d.cls!
  const f = s.features
  const choices = cls.level_1_choices.filter((c) => FEATURE_TYPES.includes(c.type))
  const withChoice = new Set(choices.map((c) => c.feature))
  const plain = cls.level_1_features.filter((x) => !withChoice.has(x.id))
  return (
    <Stack>
      {choices.length === 0 && <Text size='sm'>На 1-м уровне у этого класса нет выборов в умениях.</Text>}
      {choices.map((c) => {
        if (c.type === 'feat') {
          return (
            <Pick
              key={c.id}
              label='Боевой стиль'
              data={options(fightingStyles, (x) => x.id, (x) => nameOf(x))}
              value={f.fightingStyle}
              onChange={(v) => set('features', { fightingStyle: v })}
            />
          )
        }
        if (c.type === 'weapon-mastery') {
          const pool = weapons.filter((w) => w.mastery_classes.includes(cls.id))
          return (
            <PickMany
              key={c.id}
              label='Мастерство оружия'
              data={options(pool, (w) => w.id, (w) => `${nameOf(w)} — ${ruName('weapon_masteries', w.mastery).toLowerCase()}`)}
              max={c.count}
              value={f.masteries}
              onChange={(v) => set('features', { masteries: v })}
            />
          )
        }
        if (c.options_group === 'eldritch-invocation') {
          const pool = (classOptions['eldritch-invocation'] || []).filter((o) => (o.min_level ?? 1) <= (c.max_prerequisite_level ?? 1))
          return (
            <PickMany
              key={c.id}
              label='Таинственные воззвания'
              data={options(pool, (o) => o.id, (o) => invocationName(o.id, nameOf(o)))}
              max={c.count}
              value={f.invocations}
              onChange={(v) => set('features', { invocations: v })}
            />
          )
        }
        const group = c.options_group || ''
        return (
          <Pick
            key={c.id}
            label={group === 'divine-order' ? 'Божественный орден' : 'Первобытный орден'}
            data={options(classOptions[group] || [], (o) => o.id, (o) => nameOf(o))}
            value={f.order}
            onChange={(v) => set('features', { order: v })}
          />
        )
      })}
      {plain.length > 0 && (
        <Fixed label='Остальные умения 1-го уровня' value={plain.map((x) => x.name_ru || x.name)} />
      )}
    </Stack>
  )
}

export function featuresValid(s: WizardState, d: Derived) {
  if (!d.cls) return false
  const f = s.features
  return d.cls.level_1_choices
    .filter((c) => FEATURE_TYPES.includes(c.type))
    .every((c) => {
      if (c.type === 'feat') return Boolean(f.fightingStyle)
      if (c.type === 'weapon-mastery') return f.masteries.length === c.count
      if (c.options_group === 'eldritch-invocation') return f.invocations.length === c.count
      return Boolean(f.order)
    })
}
