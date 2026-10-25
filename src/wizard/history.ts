// Undo / redo for the wizards. Every change of the wizard's value is one step back,
// except typing: consecutive edits of the same text field merge into one step.
import { useCallback, useState } from 'react'

// a value the wizard had and the wizard step where it was changed
interface Entry<T> {
  value: T
  step: number
}

export interface History<T> {
  past: Entry<T>[]
  present: T
  future: Entry<T>[]
  // text field being typed into by the last change; the next edit of it merges
  typing: string | null
}

export const fresh = <T>(value: T): History<T> => ({ past: [], present: value, future: [], typing: null })

// a new value made at the given step; the same object means nothing changed
export function record<T>(h: History<T>, value: T, step: number, typing?: string): History<T> {
  if (value === h.present) return h
  if (typing && typing === h.typing) return { ...h, present: value, future: [] }
  return { past: [...h.past, { value: h.present, step }], present: value, future: [], typing: typing ?? null }
}

// undo / redo with the step where that change was made, or null when there is nothing to take
export function stepBack<T>(h: History<T>): [History<T>, number] | null {
  const e = h.past[h.past.length - 1]
  if (!e) return null
  return [{ past: h.past.slice(0, -1), present: e.value, future: [{ value: h.present, step: e.step }, ...h.future], typing: null }, e.step]
}

export function stepForward<T>(h: History<T>): [History<T>, number] | null {
  const e = h.future[0]
  if (!e) return null
  return [{ past: [...h.past, { value: h.present, step: e.step }], present: e.value, future: h.future.slice(1), typing: null }, e.step]
}

export function useHistory<T>(init: () => T) {
  const [h, setH] = useState<History<T>>(() => fresh(init()))

  const change = useCallback((fn: (prev: T) => T, step: number, typing?: string) => {
    setH((cur) => record(cur, fn(cur.present), step, typing))
  }, [])

  // both return the step to show: the one where the undone / redone change was made
  const move = (r: [History<T>, number] | null): number | null => {
    if (!r) return null
    setH(r[0])
    return r[1]
  }

  const clear = useCallback((value: T) => setH(fresh(value)), [])

  return {
    value: h.present,
    change,
    undo: () => move(stepBack(h)),
    redo: () => move(stepForward(h)),
    clear,
    canUndo: h.past.length > 0,
    canRedo: h.future.length > 0
  }
}
