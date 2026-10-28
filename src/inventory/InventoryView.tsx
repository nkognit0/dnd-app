// The inventory tab: the money of the sheet, the item search with "get" and "buy", the hero with
// what it wears and holds, and the grid of 72 cells, one thing per cell (8 columns, 4 on a
// phone). Things are dragged between cells and onto the hero: with the mouse at once, on a touch
// screen after holding a finger on the thing.
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button, Text, TextInput } from '@mantine/core'
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import type { DnDCharacter } from 'dnd-sheet'
import { Currency, labels as L } from 'dnd-sheet'
import { nameOf, species } from '../data'
import type { EquipmentData } from '../data'
import { price } from '../wizard/steps/common'
import { Icon } from '../icons'
import { norm } from '../wiki/lookup'
import { COINS, Slot, addItem, iconUrl, pay, searchItems, slotName, totalCp, unitQty, walletFields, walletOf } from './inventory'
import { withBag } from './sync'
import { Place, WornPlace, accepts, at, bagOf, move, twoHanded } from './worn'
import { HeroFigure } from './HeroFigure'

const placeId = (p: Place) => String(p)
const placeOf = (id: string | number): Place => (/^\d+$/.test(String(id)) ? Number(id) : (String(id) as WornPlace))

function Cell(props: {
  place: Place
  slot: Slot | null
  // what is being dragged: the cell shows whether it may go here
  dragging: Slot | null
  selected: boolean
  onOpen: (p: Place) => void
  // an empty place on the hero: its name, and the two-handed weapon that takes this hand
  label?: string
  blockedBy?: Slot | null
}) {
  const id = placeId(props.place)
  const drag = useDraggable({ id, disabled: !props.slot })
  const drop = useDroppable({ id })
  const s = props.slot
  const refused = drop.isOver && props.dragging && !accepts(props.place, props.dragging)
  const name = s ? slotName(s) : props.label
  return (
    <button
      ref={(el) => {
        drag.setNodeRef(el)
        drop.setNodeRef(el)
      }}
      {...drag.listeners}
      {...drag.attributes}
      className={
        'inventory-cell' +
        (s ? ' filled' : '') +
        (props.selected ? ' selected' : '') +
        (drop.isOver ? (refused ? ' refused' : ' over') : '') +
        (drag.isDragging ? ' lifted' : '') +
        (props.label ? ' hero-place' : '')
      }
      data-place={id}
      tabIndex={s ? 0 : -1}
      title={name}
      aria-label={s ? name : props.label ? `${props.label}: пусто` : 'Пустая ячейка'}
      onClick={() => s && props.onOpen(props.place)}
    >
      {s ? (
        <img src={iconUrl(s.id)} alt='' draggable={false} />
      ) : props.blockedBy ? (
        <img className='blocked' src={iconUrl(props.blockedBy.id)} alt='' draggable={false} />
      ) : (
        props.label && <span className='hero-place-label'>{props.label}</span>
      )}
    </button>
  )
}

export function InventoryView(props: {
  character: DnDCharacter
  onChange: (c: DnDCharacter) => void
  // a thing was clicked: it opens in the reference below
  onOpen: (p: Place) => void
  selected: Place | null
}) {
  const c = props.character
  const [query, setQuery] = useState('')
  const [dragging, setDragging] = useState<Slot | null>(null)
  const bag = bagOf(c)
  const money = totalCp(walletOf(c))
  const results = searchItems(query)

  const room = bag.cells.includes(null)
  // the thing goes into the first free cell and into the «Снаряжение» field of the sheet
  const get = (item: EquipmentData, buy: boolean) => {
    const cells = addItem(bag.cells, { id: item.id })
    if (!cells) return
    let paid = c
    if (buy) {
      const w = pay(walletOf(c), item.cost_cp || 0)
      if (!w) return
      paid = { ...c, ...walletFields(c, w) }
    }
    props.onChange(withBag(paid, { ...bag, cells }))
  }
  const cost = (item: EquipmentData) =>
    item.cost ? price(item.cost) + (unitQty(item) > 1 ? ` за ${unitQty(item)} шт.` : '') : 'без цены'

  // the mouse drags after a few pixels (a click still opens the thing); a finger after holding
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } })
  )
  const start = (e: DragStartEvent) => setDragging(at(bag, placeOf(e.active.id)))
  const end = (e: DragEndEvent) => {
    setDragging(null)
    if (!e.over) return
    const next = move(bag, placeOf(e.active.id), placeOf(e.over.id))
    if (next) props.onChange(withBag(c, next))
  }

  const cell = (p: Place, label?: string, blockedBy?: Slot | null): ReactNode => (
    <Cell
      key={placeId(p)}
      place={p}
      slot={at(bag, p)}
      dragging={dragging}
      selected={props.selected === p}
      onOpen={props.onOpen}
      label={label}
      blockedBy={blockedBy}
    />
  )
  const w = bag.worn
  const sp = species.find((s) => norm(String(c.species ?? '')).startsWith(norm(nameOf(s))))
  const small = /^мал|^small/.test(norm(String(c.size ?? '')))

  return (
    <div className='inventory-page'>
      <div className='d-and-d-character-sheet inventory-money'>
        {COINS.map((k) => (
          <div key={k} className='inventory-coin'>
            <Currency label={L[k]} name={k} value={c[k]} onChange={(name: string, v: string) => props.onChange({ ...c, [name]: v })} />
          </div>
        ))}
      </div>

      <TextInput
        className='inventory-search'
        leftSection={<Icon name='search' />}
        placeholder='Найти предмет по названию — на русском или английском'
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        rightSection={query ? <button className='wiki-close' onClick={() => setQuery('')} aria-label='Очистить поиск'>×</button> : null}
      />
      {query.trim() && (
        <div className='inventory-results'>
          {results.map((item) => (
            <div key={item.id} className='inventory-result'>
              <img src={iconUrl(item.id)} alt='' />
              <div className='inventory-result-name'>
                <Text size='sm'>{nameOf(item)}</Text>
                <Text size='xs' c='dimmed'>{cost(item)}</Text>
              </div>
              <Button size='xs' variant='default' disabled={!room} onClick={() => get(item, false)}>Получить</Button>
              <Button
                size='xs'
                disabled={!room || !item.cost_cp || money < item.cost_cp}
                title={!item.cost_cp ? 'У предмета нет цены' : money < item.cost_cp ? 'Не хватает денег' : undefined}
                onClick={() => get(item, true)}
              >
                Купить
              </Button>
            </div>
          ))}
          {!results.length && <Text size='sm' c='dimmed' p='xs'>Ничего не найдено.</Text>}
        </div>
      )}
      {!room && <Text size='xs' c='dimmed' mt='xs'>Инвентарь заполнен: новые предметы некуда положить.</Text>}

      <DndContext sensors={sensors} onDragStart={start} onDragEnd={end} onDragCancel={() => setDragging(null)}>
        <div className='inventory-body'>
          <section className='hero' aria-label='Снаряжение героя'>
            <div className='hero-doll'>
              {cell('armor', 'Доспех')}
              {cell('clothes', 'Одежда')}
              <div className='hero-figure'>
                <HeroFigure species={sp?.id} small={small} />
                {String(c.ac ?? '').trim() && <span className='hero-ac' title='Класс доспеха'>КД {c.ac}</span>}
              </div>
              {cell('main1', 'Основная рука')}
              {cell('off1', 'Вторая рука', twoHanded(w.main1) ? w.main1 : null)}
            </div>
            <div className='hero-reserve'>
              <span className='hero-reserve-label'>Запасной комплект</span>
              {cell('main2', 'Основная рука')}
              {cell('off2', 'Вторая рука', twoHanded(w.main2) ? w.main2 : null)}
            </div>
          </section>
          <div className='inventory-grid'>{bag.cells.map((_, i) => cell(i))}</div>
        </div>
        <DragOverlay dropAnimation={null}>
          {dragging && (
            <div className='inventory-drag'>
              <img src={iconUrl(dragging.id)} alt='' />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
