// Step 10: starting equipment options, choices inside them and purchases.
import { Alert, SimpleGrid, Stack, Text } from '@mantine/core'
import { byId, categoryItems, equipment, nameOf } from '../../data'
import type { EquipItemRef, EquipOption } from '../../data'
import { bgEquipOption, classEquipOption, purchasesCp, startingGoldCp } from '../../rules/derive'
import type { Derived } from '../../rules/derive'
import type { WizardState } from '../state'
import { Fixed, Pick, PickMany, options } from '../fields'
import { StepProps, moneyCp, price } from './common'

const catName = (id: string) => nameOf(byId.category[id])

function refLabel(ref: EquipItemRef): string {
  if (ref.item) return nameOf(byId.item[ref.item]) + (ref.qty > 1 ? ` ×${ref.qty}` : '')
  const cats = ref.categories || (ref.category ? [ref.category] : [])
  const what = cats.map(catName).join(' или ')
  return ref.same_as ? `${what} (как во владении)` : `${what} (на выбор)`
}

function optionLabel(opt: EquipOption): string {
  const parts = (opt.items || []).map(refLabel)
  if (opt.gp) parts.push(`${opt.gp} зм`)
  return `Вариант ${opt.id}: ${parts.join(', ')}`
}

function sameAsTool(src: 'class' | 'bg', s: WizardState) {
  return src === 'class' ? s.skills.classTools[0] : s.background.toolChoice[0]
}

// positions of an option that need a choice ("Musical Instrument of your choice", "Holy Symbol")
function choicePositions(opt: EquipOption | undefined) {
  return (opt?.items || []).map((ref, i) => ({ ref, i })).filter(({ ref }) => !ref.item && !ref.same_as)
}

function OptionChoices({ src, opt, s, set }: { src: 'class' | 'bg'; opt: EquipOption | undefined; s: WizardState; set: StepProps['set'] }) {
  if (!opt) return null
  return (
    <>
      {(opt.items || []).map((ref, i) => {
        const key = src + ':' + i
        if (ref.same_as) {
          const tool = sameAsTool(src, s)
          return <Fixed key={key} label={refLabel(ref)} value={tool ? nameOf(byId.item[tool]) : '—'} />
        }
        if (ref.item) return null
        const cats = ref.categories || (ref.category ? [ref.category] : [])
        const pool = cats.flatMap((c) => categoryItems(c))
        return (
          <Pick
            key={key}
            label={cats.map(catName).join(' или ')}
            data={options(pool, (x) => x.id, (x) => `${nameOf(x)} — ${price(x.cost)}`)}
            value={s.equipment.picks[key] ?? null}
            onChange={(v) => set('equipment', { picks: { ...s.equipment.picks, [key]: v } })}
          />
        )
      })}
    </>
  )
}

const buyable = equipment.filter((x) => x.cost_cp != null && x.cost_cp > 0)

export function EquipmentStep({ s, d, set }: StepProps) {
  const e = s.equipment
  const clsOpt = classEquipOption(d, s)
  const bgOpt = bgEquipOption(d, s)
  const gold = startingGoldCp(d, s)
  const spent = purchasesCp(s)
  const left = gold - spent
  return (
    <Stack>
      <Pick
        label={'Снаряжение класса «' + nameOf(d.cls) + '»'}
        data={(d.cls?.starting_equipment.options || []).map((o) => ({ value: o.id, label: optionLabel(o) }))}
        value={e.classOption}
        onChange={(v) => set('equipment', { classOption: v, picks: dropPicks(e.picks, 'class:') })}
      />
      <Pick
        label={'Снаряжение предыстории «' + nameOf(d.bg) + '»'}
        data={(d.bg?.starting_equipment.options || []).map((o) => ({ value: o.id, label: optionLabel(o) }))}
        value={e.bgOption}
        onChange={(v) => set('equipment', { bgOption: v, picks: dropPicks(e.picks, 'bg:') })}
      />
      <SimpleGrid cols={2}>
        <OptionChoices src='class' opt={clsOpt} s={s} set={set} />
        <OptionChoices src='bg' opt={bgOpt} s={s} set={set} />
      </SimpleGrid>
      {e.classOption && e.bgOption && (
        <>
          <PickMany
            label='Покупки на оставшееся золото'
            description={`Золото: ${moneyCp(gold)}. Потрачено: ${moneyCp(spent)}. Осталось: ${moneyCp(left)}.`}
            data={buyable.map((x) => ({ value: x.id, label: `${nameOf(x)} — ${price(x.cost)}` }))}
            max={99}
            value={e.purchases}
            onChange={(v) => set('equipment', { purchases: v })}
          />
          {left < 0 && (
            <Alert color='red' variant='light'>
              Не хватает {moneyCp(-left)}: уберите часть покупок.
            </Alert>
          )}
          <Text size='xs' c='dimmed'>
            Каждый предмет покупается один раз; боеприпасы — связкой (например, 20 стрел).
          </Text>
        </>
      )}
    </Stack>
  )
}

function dropPicks(picks: Record<string, string | null>, prefix: string) {
  return Object.fromEntries(Object.entries(picks).filter(([k]) => !k.startsWith(prefix)))
}

export function equipmentValid(s: WizardState, d: Derived) {
  const e = s.equipment
  if (!e.classOption || !e.bgOption) return false
  const clsOpt = classEquipOption(d, s)
  const bgOpt = bgEquipOption(d, s)
  const picksDone =
    choicePositions(clsOpt).every(({ i }) => e.picks['class:' + i]) &&
    choicePositions(bgOpt).every(({ i }) => e.picks['bg:' + i])
  return picksDone && startingGoldCp(d, s) - purchasesCp(s) >= 0
}
