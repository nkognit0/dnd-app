// The change log next to the reference: one block per creation or level up, newest first.
// Hovering an entry lights up its field in the sheet; a click scrolls the sheet to it.
import { useState } from 'react'
import { Group, Stack, Text, UnstyledButton } from '@mantine/core'
import type { ChangeEntry, ChangeEvent } from './changelog'
import { fieldTarget } from './changelog'

const when = (iso: string) => {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

// "Сила: 17 → 19", "Умения класса: + Всплеск действий", "Заговоры: − Свет"
function change(e: ChangeEntry) {
  if (!e.from) return <><b>{e.label}:</b> {e.to}</>
  if (!e.to) return <><b>{e.label}:</b> <s>{e.from}</s></>
  return <><b>{e.label}:</b> {e.from} → {e.to}</>
}

export function ChangelogPanel(props: { events: ChangeEvent[]; onHover: (field: string | null) => void; onClose: () => void }) {
  const events = [...props.events].reverse()
  // the newest block is open, older ones fold
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const isOpen = (e: ChangeEvent, i: number) => open[e.id] ?? i === 0

  const show = (field: string) => {
    const el = document.querySelector(`[data-field="${fieldTarget(field)}"]`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  return (
    <div className='wiki-card changelog'>
      <Group justify='space-between' wrap='nowrap'>
        <Text size='xs' c='dimmed' fw={600} tt='uppercase'>Журнал изменений</Text>
        <UnstyledButton className='wiki-close' onClick={props.onClose} aria-label='Скрыть журнал' title='Скрыть журнал'>×</UnstyledButton>
      </Group>
      {!events.length && (
        <Text size='sm' c='dimmed' mt='sm'>
          Здесь появятся изменения листа при создании персонажа и при повышении уровня — каждое поле отдельной строкой и почему оно изменилось.
        </Text>
      )}
      <Stack gap='md' mt='sm'>
        {events.map((ev, i) => (
          <div key={ev.id}>
            <UnstyledButton className='changelog-event' onClick={() => setOpen((o) => ({ ...o, [ev.id]: !isOpen(ev, i) }))}>
              <Text size='sm' fw={700}>{isOpen(ev, i) ? '▾' : '▸'} {ev.title}</Text>
              <Text size='xs' c='dimmed'>{when(ev.at)} · изменений: {ev.entries.length}</Text>
            </UnstyledButton>
            {isOpen(ev, i) && (
              <Stack gap={2} mt={6}>
                {ev.entries.map((e, j) => (
                  <div
                    key={j}
                    className='changelog-entry'
                    onMouseEnter={() => props.onHover(e.field)}
                    onMouseLeave={() => props.onHover(null)}
                    onClick={() => show(e.field)}
                  >
                    <Text size='sm'>{change(e)}</Text>
                    {e.why && <Text size='xs' c='dimmed'>{e.why}</Text>}
                  </div>
                ))}
              </Stack>
            )}
          </div>
        ))}
      </Stack>
    </div>
  )
}
