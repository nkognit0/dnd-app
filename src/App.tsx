import { useEffect, useMemo, useRef, useState } from 'react'
import { ActionIcon, Anchor, Button, Group, Modal, SegmentedControl, Stack, Text, Title, UnstyledButton } from '@mantine/core'
import {
  DnDCharacter,
  DnDCharacterFeaturesSheet,
  DnDCharacterProfileSheet,
  DnDCharacterSpellSheet,
  DnDCharacterStatsSheet,
  SheetLinksContext
} from 'dnd-sheet'
import type { SheetLinks } from 'dnd-sheet'
import meta from '@data/meta.json'
import { byId } from './data'
import { Icon, IconName } from './icons'
import { LevelUpWizard } from './levelup/LevelUpWizard'
import { MAX_LEVEL, sheetLevel } from './levelup/read'
import { Wizard } from './wizard/Wizard'
import { WikiRef, findLinks, linkAt } from './wiki/lookup'
import { WikiPanel } from './wiki/WikiPanel'
import { ChangelogPanel } from './changelog/ChangelogPanel'
import { changelogOf, fieldTarget } from './changelog/changelog'
import { InventoryView } from './inventory/InventoryView'
import { syncSaved, withBag, withEquipmentText } from './inventory/sync'
import { withoutElectrum } from './inventory/inventory'
import { Place, at, bagOf, remove } from './inventory/worn'
import { withAttackEdit } from './inventory/gear'
import { RestMenu } from './rest/RestMenu'

const STORAGE_KEY = 'dnd-app-character'
const LOG_KEY = 'dnd-app-log-open'
const TAB_KEY = 'dnd-app-tab'
const VIEW_KEY = 'dnd-app-master-view'

// a remembered on/off switch of this browser (storage may be unavailable)
function readFlag(key: string, fallback: boolean): boolean {
  try {
    const v = window.localStorage.getItem(key)
    return v == null ? fallback : v === '1'
  } catch {
    return fallback
  }
}
function writeFlag(key: string, v: boolean) {
  try {
    window.localStorage.setItem(key, v ? '1' : '0')
  } catch {
    // the switch just is not remembered
  }
}

function loadSaved(): DnDCharacter {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) return syncSaved(withoutElectrum(JSON.parse(raw)))
  } catch {
    // storage may be unavailable; start with an empty sheet
  }
  return {}
}

export default function App() {
  const [character, setCharacter] = useState<DnDCharacter>(loadSaved)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [levelUpOpen, setLevelUpOpen] = useState(false)
  // the level-up button appears once the class field has a level number
  const level = sheetLevel(character)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(character))
    } catch {
      // the sheet works without persistence
    }
  }, [character])

  function exportJson() {
    const blob = new Blob([JSON.stringify(character, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = (character.name || 'character') + '.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function importJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result))
        if (data && typeof data === 'object' && !Array.isArray(data)) setCharacter(syncSaved(withoutElectrum(data)))
        else window.alert('В файле нет персонажа.')
      } catch {
        window.alert('Не удалось прочитать JSON.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // an edit of the «Снаряжение» fields is carried over to the inventory, an edit of the attack
  // table to the weapons in the hero's hands
  const sheetProps = {
    character,
    onCharacterChanged: (c: DnDCharacter) => {
      if (c.equipment !== character.equipment || c.equipment2 !== character.equipment2) c = withEquipmentText(c)
      else if (c.attacks !== character.attacks || c.attacksText !== character.attacksText) c = withAttackEdit(character, c)
      setCharacter(c)
    }
  }

  // Who looks at the sheet. The player plays: the sheet without weapons and equipment (they are
  // in the inventory) and the inventory tab. The game master looks: the whole sheet, no tabs.
  const [master, setMasterState] = useState(() => readFlag(VIEW_KEY, false))
  const setMaster = (v: boolean) => {
    setMasterState(v)
    writeFlag(VIEW_KEY, v)
    setWiki([])
    setWikiSlot(null)
  }
  useEffect(() => {
    document.body.classList.toggle('no-tabs', master)
  }, [master])

  // the tab shown: the sheet or the inventory (tabs at the bottom, as in Safari); the master has the sheet only
  const [tabState, setTabState] = useState<'sheet' | 'inventory'>(() => (readFlag(TAB_KEY, false) ? 'inventory' : 'sheet'))
  const tab = master ? 'sheet' : tabState
  const setTab = (t: 'sheet' | 'inventory') => {
    setTabState(t)
    writeFlag(TAB_KEY, t === 'inventory')
    setWiki([])
    setWikiSlot(null)
    window.scrollTo({ top: 0 })
  }

  // the reference at the bottom: what was opened, last on top (the back link goes down the list)
  const [wiki, setWiki] = useState<WikiRef[]>([])
  // the cell or the hero's place whose thing the reference shows, if it was opened from the inventory
  const [wikiSlot, setWikiSlot] = useState<Place | null>(null)
  const openWiki = (r: WikiRef) =>
    setWiki((h) => {
      const top = h[h.length - 1]
      return top && top.kind === r.kind && top.id === r.id ? h : [...h, r].slice(-30)
    })
  const closeWiki = () => {
    setWiki([])
    setWikiSlot(null)
  }
  const bag = bagOf(character)
  const openSlot = (i: Place) => {
    const s = at(bag, i)
    if (!s) return
    // a thing of the player's own has no reference card, only its own small card
    if (!s.id) {
      setWiki([])
      setWikiSlot(i)
      return
    }
    const kind = byId.weapon[s.id] ? 'weapon' : byId.armor[s.id] ? 'armor' : byId.item[s.id]?.category === 'tool' ? 'tool' : 'item'
    setWikiSlot(i)
    openWiki({ kind, id: s.id })
  }
  const slot = wikiSlot != null ? at(bag, wikiSlot) : null
  const current = wiki[wiki.length - 1]
  // the panel still shows the thing of that cell (a link in the card may have been followed)
  const slotShown = !!slot && (slot.id ? current?.id === slot.id : wiki.length === 0)
  const ownShown = slotShown && !slot!.id
  const removeSlot = () => {
    if (wikiSlot == null) return
    setCharacter(withBag(character, remove(bag, wikiSlot)))
    closeWiki()
  }
  const removeButton = (
    <Button size='xs' variant='default' mb='sm' onClick={removeSlot}>Удалить</Button>
  )
  const [creditsOpen, setCreditsOpen] = useState(false)
  // the change log next to the reference; shown again by the toolbar button
  const [logOpen, setLogOpen] = useState(() => readFlag(LOG_KEY, false))
  const showLog = (v: boolean) => {
    setLogOpen(v)
    writeFlag(LOG_KEY, v)
  }
  // the field lit up in the sheet while its log entry is under the mouse
  const [lit, setLit] = useState<string | null>(null)
  const events = changelogOf(character)
  const wizardDone = (c: DnDCharacter) => {
    setCharacter(c)
    showLog(true)
  }

  const links = useMemo<SheetLinks>(() => ({
    find: (field, text) => findLinks(field, text),
    open: (field, text, offset) => {
      const r = linkAt(field, text, offset)
      if (r) {
        setWikiSlot(null)
        openWiki(r)
      }
    }
  }), [])

  // square icon button; the label is its tooltip and its name for screen readers
  const toolbarIcon = (icon: IconName, label: string, onClick: () => void) => (
    <ActionIcon variant='default' size='input-sm' onClick={onClick} aria-label={label} title={label}>
      <Icon name={icon} />
    </ActionIcon>
  )

  return (
    <>
      <div className='app-toolbar no-print'>
        <Button onClick={() => setWizardOpen(true)}>Новый персонаж</Button>
        {level != null && level < MAX_LEVEL && (
          <Button variant='light' onClick={() => setLevelUpOpen(true)}>
            Новый уровень: {level + 1}
          </Button>
        )}
        {/* a rest restores the hero by the rules: shown once the sheet has a Hit Point maximum */}
        {/\d/.test(String(character.maxHp ?? '')) && <RestMenu character={character} onRest={setCharacter} />}
        <Group gap='xs' ml='auto'>
          <SegmentedControl
            value={master ? 'master' : 'player'}
            onChange={(v) => setMaster(v === 'master')}
            data={[
              { label: 'Игрок', value: 'player' },
              { label: 'Мастер', value: 'master' }
            ]}
            aria-label='Чей вид'
          />
          {toolbarIcon('list', logOpen ? 'Скрыть журнал изменений' : 'Журнал изменений', () => showLog(!logOpen))}
          {toolbarIcon('upload', 'Импорт JSON', () => fileInput.current?.click())}
          {toolbarIcon('download', 'Экспорт JSON', exportJson)}
          {toolbarIcon('print', 'Печать', () => window.print())}
          {toolbarIcon('trash', 'Очистить лист', () => window.confirm('Очистить лист?') && setCharacter({}))}
          {toolbarIcon('info', 'Авторы и лицензии', () => setCreditsOpen(true))}
        </Group>
        <input ref={fileInput} type='file' accept='application/json,.json' hidden onChange={importJson} />
      </div>
      <div className={'sheet-side' + (tab === 'sheet' ? '' : ' hidden-tab')}>
        <SheetLinksContext.Provider value={links}>
            <main className='sheet-column'>
              <div className='sheet-page'>
                <DnDCharacterStatsSheet {...sheetProps} hideAttacks={!master} hideEquipment={!master} />
              </div>
              <div className='sheet-page'>
                <DnDCharacterFeaturesSheet {...sheetProps} />
              </div>
              <div className='sheet-page'>
                <DnDCharacterProfileSheet {...sheetProps} />
              </div>
              <div className='sheet-page'>
                <DnDCharacterSpellSheet {...sheetProps} />
              </div>
            </main>
          </SheetLinksContext.Provider>
      </div>
      {tab === 'inventory' && (
        <main className='sheet-column inventory-column no-print'>
          <InventoryView character={character} onChange={setCharacter} onOpen={openSlot} selected={slotShown ? wikiSlot : null} />
        </main>
      )}
      {/* the SRD license (CC-BY-4.0) and the icons (CC BY 3.0) require this credit wherever the app
          is shared: it is one click away, behind the toolbar button */}
      <Modal opened={creditsOpen} onClose={() => setCreditsOpen(false)} title='Авторы и лицензии' size='lg'>
        <Stack gap='sm'>
          <Text size='sm'>{meta.attribution} Материалы SRD переведены на русский и сокращены.</Text>
          <Text size='sm'>
            Иконки предметов — D&amp;D Item Icons by Gwillewyn на основе game-icons.net (Lorc, Delapouite и другие), CC BY 3.0.
          </Text>
          <Text size='sm'>
            Неофициальное фанатское приложение, не связано с Wizards of the Coast. Dungeons &amp; Dragons и D&amp;D — товарные
            знаки Wizards of the Coast LLC.
          </Text>
          <Text size='sm'>
            <Anchor href='licenses.txt' target='_blank'>Полные тексты лицензий</Anchor>
          </Text>
        </Stack>
      </Modal>
      {/* room to scroll the end of the page above the open panel */}
      {(wiki.length > 0 || ownShown || logOpen) && <div className='panel-spacer no-print' />}
      {(wiki.length > 0 || ownShown || logOpen) && (
        <aside className='bottom-panel no-print'>
          {ownShown && (
            <div className='wiki-card'>
              <Group justify='space-between' mb='sm' wrap='nowrap'>
                <Text size='xs' c='dimmed' fw={600} tt='uppercase'>Инвентарь</Text>
                <UnstyledButton className='wiki-close' onClick={closeWiki} aria-label='Закрыть' title='Закрыть'>×</UnstyledButton>
              </Group>
              {removeButton}
              <Stack gap={2}>
                <Title order={3}>{slot!.name}</Title>
                <Text size='sm' c='dimmed'>Этого предмета нет в справочнике: он записан в «Снаряжении» на листе своими словами.</Text>
              </Stack>
            </div>
          )}
          {wiki.length > 0 && (
            <WikiPanel
              history={wiki}
              open={(r) => { setWikiSlot(null); openWiki(r) }}
              back={() => setWiki((h) => h.slice(0, -1))}
              close={closeWiki}
              extra={slotShown ? removeButton : null}
            />
          )}
          {logOpen && <ChangelogPanel events={events} onHover={setLit} onClose={() => { showLog(false); setLit(null) }} />}
        </aside>
      )}
      {lit && <style>{`.d-and-d-character-sheet [data-field="${fieldTarget(lit)}"] { background-color: rgba(53, 122, 222, 0.12); box-shadow: 0 0 0 2px #357ADE; border-radius: 6px; }`}</style>}
      {!master && (
        <nav className='tab-bar no-print' aria-label='Вкладки'>
          <button className={tab === 'sheet' ? 'active' : ''} onClick={() => setTab('sheet')} aria-current={tab === 'sheet'} aria-label='Лист персонажа'>
            <Icon name='sheet' size={20} />
            <span>Лист персонажа</span>
          </button>
          <button className={tab === 'inventory' ? 'active' : ''} onClick={() => setTab('inventory')} aria-current={tab === 'inventory'} aria-label='Инвентарь'>
            <Icon name='bag' size={20} />
            <span>Инвентарь</span>
          </button>
        </nav>
      )}
      {levelUpOpen && (
        <LevelUpWizard
          character={character}
          onClose={() => setLevelUpOpen(false)}
          onComplete={(c) => {
            wizardDone(c)
            setLevelUpOpen(false)
          }}
        />
      )}
      <Wizard
        opened={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onComplete={(c) => {
          wizardDone(c)
          setWizardOpen(false)
        }}
      />
    </>
  )
}
