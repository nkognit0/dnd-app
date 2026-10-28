import React from 'react'

import DnDCharacter from './DnDCharacter'
import L from './labels'

import StatBox2 from './Components/StatBox2'
import SpellTable from './Components/SpellTable'

import './dndstyles.css'

interface IDnDCharacterSpellsSheetProps {
  character?: DnDCharacter
  defaultCharacter?: DnDCharacter
  onCharacterChanged?: (
    character: DnDCharacter,
    changedField: string,
    newValue: any
  ) => void
}

interface IDnDCharacterSpellsSheetState {
  character: DnDCharacter
}

// [spell level, rows] per column of the sheet
const COLUMNS: [number, number][][] = [
  [[0, 9], [1, 12], [2, 13]],
  [[3, 13], [4, 13], [5, 9]],
  [[6, 9], [7, 9], [8, 7], [9, 7]]
]

class DnDCharacterSpellsSheet extends React.Component<
  IDnDCharacterSpellsSheetProps,
  IDnDCharacterSpellsSheetState
> {
  constructor(props: IDnDCharacterSpellsSheetProps) {
    super(props)
    this.state = { character: props.defaultCharacter || {} }
  }

  updateCharacter(name: string, value: any) {
    const oldCharacter = this.getCharacter()
    const newCharacter: DnDCharacter = {}
    Object.assign(newCharacter, oldCharacter)
    newCharacter[name] = value

    if (!this.props.character) {
      // NOT CONTROLLED
      this.setState({ character: newCharacter })
    }

    if (typeof this.props.onCharacterChanged === 'function') {
      this.props.onCharacterChanged(newCharacter, name, value)
    }
  }

  getCharacter() {
    // NOT CONTROLLED
    let character = this.state.character
    if (this.props.character) {
      // CONTROLLED
      character = this.props.character
    }
    return character
  }

  render() {
    const character = this.getCharacter()
    const update = (name: string, value: any) => this.updateCharacter(name, value)

    const headerBox = (name: string, line1: string, line2: string) => (
      <div className='col-4 pr-4 pl-4'>
        <StatBox2 name={name} value={character[name]} onChange={update} />
        <label className='d-and-d-spell-stat-label'>{line1}</label>
        <label className='d-and-d-spell-stat-label'>{line2}</label>
      </div>
    )

    const spellTable = ([level, rows]: [number, number]) =>
      level === 0 ? (
        <SpellTable
          key={level}
          level={0}
          rows={rows}
          name='cantrips'
          value={character.cantrips}
          onChange={update}
          style={{ marginBottom: '23px' }}
        />
      ) : (
        <SpellTable
          key={level}
          level={level}
          rows={rows}
          showLabels={level === 1}
          name={'lvl' + level + 'Spells'}
          slotsName={'lvl' + level + 'SpellSlotsTotal'}
          slotsUsedName={'lvl' + level + 'SpellSlotsUsed'}
          value={character['lvl' + level + 'Spells']}
          slotsValue={character['lvl' + level + 'SpellSlotsTotal']}
          slotsUsedValue={character['lvl' + level + 'SpellSlotsUsed']}
          onChange={update}
        />
      )

    return (
      <div className='d-and-d-character-sheet container-xl mt-5 mb-5'>
        <div>
          <div className='row mb-4'>
            <div className='col-md-3 pr-2 pl-2'>
              <div className='d-and-d-page-title'>{L.title}</div>
              <div className='d-and-d-attribute-collection char-name pr-3 pl-3'>
                <input
                  type='text'
                  data-field='spellcastingClass'
                  value={character.spellcastingClass ? character.spellcastingClass : ''}
                  onChange={(e) => this.updateCharacter('spellcastingClass', e.target.value)}
                />
              </div>
              <label className='d-and-d-char-name-label'>{L.spellcastingClass}</label>
            </div>
            <div className='col-md-9 pr-2 pl-2' style={{ marginTop: '18px' }}>
              <div className='d-and-d-attribute-collection gray pr-3 pl-3'>
                <div className='row pl-3 pr-3'>
                  {headerBox('preparedSpellsTotal', L.preparedSpells, L.preparedSpellsSub)}
                  {headerBox('spellSaveDC', L.spellSaveDC, L.spellSaveDCSub)}
                  {headerBox('spellAttackBonus', L.spellAttack, L.spellAttackSub)}
                </div>
              </div>
            </div>
          </div>

          <div className='row'>
            {COLUMNS.map((column, i) => (
              <div className='col-md-4' key={i}>
                <div className='d-and-d-box'>{column.map(spellTable)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }
}

export default DnDCharacterSpellsSheet
