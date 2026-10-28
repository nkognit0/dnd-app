// Steps 1-3: class, background, species.
import { SimpleGrid, Stack } from '@mantine/core'
import {
  abilityName, backgrounds, byId, categoryItems, classes, nameOf, originFeats, ruName, skills, speciesOptions,
  species as speciesList, toolItems
} from '../../data'
import type { WizardState } from '../state'
import type { Derived } from '../../rules/derive'
import { Fixed, Pick, PickMany, options } from '../fields'
import { ARMOR_RU, StepProps } from './common'

const skillName = (id: string) => nameOf(byId.skill[id])

// ---------------------------------------------------------------- class

export function ClassStep({ s, d, set }: StepProps) {
  const cls = d.cls
  const data = options(classes, (c) => c.id, (c) => nameOf(c) + (c.source === 'efota' ? ' (Eberron)' : ''))
  return (
    <Stack>
      <Pick label='Класс' data={data} value={s.cls.classId} onChange={(v) => set('cls', { classId: v })} />
      {cls && (
        <SimpleGrid cols={2}>
          <Fixed label='Кость хитов' value={'к' + cls.hit_die} />
          <Fixed
            label='Основная характеристика'
            value={cls.primary_abilities.map(abilityName).join(cls.primary_ability_mode === 'any' ? ' или ' : ' и ')}
          />
          <Fixed label='Спасброски' value={cls.saving_throws.map(abilityName)} />
          <Fixed label='Доспехи' value={cls.armor_training.length ? cls.armor_training.map((a) => ARMOR_RU[a]) : 'Нет'} />
        </SimpleGrid>
      )}
    </Stack>
  )
}

export const classValid = (s: WizardState) => Boolean(s.cls.classId)

// ---------------------------------------------------------------- background

export function BackgroundStep({ s, d, set }: StepProps) {
  const bg = d.bg
  const data = options(backgrounds, (b) => b.id, (b) => nameOf(b))
  const featName = bg
    ? nameOf(byId.feat[bg.feat.id]) + (bg.feat.spell_list ? ` (${ruName('classes', bg.feat.spell_list)})` : '')
    : ''
  return (
    <Stack>
      <Pick
        label='Предыстория'
        data={data}
        value={s.background.backgroundId}
        onChange={(v) => set('background', { backgroundId: v, toolChoice: [] })}
      />
      {bg && (
        <SimpleGrid cols={2}>
          <Fixed
            label='Характеристики для увеличения'
            value={bg.ability_scores.map(abilityName)}
            description='Распределите на шаге «Характеристики»'
          />
          <Fixed label='Черта происхождения' value={featName} />
          <Fixed label='Навыки' value={bg.skill_proficiencies.map(skillName)} />
          {bg.tool_proficiencies.fixed.length > 0 && (
            <Fixed label='Инструмент' value={bg.tool_proficiencies.fixed.map((id) => nameOf(byId.item[id]))} />
          )}
          {bg.tool_proficiencies.choose.map((g, i) => {
            const cat = g.from_categories?.[0] || ''
            return (
              <Pick
                key={i}
                label={'Инструмент: ' + nameOf(byId.category[cat]).toLowerCase()}
                data={options(categoryItems(cat), (x) => x.id, (x) => nameOf(x))}
                value={s.background.toolChoice[0] ?? null}
                onChange={(v) => set('background', { toolChoice: v ? [v] : [] })}
              />
            )
          })}
        </SimpleGrid>
      )}
    </Stack>
  )
}

export function backgroundValid(s: WizardState, d: Derived) {
  if (!d.bg) return false
  const need = d.bg.tool_proficiencies.choose.reduce((n, g) => n + g.count, 0)
  return s.background.toolChoice.length === need
}

// ---------------------------------------------------------------- species

function speciesChoices(d: Derived) {
  const ch = d.sp?.choices || []
  return {
    option: ch.find((c) => c.type === 'species-option'),
    size: ch.find((c) => c.type === 'size'),
    skill: ch.find((c) => c.type === 'skill'),
    tool: ch.find((c) => c.type === 'tool'),
    skillOrTool: ch.find((c) => c.type === 'skill-or-tool'),
    feat: ch.find((c) => c.type === 'feat'),
    ability: ch.find((c) => c.type === 'ability'),
    resistance: ch.find((c) => c.type === 'resistance')
  }
}

// species in Russian alphabetical order, as on dnd.su
const speciesSorted = [...speciesList].sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'ru'))

const EMPTY_SPECIES: Omit<WizardState['species'], 'speciesId'> = {
  optionId: null, size: null, skills: [], tool: null, feat: null, spellAbility: null, resistance: null
}

export function SpeciesStep({ s, d, set }: StepProps) {
  const sp = d.sp
  const ch = speciesChoices(d)
  const optionData = ch.option
    ? options(speciesOptions.filter((o) => o.group === ch.option!.options_group), (o) => o.id, (o) => nameOf(o))
    : []
  const sizeData = d.sizeOptions.map((id) => ({ value: id, label: ruName('sizes', id) }))
  // what the background already gives is not offered again
  const bgSkills = new Set(d.bg?.skill_proficiencies || [])
  const bgTools = new Set([...(d.bg?.tool_proficiencies.fixed || []), ...s.background.toolChoice])
  const skillPool = ch.skill
    ? (ch.skill.from === 'any' || !ch.skill.from ? skills.map((x) => x.id) : ch.skill.from).filter((id) => !bgSkills.has(id))
    : []
  const toolPool = toolItems.filter((t) => !bgTools.has(t.id))
  const skillOrToolData = [
    { group: 'Навыки', items: skills.filter((x) => !bgSkills.has(x.id)).map((x) => ({ value: 'skill:' + x.id, label: nameOf(x) })) },
    { group: 'Инструменты', items: toolPool.map((x) => ({ value: 'tool:' + x.id, label: nameOf(x) })) }
  ]
  const skillOrTool = s.species.skills[0] ? 'skill:' + s.species.skills[0] : s.species.tool ? 'tool:' + s.species.tool : null
  const bgFeat = d.bg?.feat.id
  const featData = options(
    originFeats.filter((f) => f.id !== bgFeat || f.repeatable),
    (f) => f.id,
    (f) => nameOf(f)
  )
  const patch = (p: Partial<WizardState['species']>) => set('species', p)

  return (
    <Stack>
      <Pick
        label='Вид'
        data={options(speciesSorted, (x) => x.id, (x) => nameOf(x))}
        value={s.species.speciesId}
        onChange={(v) => set('species', { speciesId: v, ...EMPTY_SPECIES })}
      />
      {sp && (
        <SimpleGrid cols={2}>
          <Pick
            label='Вариант вида'
            data={optionData}
            value={s.species.optionId}
            onChange={(v) => patch({ optionId: v })}
            disabled={!ch.option}
            placeholder={ch.option ? 'Выберите' : 'Нет вариантов'}
          />
          <Pick
            label='Размер'
            data={sizeData}
            value={d.size}
            onChange={(v) => patch({ size: v })}
            disabled={sizeData.length < 2}
          />
          {ch.skill && (
            <PickMany
              label={ch.skill.count > 1 ? 'Навыки' : 'Навык'}
              data={options(skillPool, (id) => id, skillName)}
              max={ch.skill.count}
              value={s.species.skills}
              onChange={(v) => patch({ skills: v })}
            />
          )}
          {ch.tool && (
            <Pick
              label='Инструмент'
              data={options(toolPool, (t) => t.id, (t) => nameOf(t))}
              value={s.species.tool}
              onChange={(v) => patch({ tool: v })}
            />
          )}
          {ch.skillOrTool && (
            <Pick
              label='Навык или инструмент'
              data={skillOrToolData}
              value={skillOrTool}
              onChange={(v) =>
                patch(v?.startsWith('skill:') ? { skills: [v.slice(6)], tool: null } : { skills: [], tool: v ? v.slice(5) : null })
              }
            />
          )}
          {ch.resistance && (
            <Pick
              label='Сопротивление'
              data={(ch.resistance.from as string[]).map((id) => ({ value: id, label: ruName('damage_types', id) }))}
              value={s.species.resistance}
              onChange={(v) => patch({ resistance: v })}
            />
          )}
          {ch.feat && (
            <Pick
              label='Черта происхождения'
              data={featData}
              value={s.species.feat}
              onChange={(v) => patch({ feat: v })}
            />
          )}
          {ch.ability && (
            <Pick
              label='Заклинательная характеристика вида'
              data={(['int', 'wis', 'cha'] as const).map((a) => ({ value: a, label: abilityName(a) }))}
              value={s.species.spellAbility}
              onChange={(v) => patch({ spellAbility: v as WizardState['species']['spellAbility'] })}
            />
          )}
          {sp.creature_type !== 'humanoid' && <Fixed label='Тип существа' value={ruName('creature_types', sp.creature_type)} />}
          <Fixed label='Скорость' value={d.speed + ' фт'} />
          <Fixed label='Тёмное зрение' value={d.darkvision ? d.darkvision + ' фт' : 'Нет'} />
          <Fixed
            label='Сопротивления'
            value={d.resistances.length ? d.resistances.map((id) => ruName('damage_types', id)) : 'Нет'}
          />
        </SimpleGrid>
      )}
    </Stack>
  )
}

export function speciesValid(s: WizardState, d: Derived) {
  if (!d.sp) return false
  const ch = speciesChoices(d)
  return Boolean(
    (!ch.option || s.species.optionId) &&
      d.size &&
      (!ch.skill || s.species.skills.length === ch.skill.count) &&
      (!ch.tool || s.species.tool) &&
      (!ch.skillOrTool || s.species.skills.length || s.species.tool) &&
      (!ch.resistance || s.species.resistance) &&
      (!ch.feat || s.species.feat) &&
      (!ch.ability || s.species.spellAbility)
  )
}
