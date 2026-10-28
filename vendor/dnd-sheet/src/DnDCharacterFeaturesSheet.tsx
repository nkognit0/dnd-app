import React from 'react'

import DnDCharacter from './DnDCharacter'
import L from './labels'

import './dndstyles.css'

interface IDnDCharacterFeaturesSheetProps {
  character?: DnDCharacter
  defaultCharacter?: DnDCharacter
  onCharacterChanged?: (
    character: DnDCharacter,
    changedField: string,
    newValue: any
  ) => void
}

interface IDnDCharacterFeaturesSheetState {
  character: DnDCharacter
}

// [field key, label, rows] of the personality block
const PERSONALITY: [string, string, number][] = [
  ['personalityTraits', L.personalityTraits, 3],
  ['ideals', L.ideals, 3],
  ['bonds', L.bonds, 2],
  ['flaws', L.flaws, 2]
]

// personality, features and languages: looked up less often than the stats sheet
class DnDCharacterFeaturesSheet extends React.Component<
  IDnDCharacterFeaturesSheetProps,
  IDnDCharacterFeaturesSheetState
> {
  constructor(props: IDnDCharacterFeaturesSheetProps) {
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

  textarea(character: DnDCharacter, name: string, rows: number, style: React.CSSProperties = { paddingBottom: '5px' }) {
    return (
      <textarea
        data-field={name}
        style={style}
        value={character[name] ? character[name] : ''}
        onChange={(e) => this.updateCharacter(name, e.target.value)}
        rows={rows}
      />
    )
  }

  // a bordered box with a textarea and a title under it
  box(character: DnDCharacter, name: string, label: string, rows: number, className = 'd-and-d-box mt-3') {
    return (
      <div className={className}>
        {this.textarea(character, name, rows)}
        <label className='d-and-d-title' style={{ marginTop: '10px' }}>
          {label}
        </label>
      </div>
    )
  }

  render() {
    const character = this.getCharacter()
    const last = PERSONALITY.length - 1

    return (
      <div className='d-and-d-character-sheet container-xl mt-5 mb-5'>
        <div className='row'>
          <div className='col-md-4'>
            <div className='d-and-d-box gray' style={{ marginBottom: '17px' }}>
              {PERSONALITY.map(([name, label, rows], i) => (
                <div
                  key={name}
                  className='d-and-d-box white'
                  style={{
                    borderRadius: i === 0 ? '8px 8px 0 0' : i === last ? '0 0 8px 8px' : '0 0 0 0',
                    marginBottom: i === last ? '0px' : '5px',
                    paddingTop: '1px',
                    paddingBottom: i === last ? '4px' : '5px'
                  }}
                >
                  {this.textarea(character, name, rows, {})}
                  <label className='d-and-d-title'>{label}</label>
                </div>
              ))}
            </div>
            {this.box(character, 'languages', L.languages, 3)}
          </div>

          <div className='col-md-4'>
            {this.box(character, 'classFeatures', L.classFeatures, 20, 'd-and-d-box')}
          </div>

          <div className='col-md-4'>
            {this.box(character, 'speciesTraits', L.speciesTraits, 8, 'd-and-d-box')}
            {this.box(character, 'feats', L.feats, 9)}
          </div>
        </div>
      </div>
    )
  }
}

export default DnDCharacterFeaturesSheet
