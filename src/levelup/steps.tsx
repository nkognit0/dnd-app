// Steps of the level-up wizard.
import { Alert, Anchor, Button, Group, List, Paper, SegmentedControl, Stack, Text, Title } from '@mantine/core'
import { byId, classFeatures, nameOf, subclasses } from '../data'
import { rollDie } from '../rules/dice'
import { signed } from '../rules/derive'
import { Fixed, Pick, PickMany } from '../wizard/fields'
import {
  ChoiceDef, LevelPicks, classFeaturesAt, featChoices, featOptions, featStepKind, featureChoices, grantText, hpGain,
  nextLevel, speciesGainsAt, speciesLineageMissing, spellChoices, spellPlan, subclassFeaturesAt, subclassOf
} from './plan'
import { SPECIES_TRAIT_RU } from './apply'
import type { SheetInfo } from './read'

export type StepId = 'hp' | 'subclass' | 'feat' | 'features' | 'spells' | 'summary'

export interface LevelStepProps {
  info: SheetInfo
  picks: LevelPicks
  // a change of the step's own value (hit points, subclass, feat)
  update: (patch: Partial<LevelPicks>) => void
  // a change of one listed choice
  choose: (key: string, values: string[]) => void
}

const dndsuClass = (info: SheetInfo) => `https://next.dnd.su/class/${info.cls.id}/`

// One choice: a single value is a dropdown, several are a multi-select; optional ones can be cleared.
export function ChoiceField({ def, value, onChange }: { def: ChoiceDef; value: string[]; onChange: (v: string[]) => void }) {
  if (!def.options.length) {
    return <Fixed label={def.label} value='Нет доступных вариантов' description={def.description} />
  }
  if (def.count === 1) {
    return (
      <Pick
        label={def.label}
        description={def.description}
        data={def.options}
        value={value[0] ?? null}
        onChange={(v) => onChange(v ? [v] : [])}
        clearable={def.optional}
      />
    )
  }
  return <PickMany label={def.label} description={def.description} data={def.options} value={value} max={def.count} onChange={onChange} />
}

function ChoiceList({ defs, picks, choose }: { defs: ChoiceDef[]; picks: LevelPicks; choose: LevelStepProps['choose'] }) {
  const groups = [...new Set(defs.map((d) => d.source))]
  return (
    <Stack>
      {groups.map((g) => (
        <Paper key={g} withBorder p='md' radius='md'>
          <Title order={5} mb='xs'>{g}</Title>
          <Stack gap='sm'>
            {defs.filter((d) => d.source === g).map((d) => (
              <ChoiceField key={d.key} def={d} value={picks.choices[d.key] || []} onChange={(v) => choose(d.key, v)} />
            ))}
          </Stack>
        </Paper>
      ))}
    </Stack>
  )
}

// ---------------------------------------------------------------- hit points

export function HpStep({ info, picks, update }: LevelStepProps) {
  const hd = info.cls.hit_die
  const fixed = info.cls.hit_points.per_level.fixed
  const gain = hpGain(info, picks)
  return (
    <Stack>
      <Text size='sm'>
        За каждый уровень после первого максимум хитов растёт на бросок кости хитов класса или на её среднее значение
        (по выбору), плюс модификатор Телосложения. Кость хитов: к{hd}.
      </Text>
      <SegmentedControl
        value={picks.hp.method ?? ''}
        onChange={(v) => update({ hp: { method: v as 'fixed' | 'roll', roll: v === 'roll' ? picks.hp.roll : null } })}
        data={[{ value: 'fixed', label: `Среднее: ${fixed}` }, { value: 'roll', label: `Бросок к${hd}` }]}
      />
      {picks.hp.method === 'roll' && (
        <Group>
          <Button onClick={() => update({ hp: { method: 'roll', roll: rollDie(hd) } })}>
            {picks.hp.roll == null ? `Бросить к${hd}` : `Перебросить к${hd}`}
          </Button>
          {picks.hp.roll != null && <Text fw={700} size='xl'>{picks.hp.roll}</Text>}
        </Group>
      )}
      {gain && (
        <Paper withBorder p='md' radius='md'>
          <Text size='sm'>
            {gain.base} {signed(gain.con)} (Телосложение)
            {gain.extras.map((e) => ` ${signed(e.value)} (${e.label})`).join('')}
          </Text>
          <Text fw={700} mt={4}>
            Хитов: +{gain.total}, максимум {info.maxHp} → {info.maxHp + gain.total}
          </Text>
          <Text size='xs' c='dimmed' mt={4}>
            Если на этом уровне вырастет Телосложение, итог пересчитается на шаге «Итог».
          </Text>
        </Paper>
      )}
    </Stack>
  )
}

// ---------------------------------------------------------------- subclass

export function SubclassStep({ info, picks, update }: LevelStepProps) {
  const own = subclasses.filter((s) => s.class === info.cls.id)
  const sub = subclassOf(info, picks)
  return (
    <Stack>
      <Pick
        label='Подкласс'
        data={own.map((s) => ({ value: s.id, label: nameOf(s) }))}
        value={picks.subclass}
        onChange={(v) => update({ subclass: v })}
      />
      {sub && (
        <Paper withBorder p='md' radius='md'>
          <Text size='sm' fw={600} mb={4}>Умения подкласса по уровням</Text>
          <List size='sm' spacing={2}>
            {sub.features.map((f) => (
              <List.Item key={f.id}>{f.level}-й: {nameOf(f as never)}</List.Item>
            ))}
          </List>
          <Anchor href={sub.link} target='_blank' size='sm' mt='xs' display='block'>Описание подкласса на dnd.su</Anchor>
        </Paper>
      )}
    </Stack>
  )
}

// ---------------------------------------------------------------- feat

export function FeatStep({ info, picks, update, choose }: LevelStepProps) {
  const kind = featStepKind(info)!
  const f = picks.feat ? byId.feat[picks.feat] : null
  const defs = featChoices(info, picks)
  return (
    <Stack>
      <Text size='sm'>
        {kind === 'epic-boon'
          ? 'Эпический дар или другая черта, требованиям которой персонаж соответствует.'
          : 'Черта «Увеличение характеристик» или другая черта, требованиям которой персонаж соответствует.'}{' '}
        В списке только доступные по требованиям черты; уже взятые неповторяемые черты не показаны.
      </Text>
      <Pick label={kind === 'epic-boon' ? 'Эпический дар или черта' : 'Черта'} data={featOptions(info, picks, kind)} value={picks.feat}
        onChange={(v) => update({ feat: v })} />
      {f?.link && <Anchor href={f.link} target='_blank' size='sm'>Описание черты на dnd.su</Anchor>}
      {defs.length > 0 && <ChoiceList defs={defs} picks={picks} choose={choose} />}
    </Stack>
  )
}

// ---------------------------------------------------------------- features

export function FeaturesStep({ info, picks, choose }: LevelStepProps) {
  const level = nextLevel(info)
  const sub = subclassOf(info, picks)
  const gained = classFeaturesAt(info, level).filter((f) => f.feature !== 'ability-score-improvement' && f.feature !== 'epic-boon')
  const subGained = subclassFeaturesAt(sub, level)
  const species = speciesGainsAt(info, level)
  const defs = featureChoices(info, picks)
  const grants = grantText(info, picks)
  const unsupported = (info.cls.level_up_unsupported || []).filter((u) => u.level === level)
  const nothing = !gained.length && !subGained.length && !species.traits.length && !species.lineageSpells.length
  return (
    <Stack>
      {speciesLineageMissing(info) && (
        <Alert color='red' variant='light'>
          В поле «Вид» не указан вариант вида (родословная, наследие), например «{nameOf(info.species)} (…)».
          От него зависят заклинания, которые персонаж получает на этом уровне. Исправьте лист и откройте визард снова.
        </Alert>
      )}
      {nothing ? (
        <Text size='sm'>На этом уровне новых умений нет.</Text>
      ) : (
        <Paper withBorder p='md' radius='md'>
          <Text size='sm' fw={600} mb={4}>Новые умения</Text>
          <List size='sm' spacing={2}>
            {gained.map((f) => <List.Item key={f.id}>{nameOf(f)}</List.Item>)}
            {subGained.map((f) => <List.Item key={f.id}>{nameOf(f as never)} <Text span size='xs' c='dimmed'>({nameOf(sub)})</Text></List.Item>)}
            {species.traits.map((t) => <List.Item key={t.id}>{SPECIES_TRAIT_RU[t.id] || t.name} <Text span size='xs' c='dimmed'>(вид)</Text></List.Item>)}
            {species.lineageSpells.map((id) => <List.Item key={id}>{nameOf(byId.spell[id])} <Text span size='xs' c='dimmed'>(заклинание вида)</Text></List.Item>)}
          </List>
          <Anchor href={sub?.link || dndsuClass(info)} target='_blank' size='sm' mt='xs' display='block'>Описание умений на dnd.su</Anchor>
        </Paper>
      )}
      {grants.map((g) => (
        <Fixed key={g.source + g.text} label={g.source} value={g.text} />
      ))}
      {unsupported.map((u) => (
        <Alert key={u.feature} color='yellow' variant='light'>
          {nameOf(classFeatures.find((f) => f.class === info.cls.id && f.feature === u.feature))}: в базе нет нужных данных
          (блоков статистики зверей) — впишите известные облики в лист вручную.
        </Alert>
      ))}
      {defs.length > 0 && <ChoiceList defs={defs} picks={picks} choose={choose} />}
    </Stack>
  )
}

// ---------------------------------------------------------------- spells

export function SpellsStep({ info, picks, choose }: LevelStepProps) {
  const plan = spellPlan(info, picks)
  const defs = spellChoices(info, picks)
  return (
    <Stack>
      {plan?.list && (
        <Text size='sm'>
          Доступные круги заклинаний: до {plan.maxLevel}-го.
          {plan.cantripSwap || plan.preparedSwap ? ' На этом уровне можно заменить одно известное заклинание.' : ''}
        </Text>
      )}
      {plan && plan.automatic.length > 0 && (
        <Fixed label='Всегда подготовлены (без выбора)' value={plan.automatic.map((a) => nameOf(byId.spell[a.id]) + (a.tag ? ` (${a.tag})` : ''))} />
      )}
      {defs.length > 0 && <ChoiceList defs={defs} picks={picks} choose={choose} />}
    </Stack>
  )
}

// ---------------------------------------------------------------- summary

export function SummaryStep({ summary, warnings }: { summary: string[]; warnings: string[] }) {
  return (
    <Stack>
      {warnings.map((w) => <Alert key={w} color='yellow' variant='light'>{w}</Alert>)}
      <Paper withBorder p='md' radius='md'>
        <List size='sm' spacing={4}>
          {summary.map((s) => <List.Item key={s}>{s}</List.Item>)}
        </List>
      </Paper>
      <Text size='xs' c='dimmed'>
        Числа, которые зависят от уровня и характеристик (спасброски, навыки, атаки, Сл и ячейки заклинаний), будут пересчитаны;
        всё, что вписано в лист вручную, останется. Описания умений в лист не переносятся — только названия и выборы.
      </Text>
    </Stack>
  )
}
