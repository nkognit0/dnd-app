// The wiki on the right of the sheet: a card for the spell, weapon, armor, tool or item
// clicked in the sheet. Every spell (cantrips too) uses one card with fixed fields.
import { Anchor, Group, Stack, Text, Title, UnstyledButton } from '@mantine/core'
import type { ReactNode } from 'react'
import { abilityName, byId, nameOf, ruName } from '../data'
import type { ArmorData, EquipmentData, SpellData, WeaponData } from '../data'
import { price } from '../wizard/steps/common'
import type { WikiRef } from './lookup'
import {
  ARMOR_TYPE_RU, FOCUS_RU, ITEM_CATEGORY_RU, MASTERY_RU, PROPERTY_RU, TOOL_TYPE_RU, areaOf, castingTime, count, dice, donTime,
  duration, range, spellDamage, utilize
} from './ru'

const SOURCE_RU: Record<string, string> = {
  'srd-5.2.1': 'SRD 5.2.1', 'phb-2024': 'Книга игрока 2024', efota: 'Eberron: Forge of the Artificer', rthw: 'Ravenloft: The Horrors Within'
}

const damageName = (id: string) => ruName('damage_types', id).toLowerCase()
const weight = (lb: number | null | undefined) => (lb ? count(lb, 'pound') : '—')
const yesNo = (v: boolean) => (v ? 'да' : 'нет')

function Field(props: { label: string; children: ReactNode }) {
  return (
    <div className='wiki-field'>
      <Text size='xs' c='dimmed'>{props.label}</Text>
      <Text size='sm'>{props.children}</Text>
    </div>
  )
}

function Header(props: { title: string; subtitle: string; tag: string }) {
  return (
    <Stack gap={2}>
      <Title order={3}>{props.title}</Title>
      <Text size='sm' c='dimmed'>{props.subtitle}{props.tag ? ' · ' + props.tag : ''}</Text>
    </Stack>
  )
}

// SRD text is kept in English for now; non-SRD records have mechanics only
function Description(props: { text?: string | null; source: string }) {
  if (!props.text) {
    return (
      <Text size='sm' c='dimmed'>
        Текста описания нет: это не SRD ({SOURCE_RU[props.source] || props.source}), в базе только механика.
      </Text>
    )
  }
  return (
    <Stack gap={6}>
      <Text size='xs' c='dimmed'>Описание (SRD 5.2.1, на английском)</Text>
      {props.text.split(/\n+/).map((p, i) => <Text key={i} size='sm' className='wiki-text'>{p.trim()}</Text>)}
    </Stack>
  )
}

function SpellCard({ s }: { s: SpellData }) {
  const c = s.components
  const comps = [c.verbal && 'В', c.somatic && 'С', c.material && 'М'].filter(Boolean).join(', ')
  const check = s.save ? `Спасбросок: ${abilityName(s.save)}` : s.attack_type ? `Бросок атаки (${s.attack_type === 'melee' ? 'рукопашная' : 'дальнобойная'})` : '—'
  return (
    <Stack gap='md'>
      <Header title={nameOf(s)} subtitle={s.name} tag={s.level === 0 ? 'Заговор' : `${s.level} круг`} />
      <div className='wiki-grid'>
        <Field label='Круг'>{s.level === 0 ? 'Заговор' : `${s.level}`}</Field>
        <Field label='Школа'>{ruName('magic_schools', s.school)}</Field>
        <Field label='Время накладывания'>{castingTime(s.casting_time)}</Field>
        <Field label='Дистанция'>{range(s.range)}</Field>
        <Field label='Область'>{areaOf(s.description) ?? '—'}</Field>
        <Field label='Длительность'>{duration(s.duration)}</Field>
        <Field label='Концентрация'>{yesNo(s.concentration)}</Field>
        <Field label='Ритуал'>{yesNo(s.ritual)}</Field>
        <Field label='Компоненты'>{comps || '—'}</Field>
        <Field label='Урон'>{spellDamage(s)}</Field>
        <Field label='Спасбросок или атака'>{check}</Field>
        <Field label='Источник'>{SOURCE_RU[s.source || ''] || s.source}</Field>
      </div>
      {c.material_text && <Field label='Материальный компонент (англ.)'>{c.material_text}</Field>}
      <Field label='Классы'>{s.classes.map((id) => ruName('classes', id)).join(', ') || '—'}</Field>
      <Description text={[s.description, s.higher_level].filter(Boolean).join('\n')} source={s.source || ''} />
    </Stack>
  )
}

function WeaponCard({ w, item }: { w: WeaponData; item?: EquipmentData }) {
  const kind = `${w.category === 'simple' ? 'Простое' : 'Воинское'} ${w.type === 'melee' ? 'рукопашное' : 'дальнобойное'} оружие`
  const pd = w.property_details
  const detail = (p: string) => {
    if (p === 'versatile' && pd.versatile) return ` (двумя руками ${dice(pd.versatile.damage_dice)})`
    const r = p === 'ammunition' ? pd.ammunition : p === 'thrown' ? pd.thrown : undefined
    return r ? ` (дистанция ${r.range_normal}/${r.range_long} фт)` : ''
  }
  return (
    <Stack gap='md'>
      <Header title={nameOf(w)} subtitle={w.name} tag={kind} />
      <div className='wiki-grid'>
        <Field label='Урон'>{`${dice(w.damage_dice)} ${damageName(w.damage_type)}`}</Field>
        <Field label='Мастерство'>{ruName('weapon_masteries', w.mastery)}</Field>
        <Field label='Цена'>{price(w.cost)}</Field>
        <Field label='Вес'>{weight(w.weight_lb)}</Field>
      </div>
      <Stack gap={6}>
        <Text size='xs' c='dimmed'>Свойства</Text>
        {w.properties.length ? w.properties.map((p) => (
          <Text key={p} size='sm'><b>{ruName('weapon_properties', p)}{detail(p)}.</b> {PROPERTY_RU[p] || ''}</Text>
        )) : <Text size='sm'>Нет</Text>}
      </Stack>
      <Stack gap={6}>
        <Text size='xs' c='dimmed'>Приём мастерства</Text>
        <Text size='sm'><b>{ruName('weapon_masteries', w.mastery)}.</b> {MASTERY_RU[w.mastery] || ''}</Text>
      </Stack>
      {item?.description && <Description text={item.description} source={w.source || ''} />}
    </Stack>
  )
}

function ArmorCard({ a }: { a: ArmorData }) {
  const ac = a.armor_class
  const acText = a.type === 'shield'
    ? `+${ac.bonus ?? 2}`
    : `${ac.base}${ac.add_dex ? ' + мод. Ловкости' + (ac.dex_max != null ? ` (макс. ${ac.dex_max})` : '') : ''}`
  return (
    <Stack gap='md'>
      <Header title={nameOf(a)} subtitle={a.name} tag={ARMOR_TYPE_RU[a.type]} />
      <div className='wiki-grid'>
        <Field label='Класс доспеха'>{acText}</Field>
        <Field label='Сила'>{a.strength_requirement ? `не меньше ${a.strength_requirement}, иначе скорость −10 фт` : '—'}</Field>
        <Field label='Скрытность'>{a.stealth_disadvantage ? 'помеха' : '—'}</Field>
        <Field label='Надеть / снять'>{`${donTime(a.don_time)} / ${donTime(a.doff_time)}`}</Field>
        <Field label='Цена'>{price(a.cost)}</Field>
        <Field label='Вес'>{weight(a.weight_lb)}</Field>
      </div>
    </Stack>
  )
}

function ItemLinks(props: { list: { item: string; qty?: number }[]; open: (r: WikiRef) => void }) {
  return (
    <Text size='sm'>
      {props.list.map((x, i) => {
        const it = byId.item[x.item]
        const kind = byId.weapon[x.item] ? 'weapon' : byId.armor[x.item] ? 'armor' : it?.category === 'tool' ? 'tool' : 'item'
        return (
          <span key={x.item}>
            {i > 0 && ', '}
            <Anchor component='button' size='sm' onClick={() => props.open({ kind, id: x.item })}>{nameOf(it) || x.item}</Anchor>
            {x.qty && x.qty > 1 ? ` ×${x.qty}` : ''}
          </span>
        )
      })}
    </Text>
  )
}

function ToolCard({ t, open }: { t: EquipmentData; open: (r: WikiRef) => void }) {
  const tool = t.tool
  return (
    <Stack gap='md'>
      <Header title={nameOf(t)} subtitle={t.name} tag={TOOL_TYPE_RU[tool?.type || ''] || 'Инструменты'} />
      <div className='wiki-grid'>
        <Field label='Характеристика'>{tool ? abilityName(tool.ability) : '—'}</Field>
        <Field label='Цена'>{price(t.cost)}</Field>
        <Field label='Вес'>{weight(t.weight_lb)}</Field>
      </div>
      <Field label='Использование'>{tool ? utilize(tool.utilize) : '—'}</Field>
      {tool && tool.craft.length > 0 && (
        <Stack gap={4}>
          <Text size='xs' c='dimmed'>Можно изготовить</Text>
          <ItemLinks list={tool.craft} open={open} />
        </Stack>
      )}
      {t.description && <Description text={t.description} source={t.source || ''} />}
    </Stack>
  )
}

function ItemCard({ it, open }: { it: EquipmentData; open: (r: WikiRef) => void }) {
  const cat = it.category === 'focus' ? FOCUS_RU[it.subcategory || ''] || ITEM_CATEGORY_RU.focus : ITEM_CATEGORY_RU[it.category] || it.category
  return (
    <Stack gap='md'>
      <Header title={nameOf(it)} subtitle={it.name} tag={cat} />
      <div className='wiki-grid'>
        <Field label='Цена'>{price(it.cost)}</Field>
        <Field label='Вес'>{weight(it.weight_lb)}</Field>
        {it.ammunition && <Field label='Продаётся связкой'>{`${it.ammunition.bundle_size} шт.`}</Field>}
      </div>
      {it.pack && (
        <Stack gap={4}>
          <Text size='xs' c='dimmed'>Содержимое</Text>
          <ItemLinks list={it.pack.contents} open={open} />
        </Stack>
      )}
      <Description text={it.description} source={it.source || ''} />
    </Stack>
  )
}

export function WikiCard({ r, open }: { r: WikiRef; open: (r: WikiRef) => void }) {
  if (r.kind === 'spell' && byId.spell[r.id]) return <SpellCard s={byId.spell[r.id]} />
  if (r.kind === 'weapon' && byId.weapon[r.id]) return <WeaponCard w={byId.weapon[r.id]} item={byId.item[r.id]} />
  if (r.kind === 'armor' && byId.armor[r.id]) return <ArmorCard a={byId.armor[r.id]} />
  if (r.kind === 'tool' && byId.item[r.id]) return <ToolCard t={byId.item[r.id]} open={open} />
  if (byId.item[r.id]) return <ItemCard it={byId.item[r.id]} open={open} />
  return <Text size='sm'>Не найдено в базе.</Text>
}

export function WikiPanel(props: { history: WikiRef[]; open: (r: WikiRef) => void; back: () => void; close: () => void; extra?: ReactNode }) {
  const current = props.history[props.history.length - 1]
  return (
    <div className='wiki-card'>
        <Group justify='space-between' mb={current ? 'sm' : 0} wrap='nowrap'>
          <Text size='xs' c='dimmed' fw={600} tt='uppercase'>Справочник</Text>
          <Group gap='xs'>
            {props.history.length > 1 && <Anchor component='button' size='xs' onClick={props.back}>← Назад</Anchor>}
            {current && (
              <UnstyledButton className='wiki-close' onClick={props.close} aria-label='Закрыть' title='Закрыть'>×</UnstyledButton>
            )}
          </Group>
        </Group>
        {props.extra}
        {current ? (
          <WikiCard r={current} open={props.open} />
        ) : (
          <Text size='sm' c='dimmed' mt='sm'>
            Нажмите на синее название в листе — заклинание, заговор, оружие, доспех, предмет или инструмент, — и здесь появятся его характеристики.
          </Text>
        )}
    </div>
  )
}
