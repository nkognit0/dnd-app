import { useEffect, useRef, useState } from 'react'
import { Button } from '@mantine/core'
import {
  DnDCharacter,
  DnDCharacterProfileSheet,
  DnDCharacterSpellSheet,
  DnDCharacterStatsSheet
} from 'dnd-sheet'
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

  return (
    <>
      <div className='app-toolbar no-print'>
        <Button onClick={() => setWizardOpen(true)}>Новый персонаж</Button>
        <span className='app-title'>Лист персонажа D&amp;D 2024</span>
        <Button variant='default' onClick={() => fileInput.current?.click()}>Импорт JSON</Button>
        <Button variant='default' onClick={exportJson}>Экспорт JSON</Button>
        <Button variant='default' onClick={() => window.print()}>Печать</Button>
        <Button
          variant='subtle'
          color='gray'
          onClick={() => window.confirm('Очистить лист?') && setCharacter({})}
        >
          Очистить
        </Button>
        <input ref={fileInput} type='file' accept='application/json,.json' hidden onChange={importJson} />
      </div>
      <div className='sheet-page'>
        <DnDCharacterStatsSheet {...sheetProps} />
      </div>
      <div className='sheet-page'>
        <DnDCharacterProfileSheet {...sheetProps} />
      </div>
      <div className='sheet-page'>
        <DnDCharacterSpellSheet {...sheetProps} />
      </div>
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
