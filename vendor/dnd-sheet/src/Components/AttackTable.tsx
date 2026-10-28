import { DnDAttack } from '../DnDCharacter'
import L from '../labels'
import { LinkedInput } from '../links'

function AttackTable(props: {
  onChange: (arg0: any, arg1: any) => void
  name: string
  value?: DnDAttack[]
  classes?: string
  rows: number
}) {
  // copies rows so the character passed in props is never mutated
  function getValue(): DnDAttack[] {
    const value = (props.value || []).map((row) => ({ ...row }))
    while (value.length < props.rows) {
      value.push({})
    }
    return value
  }

  function updateValue(index: number, field: keyof DnDAttack, v: string) {
    const value = getValue()
    value[index][field] = v
    props.onChange(props.name, value)
  }

  let classes = 'd-and-d-table'
  if (props.classes) {
    classes += ' ' + props.classes
  }

  const cell = (v: DnDAttack, index: number, field: keyof DnDAttack) => (
    <td>
      {field === 'name' ? (
        // weapon and cantrip names open in the host app's reference
        <LinkedInput
          field='attack'
          value={v[field] || ''}
          title={v[field] ? v[field] : undefined}
          onChange={(e) => updateValue(index, field, e.target.value)}
        />
      ) : (
        <input
          type='text'
          value={v[field] ? v[field] : ''}
          title={v[field] ? v[field] : undefined}
          onChange={(e) => updateValue(index, field, e.target.value)}
        />
      )}
    </td>
  )

  return (
    <table className={classes} data-field={props.name}>
      <thead>
        <tr>
          <th style={{ width: '25%' }}>{L.attackName}</th>
          <th style={{ width: '25%' }}>{L.attackBonus}</th>
          <th style={{ width: '25%' }}>{L.attackDamage}</th>
          <th style={{ width: '25%' }}>{L.attackNotes}</th>
        </tr>
      </thead>
      <tbody>
        {getValue().map((v, index) => (
          <tr key={'d-and-d-table-row-' + props.name + index}>
            {cell(v, index, 'name')}
            {cell(v, index, 'bonus')}
            {cell(v, index, 'damage')}
            {cell(v, index, 'notes')}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default AttackTable
