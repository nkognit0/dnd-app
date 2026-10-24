// Thin wrappers around Mantine inputs with the wizard's conventions:
// one value -> Select, several -> MultiSelect with a limit, nothing to choose -> disabled field.
import { useState } from 'react'
import { MultiSelect, Pill, PillsInput, Select, Text, TextInput } from '@mantine/core'
import type { ComboboxData, ComboboxItem, ComboboxLikeRenderOptionInput } from '@mantine/core'

// hint: shown next to the option in the dropdown, but not in the chosen value
export type Option = { value: string; label: string; hint?: string }

const nothingFound = 'Ничего не найдено'

function renderOption({ option }: ComboboxLikeRenderOptionInput<ComboboxItem>) {
  const hint = (option as Option).hint
  if (!hint) return option.label
  return (
    <span>
      {option.label}{' '}
      <Text span size='xs' c='dimmed'>
        {hint}
      </Text>
    </span>
  )
}

export function Pick(props: {
  label: string
  data: ComboboxData
  value: string | null
  onChange: (v: string | null) => void
  description?: string
  placeholder?: string
  disabled?: boolean
  searchable?: boolean
}) {
  return (
    <Select
      label={props.label}
      description={props.description}
      placeholder={props.placeholder ?? 'Выберите'}
      data={props.data}
      value={props.value}
      onChange={props.onChange}
      disabled={props.disabled}
      searchable={props.searchable ?? true}
      spellCheck={false}
      // typing replaces the chosen value instead of being appended to it
      onFocus={(e) => e.currentTarget.select()}
      onMouseUp={(e) => e.preventDefault()}
      selectFirstOptionOnChange
      allowDeselect={false}
      nothingFoundMessage={nothingFound}
      maxDropdownHeight={280}
      renderOption={renderOption}
    />
  )
}

export function PickMany(props: {
  label: string
  data: ComboboxData
  value: string[]
  onChange: (v: string[]) => void
  max: number
  description?: string
  disabled?: boolean
}) {
  const [opened, setOpened] = useState(false)
  const left = props.max - props.value.length
  if (props.max === 1) {
    return (
      <Pick
        label={props.label}
        description={props.description}
        data={props.data}
        value={props.value[0] ?? null}
        onChange={(v) => props.onChange(v ? [v] : [])}
        disabled={props.disabled}
      />
    )
  }
  return (
    <MultiSelect
      label={props.label}
      description={props.description ?? (left > 0 ? `Выберите ещё ${left} из ${props.max}` : `Выбрано ${props.max} из ${props.max}`)}
      placeholder={left > 0 ? 'Выберите' : undefined}
      data={props.data}
      value={props.value}
      onChange={(v) => {
        props.onChange(v)
        if (v.length >= props.max) setOpened(false)
      }}
      // a full list has nothing to add, so its dropdown stays closed until a value is removed
      dropdownOpened={opened}
      onDropdownOpen={() => setOpened(left > 0)}
      onDropdownClose={() => setOpened(false)}
      maxValues={props.max}
      disabled={props.disabled}
      searchable
      spellCheck={false}
      selectFirstOptionOnChange
      hidePickedOptions
      nothingFoundMessage={nothingFound}
      maxDropdownHeight={280}
      renderOption={renderOption}
    />
  )
}

// A value that follows from earlier choices: shown, but not editable.
export function Fixed(props: { label: string; value: string | string[]; description?: string }) {
  const values = Array.isArray(props.value) ? props.value : [props.value]
  if (values.length > 1) {
    return (
      <PillsInput label={props.label} description={props.description} disabled>
        <Pill.Group>
          {values.map((v) => (
            <Pill key={v}>{v}</Pill>
          ))}
        </Pill.Group>
      </PillsInput>
    )
  }
  return <TextInput label={props.label} description={props.description} value={values[0] || '—'} disabled readOnly />
}

export const options = <T,>(list: T[], value: (x: T) => string, label: (x: T) => string): Option[] =>
  list.map((x) => ({ value: value(x), label: label(x) }))
