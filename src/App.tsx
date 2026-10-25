import { useEffect, useRef, useState } from 'react'
import { ActionIcon, Button, Group } from '@mantine/core'
import {
  DnDCharacter,
  DnDCharacterFeaturesSheet,
  DnDCharacterProfileSheet,
  DnDCharacterSpellSheet,
  DnDCharacterStatsSheet
} from 'dnd-sheet'
import meta from '@data/meta.json'
import { Icon, IconName } from './icons'
import { LevelUpWizard } from './levelup/LevelUpWizard'
import { MAX_LEVEL, sheetLevel } from './levelup/read'
import { Wizard } from './wizard/Wizard'

const STORAGE_KEY = 'dnd-app-character'

function loadSaved(): DnDCharacter {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
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
        if (data && typeof data === 'object' && !Array.isArray(data)) setCharacter(data)
        else window.alert('В файле нет персонажа.')
      } catch {
        window.alert('Не удалось прочитать JSON.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const sheetProps = { character, onCharacterChanged: (c: DnDCharacter) => setCharacter(c) }

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
        <Group gap='xs' ml='auto'>
          {toolbarIcon('upload', 'Импорт JSON', () => fileInput.current?.click())}
          {toolbarIcon('download', 'Экспорт JSON', exportJson)}
          {toolbarIcon('print', 'Печать', () => window.print())}
          {toolbarIcon('trash', 'Очистить лист', () => window.confirm('Очистить лист?') && setCharacter({}))}
        </Group>
        <input ref={fileInput} type='file' accept='application/json,.json' hidden onChange={importJson} />
      </div>
      <main className='sheet-column'>
        <div className='sheet-page'>
          <DnDCharacterStatsSheet {...sheetProps} />
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
      {/* the SRD license (CC-BY-4.0) requires this credit wherever the app is shared */}
      <footer className='app-footer no-print'>
        <p>{meta.attribution} Материалы SRD переведены на русский и сокращены.</p>
        <p>
          Неофициальное фанатское приложение, не связано с Wizards of the Coast. Dungeons &amp; Dragons и D&amp;D —
          товарные знаки Wizards of the Coast LLC. <a href='licenses.txt'>Лицензии</a>
        </p>
      </footer>
      {levelUpOpen && (
        <LevelUpWizard
          character={character}
          onClose={() => setLevelUpOpen(false)}
          onComplete={(c) => {
            setCharacter(c)
            setLevelUpOpen(false)
          }}
        />
      )}
      <Wizard
        opened={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onComplete={(c) => {
          setCharacter(c)
          setWizardOpen(false)
        }}
      />
    </>
  )
}
