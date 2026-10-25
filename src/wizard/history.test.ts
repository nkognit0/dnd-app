import { describe, expect, it } from 'vitest'
import { fresh, record, stepBack, stepForward } from './history'

describe('wizard history', () => {
  it('undoes and redoes every change, opening the step where it was made', () => {
    let h = fresh({ cls: null as string | null, bg: null as string | null })
    h = record(h, { cls: 'fighter', bg: null }, 0)
    h = record(h, { cls: 'fighter', bg: 'sage' }, 1)

    const [h1, s1] = stepBack(h)!
    expect(h1.present).toEqual({ cls: 'fighter', bg: null })
    expect(s1).toBe(1)
    const [h2, s2] = stepBack(h1)!
    expect(h2.present).toEqual({ cls: null, bg: null })
    expect(s2).toBe(0)
    expect(stepBack(h2)).toBeNull()

    const [h3, s3] = stepForward(h2)!
    expect(h3.present).toEqual({ cls: 'fighter', bg: null })
    expect(s3).toBe(0)
    const [h4] = stepForward(h3)!
    expect(h4.present).toEqual({ cls: 'fighter', bg: 'sage' })
    expect(stepForward(h4)).toBeNull()
  })

  it('records nothing when the value did not change', () => {
    const h = record(fresh({ a: 1 }), { a: 2 }, 0)
    expect(record(h, h.present, 3)).toBe(h)
  })

  it('merges typing into one field, but not two fields or two dropdown picks', () => {
    let h = fresh({ name: '', bonds: '' })
    for (const name of ['Э', 'Эд', 'Эдм']) h = record(h, { ...h.present, name }, 10, 'personality:name')
    expect(h.past).toHaveLength(1)
    h = record(h, { ...h.present, bonds: 'М' }, 10, 'personality:bonds')
    expect(h.past).toHaveLength(2)
    expect(stepBack(stepBack(h)![0])![0].present).toEqual({ name: '', bonds: '' })

    let d = fresh({ cls: '' })
    d = record(d, { cls: 'fighter' }, 0)
    d = record(d, { cls: 'wizard' }, 0)
    expect(d.past).toHaveLength(2)
  })

  it('drops the redo branch on a new change and starts a new edit after undo', () => {
    let h = fresh({ name: '' })
    h = record(h, { name: 'А' }, 10, 'personality:name')
    h = stepBack(h)![0]
    h = record(h, { name: 'Б' }, 10, 'personality:name')
    expect(h.future).toHaveLength(0)
    expect(h.past).toHaveLength(1)
    expect(stepForward(h)).toBeNull()
  })
})
