import type { Derived } from '../../rules/derive'
import type { StepKey, WizardState } from '../state'

export interface StepProps {
  s: WizardState
  d: Derived
  // typing: the change comes from a text field, so undo takes back the whole edit of it at once
  set: <K extends StepKey>(key: K, patch: Partial<WizardState[K]>, typing?: boolean) => void
}

export const ARMOR_RU: Record<string, string> = {
  light: 'Лёгкие доспехи',
  medium: 'Средние доспехи',
  heavy: 'Тяжёлые доспехи',
  shield: 'Щиты'
}

const UNIT_RU: Record<string, string> = { cp: 'мм', sp: 'см', gp: 'зм', pp: 'пм' }

export function price(cost: { amount: number; unit: string } | null | undefined): string {
  if (!cost) return 'нет цены'
  return `${cost.amount.toLocaleString('ru-RU')} ${UNIT_RU[cost.unit] || cost.unit}`
}

export function moneyCp(cp: number): string {
  const sign = cp < 0 ? '−' : ''
  const v = Math.abs(cp)
  const parts = [] as string[]
  if (Math.floor(v / 100)) parts.push(Math.floor(v / 100) + ' зм')
  if (Math.floor((v % 100) / 10)) parts.push(Math.floor((v % 100) / 10) + ' см')
  if (v % 10) parts.push((v % 10) + ' мм')
  return sign + (parts.join(' ') || '0 зм')
}
