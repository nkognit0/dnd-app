import type { Roll } from '../wizard/state'

// Uniform integer in [1, sides] from the browser's cryptographic RNG
// (rejection sampling keeps every face equally likely).
export function rollDie(sides = 6): number {
  const limit = Math.floor(0x100000000 / sides) * sides
  const buf = new Uint32Array(1)
  for (;;) {
    crypto.getRandomValues(buf)
    if (buf[0] < limit) return (buf[0] % sides) + 1
  }
}

// 4d6, drop the lowest die.
export function rollAbility(die: () => number = rollDie): Roll {
  const dice = [die(), die(), die(), die()]
  const dropped = Math.min(...dice)
  const total = dice.reduce((s, d) => s + d, 0) - dropped
  return { dice, dropped, total }
}

// Six ability rolls, as the rules ask.
export function rollAbilityScores(die: () => number = rollDie): Roll[] {
  return Array.from({ length: 6 }, () => rollAbility(die))
}
