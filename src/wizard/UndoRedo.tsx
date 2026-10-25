// Undo and redo buttons next to "Назад" / "Далее" in both wizards.
import { ActionIcon, Group } from '@mantine/core'
import { Icon } from '../icons'

export function UndoRedo(props: { canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void }) {
  return (
    <Group gap='xs'>
      <ActionIcon variant='default' size='input-sm' disabled={!props.canUndo} onClick={props.onUndo} aria-label='Отменить' title='Отменить'>
        <Icon name='undo' />
      </ActionIcon>
      <ActionIcon variant='default' size='input-sm' disabled={!props.canRedo} onClick={props.onRedo} aria-label='Повторить' title='Повторить'>
        <Icon name='redo' />
      </ActionIcon>
    </Group>
  )
}
