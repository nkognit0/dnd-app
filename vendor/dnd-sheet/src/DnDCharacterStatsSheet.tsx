import React from 'react'

import DnDCharacter from './DnDCharacter'
import L from './labels'

import Statbox from './Components/StatBox'
import StatRow from './Components/StatRow'
import Skill from './Components/Skill'
import StatBox2 from './Components/StatBox2'
import DeathSave from './Components/DeathSave'
import AttackTable from './Components/AttackTable'
import Currency from './Components/Currency'
import Check from './Components/Check'
import { LinkField, LinkedTextarea } from './links'

import './dndstyles.css'

interface IDnDCharacterStatsSheetProps {
  character?: DnDCharacter
  defaultCharacter?: DnDCharacter
  // the player's view: weapons, money and equipment are kept elsewhere (the app's inventory);
  // without the weapons table its column holds the equipment training
  hideAttacks?: boolean
  hideEquipment?: boolean
  onCharacterChanged?: (
    character: DnDCharacter,
    changedField: string,
    newValue: any
  ) => void
}

interface IDnDCharacterStatsSheetState {
  character: DnDCharacter
}

const ABILITIES: [string, string][] = [
  ['str', L.str],
  ['dex', L.dex],
  ['con', L.con],
  ['int', L.int],
  ['wis', L.wis],
  ['cha', L.cha]
]

// [field key, label, ability hint]
const SKILLS: [string, string, string][] = [
  ['skillAcrobatics', L.acrobatics, L.dexShort],
  ['skillAnimalHandling', L.animalHandling, L.wisShort],
  ['skillArcana', L.arcana, L.intShort],
  ['skillAthletics', L.athletics, L.strShort],
  ['skillDeception', L.deception, L.chaShort],
  ['skillHistory', L.history, L.intShort],
  ['skillInsight', L.insight, L.wisShort],
  ['skillIntimidation', L.intimidation, L.chaShort],
  ['skillInvestigation', L.investigation, L.intShort],
  ['skillMedicine', L.medicine, L.wisShort],
  ['skillNature', L.nature, L.intShort],
  ['skillPerception', L.perception, L.wisShort],
  ['skillPerformance', L.performance, L.chaShort],
  ['skillPersuasion', L.persuasion, L.chaShort],
  ['skillReligion', L.religion, L.intShort],
  ['skillSlightOfHand', L.sleightOfHand, L.dexShort],
  ['skillStealth', L.stealth, L.dexShort],
  ['skillSurvival', L.survival, L.wisShort]
]

class DnDCharacterStatsSheet extends React.Component<
  IDnDCharacterStatsSheetProps,
  IDnDCharacterStatsSheetState
> {
  constructor(props: IDnDCharacterStatsSheetProps) {
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

  // text input bound to a character field
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

  // textarea bound to a character field
  textarea(character: DnDCharacter, name: string, rows: number, props: React.TextareaHTMLAttributes<HTMLTextAreaElement> = {}) {
    return (
      <textarea
        data-field={name}
        value={character[name] ? character[name] : ''}
        onChange={(e) => this.updateCharacter(name, e.target.value)}
        rows={rows}
        {...props}
      />
    )
  }

  // textarea whose known names (items, tools, weapons) are links
  linkedTextarea(character: DnDCharacter, name: string, field: LinkField, rows: number, props: React.TextareaHTMLAttributes<HTMLTextAreaElement> = {}) {
    return (
      <LinkedTextarea
        data-field={name}
        field={field}
        value={character[name] ? character[name] : ''}
        onChange={(e) => this.updateCharacter(name, e.target.value)}
        rows={rows}
        {...props}
      />
    )
  }

  render() {
    const character = this.getCharacter()
    const update = (name: string, value: any) => this.updateCharacter(name, value)

    const { hideAttacks, hideEquipment } = this.props
    // in the weapons' column it fills the column's height, so both lists grow
    const training = (fill: boolean) => (
      <div className='d-and-d-box'>
        <div className='d-and-d-subtitle'>{L.armorTraining}</div>
        <div className='d-and-d-check-row'>
          <Check name='armorLight' label={L.armorLight} checked={character.armorLight} onChange={update} />
          <Check name='armorMedium' label={L.armorMedium} checked={character.armorMedium} onChange={update} />
          <Check name='armorHeavy' label={L.armorHeavy} checked={character.armorHeavy} onChange={update} />
          <Check name='armorShields' label={L.armorShields} checked={character.armorShields} onChange={update} />
        </div>
        <div className='d-and-d-subtitle'>{L.weapons}</div>
        {this.textarea(character, 'weaponProficiencies', 2, fill ? { className: 'd-and-d-fill' } : {})}
        <div className='d-and-d-subtitle'>{L.tools}</div>
        {this.linkedTextarea(character, 'toolProficiencies', 'tools', 2, { className: 'd-and-d-fill' })}
        <label className='d-and-d-title' style={{ marginTop: '10px' }}>
          {L.equipmentTraining}
        </label>
      </div>
    )

    const headerCell = (name: string, label: string, width = 3) => (
      <div className={'col-md-' + width + ' col-6 pl-0 pr-0'}>
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
                  {headerCell('classLevel', L.classLevel)}
                  {headerCell('subclass', L.subclass)}
                  {headerCell('background', L.background)}
                  {headerCell('playerName', L.playerName)}
                </div>
                <div className='row pl-3 pr-3'>
                  {headerCell('species', L.species)}
                  {headerCell('size', L.size, 2)}
                  {headerCell('alignment', L.alignment, 4)}
                  {headerCell('xp', L.xp)}
                </div>
              </div>
            </div>
          </div>

          <div className='d-and-d-box gray d-and-d-abilities-row'>
            {ABILITIES.map(([name, label]) => (
              <Statbox
                key={name}
                label={label}
                name={name}
                value={character[name]}
                onChange={update}
              />
            ))}
          </div>

          <div className='row'>
            <div className='col-md-4'>
              <div className='d-and-d-box'>
                <div style={{ textAlign: 'left' }}>
                  {ABILITIES.map(([name, label]) => (
                    <Skill
                      key={name}
                      label={label}
                      name={name + 'Save'}
                      value={character[name + 'Save']}
                      checked={character[name + 'SaveChecked']}
                      onChange={update}
                    />
                  ))}
                </div>
                <label className='d-and-d-title' style={{ marginTop: '10px' }}>
                  {L.savingThrows}
                </label>
              </div>
              <div className='d-and-d-box'>
                <div style={{ textAlign: 'left' }}>
                  {SKILLS.map(([name, label, hint]) => (
                    <Skill
                      key={name}
                      label={label}
                      hint={'(' + hint + ')'}
                      name={name}
                      value={character[name]}
                      checked={character[name + 'Checked']}
                      onChange={update}
                    />
                  ))}
                </div>
                <label className='d-and-d-title' style={{ marginTop: '10px' }}>
                  {L.skills}
                </label>
              </div>
            </div>

            <div className='col-md-4 d-and-d-spread-column'>
              <div className='d-and-d-box gray'>
                <div className='row d-and-d-combat-stats'>
                  <div className='col-4 pr-2'>
                    <StatBox2
                      classes='shield'
                      label={L.armorClass}
                      name='ac'
                      value={character.ac}
                      onChange={update}
                    />
                  </div>
                  <div className='col-4 pr-2 pl-2'>
                    <StatBox2
                      label={L.initiative}
                      name='init'
                      value={character.init}
                      onChange={update}
                    />
                  </div>
                  <div className='col-4 pl-2'>
                    <StatBox2
                      label={L.speed}
                      name='speed'
                      value={character.speed}
                      onChange={update}
                    />
                  </div>
                </div>

                <div
                  className='d-and-d-box white'
                  style={{
                    borderRadius: '8px 8px 0 0',
                    marginBottom: '5px',
                    paddingBottom: '5px'
                  }}
                >
                  <div className='d-and-d-gray-text'>
                    <label style={{ width: '95px' }}>{L.hitPointMaximum}</label>
                    {this.input(character, 'maxHp', {
                      style: { width: 'calc(100% - 95px)' },
                      className: 'd-and-d-linput'
                    })}
                  </div>
                  {this.input(character, 'hp', { className: 'd-and-d-cinput' })}
                  <label className='d-and-d-title' style={{ marginTop: '5px' }}>
                    {L.currentHitPoints}
                  </label>
                </div>
                <div
                  className='d-and-d-box white mb-2'
                  style={{ borderRadius: '0 0 8px 8px', paddingBottom: '5px' }}
                >
                  {this.input(character, 'tempHp', { className: 'd-and-d-cinput' })}
                  <label className='d-and-d-title' style={{ marginTop: '5px' }}>
                    {L.temporaryHitPoints}
                  </label>
                </div>

                <div className='row mt-1'>
                  <div className='col-6 pr-1'>
                    <div
                      className='d-and-d-box white mb-0'
                      style={{ paddingBottom: '5px' }}
                    >
                      <div className='d-and-d-gray-text'>
                        <label style={{ width: '32px' }}>{L.hitDiceMax}</label>
                        {this.input(character, 'hitDiceMax', {
                          style: { width: 'calc(100% - 32px)' },
                          className: 'd-and-d-linput'
                        })}
                      </div>
                      {this.input(character, 'hitDice', { className: 'd-and-d-cinput' })}
                      <label className='d-and-d-title' style={{ marginTop: '5px' }}>
                        {L.hitDice}
                      </label>
                    </div>
                  </div>
                  <div className='col-6 pl-1'>
                    <div
                      className='d-and-d-box white mb-0'
                      style={{ paddingBottom: '5px' }}
                    >
                      <DeathSave
                        classes='d-and-d-save-success'
                        label={L.successes}
                        name='deathsaveSuccesses'
                        value={character.deathsaveSuccesses}
                        onChange={update}
                      />
                      <DeathSave
                        classes='d-and-d-save-failure'
                        label={L.failures}
                        name='deathsaveFailures'
                        value={character.deathsaveFailures}
                        onChange={update}
                      />
                      <label className='d-and-d-title' style={{ marginTop: '6px' }}>
                        {L.deathSaves}
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <StatRow
                label={L.heroicInspiration}
                name='inspiration'
                value={character.inspiration}
                onChange={update}
              />
              <StatRow
                classes='rounded'
                label={L.proficiencyBonus}
                name='proficiencyBonus'
                value={character.proficiencyBonus}
                onChange={update}
              />
              <StatRow
                classes='rounded rounded-sides'
                label={L.passivePerception}
                name='passivePerception'
                value={character.passivePerception}
                onChange={update}
              />
            </div>

            <div className='col-md-4 d-and-d-fill-column'>
              {hideAttacks ? (
                training(true)
              ) : (
                <div className='d-and-d-box'>
                  <AttackTable
                    rows={5}
                    name='attacks'
                    value={character.attacks}
                    onChange={update}
                  />
                  {this.linkedTextarea(character, 'attacksText', 'attackText', 3, { className: 'd-and-d-fill' })}
                  <label className='d-and-d-title' style={{ marginTop: '10px' }}>
                    {L.weaponsAndCantrips}
                  </label>
                </div>
              )}
            </div>
          </div>

          {!(hideAttacks && hideEquipment) && (
            <div className='row'>
              {!hideAttacks && <div className='col-md-4 d-and-d-fill-column'>{training(false)}</div>}

              {!hideEquipment && (
                <div className={(hideAttacks ? 'col-md-12' : 'col-md-8') + ' d-and-d-fill-column'}>
                  <div className='d-and-d-box'>
                    <div className='row d-and-d-fill'>
                      <div className='' style={{ width: '100px' }}>
                        {(['pp', 'gp', 'sp', 'cp'] as const).map((coin) => (
                          <Currency
                            key={coin}
                            label={L[coin]}
                            name={coin}
                            value={character[coin]}
                            onChange={update}
                          />
                        ))}
                      </div>
                      <div className='col'>
                        {this.linkedTextarea(character, 'equipment', 'equipment', 10, {
                          className: 'd-and-d-equipment-indent'
                        })}
                      </div>
                      <div className='col-md'>
                        {this.linkedTextarea(character, 'equipment2', 'equipment', 10)}
                      </div>
                    </div>
                    <label className='d-and-d-title' style={{ marginTop: '10px' }}>
                      {L.equipment}
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }
}

export default DnDCharacterStatsSheet
