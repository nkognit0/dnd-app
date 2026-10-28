import React from 'react'

// A labelled circle that toggles a boolean field, styled like the skill circles.
function Check(props: {
  name: string
  checked?: boolean
  label: React.ReactNode
  onChange: (arg0: string, arg1: boolean) => void
}) {
  return (
    <div
      className='d-and-d-check'
      data-field={props.name}
      onClick={() => props.onChange(props.name, !props.checked)}
    >
      <div
        className={
          props.checked ? 'd-and-d-skill-circle active' : 'd-and-d-skill-circle'
        }
      />
      <label>{props.label}</label>
    </div>
  )
}

export default Check
