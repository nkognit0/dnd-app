// Steps 1-3: class, background, species.
import { SimpleGrid, Stack } from '@mantine/core'
import {
  abilityName, backgrounds, byId, categoryItems, classes, nameOf, originFeats, ruName, skills, speciesOptions,
  species as speciesList
} from '../../data'
import type { WizardState } from '../state'
import type { Derived } from '../../rules/derive'
import { Fixed, Pick, options } from '../fields'
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
    feat: ch.find((c) => c.type === 'feat'),
    ability: ch.find((c) => c.type === 'ability')
  }
}

export function SpeciesStep({ s, d, set }: StepProps) {
  const sp = d.sp
  const ch = speciesChoices(d)
  const optionData = ch.option
    ? options(speciesOptions.filter((o) => o.group === ch.option!.options_group), (o) => o.id, (o) => nameOf(o))
    : []
  const sizeData = d.sizeOptions.map((id) => ({ value: id, label: ruName('sizes', id) }))
  const bgSkills = new Set(d.bg?.skill_proficiencies || [])
  const skillPool = ch.skill
    ? (ch.skill.from === 'any' || !ch.skill.from ? skills.map((x) => x.id) : ch.skill.from).filter((id) => !bgSkills.has(id))
    : []
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
        data={options(speciesList, (x) => x.id, (x) => nameOf(x))}
        value={s.species.speciesId}
        onChange={(v) =>
          set('species', { speciesId: v, optionId: null, size: null, skill: null, feat: null, spellAbility: null })
        }
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
            <Pick
              label='Навык'
              data={options(skillPool, (id) => id, skillName)}
              value={s.species.skill}
              onChange={(v) => patch({ skill: v })}
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
      (!ch.skill || s.species.skill) &&
      (!ch.feat || s.species.feat) &&
      (!ch.ability || s.species.spellAbility)
  )
}
