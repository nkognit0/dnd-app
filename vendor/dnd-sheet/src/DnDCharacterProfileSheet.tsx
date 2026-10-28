import React from 'react'

import DnDCharacter from './DnDCharacter'
import L from './labels'

import Image from './Components/Image'

import './dndstyles.css'

interface IDnDCharacterProfileSheetProps {
  character?: DnDCharacter
  defaultCharacter?: DnDCharacter
  onCharacterChanged?: (
    character: DnDCharacter,
    changedField: string,
    newValue: any
  ) => void
}

interface IDnDCharacterProfileSheetState {
  character: DnDCharacter
}

class DnDCharacterProfileSheet extends React.Component<
  IDnDCharacterProfileSheetProps,
  IDnDCharacterProfileSheetState
> {
  constructor(props: IDnDCharacterProfileSheetProps) {
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

  input(character: DnDCharacter, name: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) {
    return (
      <input
        type='text'
        data-field={name}
        value={character[name] ? character[name] : ''}
        onChange={(e) => this.updateCharacter(name, e.target.value)}
        {...props}
      />
    )
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

  render() {
    const character = this.getCharacter()
    const update = (name: string, value: any) => this.updateCharacter(name, value)

    const headerCell = (name: string, label: string) => (
      <div className='col-md-4 col-6 pl-0 pr-0'>
        {this.input(character, name)}
        <label>{label}</label>
      </div>
    )

    return (
      <div className='d-and-d-character-sheet container-xl mt-5 mb-5'>
        <div>
          <div className='row mb-4'>
            <div className='col-md-3 pr-2 pl-2'>
              <div className='d-and-d-page-title'>{L.title}</div>
              <div className='d-and-d-attribute-collection char-name pr-3 pl-3'>
                {this.input(character, 'name')}
              </div>
              <label className='d-and-d-char-name-label'>{L.characterName}</label>
            </div>
            <div className='col-md-9 pr-2 pl-2'>
              <div className='d-and-d-attribute-collection pr-3 pl-3'>
                <div className='row pl-3 pr-3'>
                  {headerCell('age', L.age)}
                  {headerCell('height', L.height)}
                  {headerCell('weight', L.weight)}
                </div>
                <div className='row pl-3 pr-3'>
                  {headerCell('eyes', L.eyes)}
                  {headerCell('skin', L.skin)}
                  {headerCell('hair', L.hair)}
                </div>
              </div>
            </div>
          </div>

          <div className='row'>
            <div className='col-md-4'>
              <div className='d-and-d-box square'>
                <Image name='appearance' value={character.appearance} onChange={update} />
                <label className='d-and-d-title' style={{ marginTop: '10px' }}>
                  {L.appearance}
                </label>
              </div>

              <div className='d-and-d-box mt-3'>
                {this.textarea(character, 'backstory', 26)}
                <label className='d-and-d-title' style={{ marginTop: '10px' }}>
                  {L.backstory}
                </label>
              </div>
            </div>

            <div className='col-md-8'>
              <div className='d-and-d-box'>
                <div className='row'>
                  <div className='col-md-6 border-right'>
                    <div className='d-and-d-gray-text' style={{ paddingBottom: '1px' }}>
                      <label style={{ width: '60px' }}>{L.organizationRank}</label>
                      {this.input(character, 'factionRank', {
                        style: { width: 'calc(100% - 60px)' },
                        className: 'd-and-d-linput'
                      })}
                    </div>
                    {this.textarea(character, 'allies', 16)}
                  </div>
                  <div className='col-md-6'>
                    <div className='d-and-d-box gray noborder' style={{ marginBottom: '13px' }}>
                      <div className='d-and-d-faction-input'>
                        <label>{L.organization}</label>
                        {this.input(character, 'faction')}
                      </div>
                      <Image
                        classes='faction'
                        name='factionImg'
                        value={character.factionImg}
                        onChange={update}
                      />
                    </div>
                    {this.textarea(character, 'allies2', 3)}
                  </div>
                </div>

                <label className='d-and-d-title' style={{ marginTop: '10px' }}>
                  {L.alliesAndOrganizations}
                </label>
              </div>

              <div className='d-and-d-box mt-3'>
                <div className='row'>
                  <div className='col-md-6 border-right'>
                    {this.textarea(character, 'additionalFeatures', 13)}
                  </div>
                  <div className='col-md-6'>
                    {this.textarea(character, 'additionalFeatures2', 13)}
                  </div>
                </div>

                <label className='d-and-d-title' style={{ marginTop: '10px' }}>
                  {L.additionalFeatures}
                </label>
              </div>

              <div className='d-and-d-box mt-3'>
                <div className='row'>
                  <div className='col-md-6 border-right'>
                    <div className='d-and-d-attunement'>
                      <div className='d-and-d-subtitle'>{L.attunement}</div>
                      {(['attunedItem1', 'attunedItem2', 'attunedItem3'] as const).map((name, i) => (
                        <div key={name} className='d-and-d-attunement-row'>
                          <span>{i + 1}.</span>
                          {this.input(character, name)}
                        </div>
                      ))}
                    </div>
                    {this.textarea(character, 'treasure', 6, { paddingBottom: '5px', marginTop: '2px' })}
                  </div>
                  <div className='col-md-6'>
                    {this.textarea(character, 'treasure2', 10, { paddingBottom: '5px', marginTop: '4px' })}
                  </div>
                </div>

                <label className='d-and-d-title' style={{ marginTop: '4px' }}>
                  {L.treasure}
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

export default DnDCharacterProfileSheet
