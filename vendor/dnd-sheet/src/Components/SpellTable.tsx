import React from 'react'
import { DnDSpell } from '../DnDCharacter'
import L from '../labels'
import { LinkedInput } from '../links'

function SpellTable(props: {
  onChange: (arg0: any, arg1: any) => void
  name: string
  slotsName?: string
  slotsUsedName?: string
  level: number
  value?: DnDSpell[]
  slotsValue?: string
  slotsUsedValue?: number
  classes?: string
  rows: number
  showLabels?: boolean
  style?: React.CSSProperties | undefined
}) {
  // copies rows so the character passed in props is never mutated
  function getValue(): DnDSpell[] {
    const value = (props.value || []).map((row) => ({ ...row }))
    while (value.length < props.rows) {
      value.push({})
    }
    return value
  }

  function updateValue(index: number, field: keyof DnDSpell, v: string | boolean) {
    const value = getValue()
    if (field === 'prepared') {
      value[index].prepared = v as boolean
    } else {
      value[index].name = v as string
    }
    props.onChange(props.name, value)
  }

  function renderSlotsRemaining() {
    let slotCount = 6
    if (props.slotsValue != null && props.slotsValue !== '' && !isNaN(Number(props.slotsValue))) {
      slotCount = Number(props.slotsValue)
    }

    const slots = []
    for (let i1 = 1; i1 <= slotCount; i1++) {
      slots.push(
        <div
          key={'d-and-d-table-slot-' + props.name + i1}
          className={
            props.slotsUsedValue && props.slotsUsedValue >= i1
              ? 'd-and-d-skill-circle active'
              : 'd-and-d-skill-circle'
          }
          onClick={() =>
            props.onChange(
              props.slotsUsedName,
              props.slotsUsedValue === i1 ? null : i1
            )
          }
        />
      )
    }

    return slots
  }

  let classes = 'd-and-d-spelllist'
  if (props.classes) {
    classes += ' ' + props.classes
  }

  return (
    <div className={classes} style={props.style} data-field={props.name}>
      {props.showLabels ? (
        <div className='d-and-d-spell-header-labels'>
          <label style={{ width: '20px' }}>{L.spellLevel}</label>
          <label style={{ width: '80px' }}>{L.slotsTotal}</label>
          <label style={{ width: 'calc(100% - 100px)' }}>{L.slotsExpended}</label>
        </div>
      ) : null}
      <div className='d-and-d-spell-header'>
        <div className='d-and-d-spell-level'>{props.level}</div>
        {props.level === 0 ? (
          <div className='d-and-d-spell-slots'>
            <label>{L.cantrips}</label>
          </div>
        ) : (
          <div className='d-and-d-spell-slots'>
            <div className='d-and-d-spell-slots-total' data-field={props.slotsName}>
              <input
                type='text'
                value={props.slotsValue ? props.slotsValue : ''}
                onChange={(e) =>
                  props.onChange(props.slotsName, e.target.value)
                }
              />
            </div>
            <div className='d-and-d-spell-slots-remaining'>
              {renderSlotsRemaining()}
            </div>
          </div>
        )}
      </div>

      <table>
        {props.showLabels ? (
          <thead>
            <tr>
              <th style={{ width: '30px', position: 'absolute', left: '-7px' }}>
                {L.prepared}
              </th>
              <th>{L.spellName}</th>
            </tr>
          </thead>
        ) : null}
        <tbody>
          {getValue().map((v, index) => (
            <tr key={'d-and-d-table-row-' + props.name + index}>
              {props.level > 0 ? (
                <td className='d-and-d-spell-prepared'>
                  <div
                    className={
                      v.prepared
                        ? 'd-and-d-skill-circle active'
                        : 'd-and-d-skill-circle'
                    }
                    onClick={() => updateValue(index, 'prepared', !v.prepared)}
                  />
                </td>
              ) : null}
              <td>
                <LinkedInput
                  field='spell'
                  value={v.name ? v.name : ''}
                  onChange={(e) => updateValue(index, 'name', e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default SpellTable
