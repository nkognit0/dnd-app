// Optional links inside sheet fields. The host app says which parts of a field's text are
// known names (find) and what happens on a click (open); the fields stay editable.
import React, { useContext, useLayoutEffect, useRef } from 'react'

export type LinkField = 'spell' | 'attack' | 'attackText' | 'equipment' | 'tools'
export interface LinkSpan { start: number; end: number }
export interface SheetLinks {
  find: (field: LinkField, text: string) => LinkSpan[]
  open: (field: LinkField, text: string, offset: number) => void
}

export const SheetLinksContext = React.createContext<SheetLinks | null>(null)

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { field: LinkField; value: string }

// A one-line field: blue when it holds a known name, a click opens it.
export function LinkedInput({ field, value, className, onClick, ...rest }: InputProps) {
  const links = useContext(SheetLinksContext)
  const linked = Boolean(links && value && links.find(field, value).length)
  return (
    <input
      type='text'
      {...rest}
      value={value}
      className={[className, linked ? 'd-and-d-link' : ''].filter(Boolean).join(' ') || undefined}
      onClick={(e) => {
        onClick?.(e)
        if (linked) links!.open(field, value, e.currentTarget.selectionStart ?? 0)
      }}
    />
  )
}

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { field: LinkField; value: string }

// the textarea styles the overlay has to repeat to put each letter in the same place
const COPIED = [
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'textIndent', 'textTransform',
  'paddingTop', 'paddingLeft', 'paddingBottom', 'tabSize', 'wordSpacing'
] as const

// A multi-line field whose known names are blue. The text is drawn by an overlay with the
// same metrics; the textarea under it keeps the caret, the selection and the editing.
export function LinkedTextarea({ field, value, className, style, onClick, onScroll, ...rest }: TextareaProps) {
  const links = useContext(SheetLinksContext)
  const area = useRef<HTMLTextAreaElement>(null)
  const overlay = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const ta = area.current
    const ov = overlay.current
    if (!ta || !ov) return
    const sync = () => {
      const cs = getComputedStyle(ta)
      for (const k of COPIED) (ov.style as unknown as Record<string, string>)[k] = cs[k]
      // a scrollbar narrows the text: the overlay loses the same width on the right
      const bars = ta.offsetWidth - ta.clientWidth - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth)
      ov.style.paddingRight = `${parseFloat(cs.paddingRight) + bars}px`
      ov.style.borderTop = `${cs.borderTopWidth} solid transparent`
      ov.style.borderLeft = `${cs.borderLeftWidth} solid transparent`
      ov.scrollTop = ta.scrollTop
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(ta)
    return () => ro.disconnect()
  })

  if (!links) {
    return <textarea {...rest} value={value} className={className} style={style} onClick={onClick} onScroll={onScroll} ref={area} />
  }

  const spans = links.find(field, value)
  const parts: React.ReactNode[] = []
  let at = 0
  spans.forEach((s, i) => {
    if (s.start > at) parts.push(value.slice(at, s.start))
    parts.push(<span key={i} className='d-and-d-link'>{value.slice(s.start, s.end)}</span>)
    at = s.end
  })
  parts.push(value.slice(at) + '​')

  return (
    <div className={['d-and-d-linked', className].filter(Boolean).join(' ')}>
      <textarea
        {...rest}
        ref={area}
        value={value}
        style={style}
        className='d-and-d-linked-input'
        onScroll={(e) => {
          onScroll?.(e)
          if (overlay.current) overlay.current.scrollTop = e.currentTarget.scrollTop
        }}
        onClick={(e) => {
          onClick?.(e)
          const ta = e.currentTarget
          if (ta.selectionStart === ta.selectionEnd) links.open(field, value, ta.selectionStart)
        }}
      />
      <div ref={overlay} className='d-and-d-linked-text' aria-hidden='true'>{parts}</div>
    </div>
  )
}
