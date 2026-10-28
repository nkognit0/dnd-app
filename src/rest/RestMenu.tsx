// The «Отдых» button of the toolbar: a menu with a long and a short rest. Each opens a window
// that shows what the rest restores; nothing changes until «Отдохнуть». In a short rest the hero
// spends Hit Point Dice one by one: the app rolls, and a roll of real dice can be typed instead.
import { useState } from 'react'
import { Alert, Button, Group, Menu, Modal, NumberInput, Stack, Text, UnstyledButton } from '@mantine/core'
import type { DnDCharacter } from 'dnd-sheet'
import { Icon } from '../icons'
import { healOf, longRest, restState, shortRest } from './rest'

const NOT_COUNTED = 'Заряды умений (ярость, второе дыхание и т. п.) и истощение лист не считает — отметьте их сами.'

function Changes(props: { changes: string[]; empty: string }) {
  return props.changes.length ? (
    <Stack gap={4}>
      {props.changes.map((line) => (
        <Text key={line} size='sm'>• {line}</Text>
      ))}
    </Stack>
  ) : (
    <Text size='sm' c='dimmed'>{props.empty}</Text>
  )
}

function LongRest(props: { character: DnDCharacter; onRest: (c: DnDCharacter) => void; onClose: () => void }) {
  const s = restState(props.character)
  const r = longRest(props.character)
  return (
    <Stack>
      <Text size='sm' c='dimmed'>Не меньше 6 часов сна и не больше 2 часов лёгких занятий.</Text>
      {s.blocked ? <Alert color='red'>{s.blocked}</Alert> : <Changes changes={r.changes} empty='Герой и так полностью отдохнул: восстанавливать нечего.' />}
      <Text size='xs' c='dimmed'>{NOT_COUNTED}</Text>
      <Group justify='flex-end'>
        <Button variant='default' onClick={props.onClose}>Отмена</Button>
        <Button disabled={!!s.blocked} onClick={() => props.onRest(r.character)}>Отдохнуть</Button>
      </Group>
    </Stack>
  )
}

function ShortRest(props: { character: DnDCharacter; onRest: (c: DnDCharacter) => void; onClose: () => void }) {
  const s = restState(props.character)
  const [rolls, setRolls] = useState<number[]>([])
  const die = s.hitDice?.die ?? 0
  const left = (s.hitDice?.count ?? 0) - rolls.length
  const hp = s.hp ?? 0
  const healed = rolls.reduce((sum, r) => sum + healOf(r, s.conMod), 0)
  const hpAfter = s.maxHp != null ? Math.min(s.maxHp, hp + healed) : hp + healed
  const full = s.maxHp != null && hpAfter >= s.maxHp
  const con = s.conMod ? `${s.conMod > 0 ? '+' : '−'}${Math.abs(s.conMod)}` : ''
  const r = shortRest(props.character, rolls)
  return (
    <Stack>
      <Text size='sm' c='dimmed'>
        Час отдыха. За каждую потраченную кость хитов герой восстанавливает бросок{con ? ` ${con} (Телосложение)` : ''}, но не меньше 1 хита; после
        каждого броска можно решить, тратить ли следующую.
      </Text>
      {s.blocked ? (
        <Alert color='red'>{s.blocked}</Alert>
      ) : (
        <>
          <Group gap='xl'>
            <Text size='sm'>
              Хиты: <b>{hpAfter}</b>{s.maxHp != null ? ` из ${s.maxHp}` : ''}
            </Text>
            <Text size='sm'>
              Кости хитов: <b>{s.hitDice ? `${left}к${die}` : 'не заполнены'}</b>{s.hitDiceMax ? ` из ${s.hitDiceMax.count}к${s.hitDiceMax.die}` : ''}
            </Text>
          </Group>
          {rolls.map((roll, i) => (
            <Group key={i} gap='xs' wrap='nowrap'>
              <Text size='sm' w={70}>Кость {i + 1}</Text>
              <NumberInput
                size='xs'
                w={70}
                min={1}
                max={die}
                clampBehavior='strict'
                value={roll}
                aria-label={`Бросок кости ${i + 1}`}
                onChange={(v) => setRolls(rolls.map((x, j) => (j === i ? Math.max(1, Math.min(die, Number(v) || 1)) : x)))}
              />
              <Text size='sm'>{con} = {healOf(roll, s.conMod)} хит.</Text>
              <UnstyledButton className='wiki-close' aria-label='Не тратить эту кость' title='Не тратить эту кость' onClick={() => setRolls(rolls.filter((_, j) => j !== i))}>
                ×
              </UnstyledButton>
            </Group>
          ))}
          <Group>
            <Button
              variant='light'
              disabled={!s.hitDice || left < 1 || full}
              onClick={() => setRolls([...rolls, 1 + Math.floor(Math.random() * die)])}
            >
              {s.hitDice ? `Потратить кость хитов (к${die})` : 'Потратить кость хитов'}
            </Button>
            {full && <Text size='xs' c='dimmed'>Хиты полные</Text>}
            {s.hitDice && left < 1 && !full && <Text size='xs' c='dimmed'>Кости хитов закончились — они вернутся после долгого отдыха</Text>}
          </Group>
          {s.warlock && <Text size='sm'>Магия договора: потраченные ячейки колдуна восстановятся.</Text>}
          {!!r.changes.length && <Changes changes={r.changes} empty='' />}
        </>
      )}
      <Text size='xs' c='dimmed'>{NOT_COUNTED}</Text>
      <Group justify='flex-end'>
        <Button variant='default' onClick={props.onClose}>Отмена</Button>
        <Button disabled={!!s.blocked} onClick={() => props.onRest(r.character)}>Отдохнуть</Button>
      </Group>
    </Stack>
  )
}

export function RestMenu(props: { character: DnDCharacter; onRest: (c: DnDCharacter) => void }) {
  const [open, setOpen] = useState<'long' | 'short' | null>(null)
  const close = () => setOpen(null)
  const rest = (c: DnDCharacter) => {
    props.onRest(c)
    close()
  }
  return (
    <>
      <Menu position='bottom-start' shadow='md'>
        <Menu.Target>
          <Button variant='light' rightSection={<Icon name='chevron' size={16} />}>Отдых</Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item onClick={() => setOpen('long')}>
            <Text size='sm'>Долгий</Text>
            <Text size='xs' c='dimmed'>Все хиты, кости хитов и ячейки</Text>
          </Menu.Item>
          <Menu.Item onClick={() => setOpen('short')}>
            <Text size='sm'>Короткий</Text>
            <Text size='xs' c='dimmed'>Лечение костями хитов</Text>
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <Modal opened={open === 'long'} onClose={close} title='Долгий отдых'>
        {open === 'long' && <LongRest character={props.character} onRest={rest} onClose={close} />}
      </Modal>
      <Modal opened={open === 'short'} onClose={close} title='Короткий отдых'>
        {open === 'short' && <ShortRest character={props.character} onRest={rest} onClose={close} />}
      </Modal>
    </>
  )
}
