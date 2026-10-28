// The little figure in the middle of the hero's places: a faceless mannequin in the site palette
// with a few marks of the species (ears, horns, a tail, a beard...) and its build. Drawn here,
// so it needs no third-party art.
import type { ReactNode } from 'react'

const FILL = '#E4E9F2'
const OUT = '#B6C1D5'
const MID = '#CBD3E1'
const DETAIL = '#737E8A'
const ACCENT = '#357ADE'

// a limb: an outlined capsule along the path
function Limb(props: { d: string; w: number; dash?: string }) {
  return (
    <>
      <path d={props.d} stroke={OUT} strokeWidth={props.w + 2} strokeLinecap='round' fill='none' />
      <path d={props.d} stroke={FILL} strokeWidth={props.w} strokeLinecap='round' fill='none' strokeDasharray={props.dash} />
    </>
  )
}

const shape = (d: string, fill = FILL) => <path d={d} fill={fill} stroke={OUT} strokeWidth={1.5} strokeLinejoin='round' />
// a shape on the left side and its mirror on the right
const pair = (d: string, fill = FILL) => (
  <>
    {shape(d, fill)}
    <g transform='translate(120 0) scale(-1 1)'>{shape(d, fill)}</g>
  </>
)

interface Look {
  // width and height of the build; the feet stay on the ground
  scale: [number, number]
  behind?: ReactNode
  beforeHead?: ReactNode
  afterHead?: ReactNode
  head?: 'round' | 'square'
  dashed?: boolean
  bigFeet?: boolean
}

const tail = (d: string, w: number) => <Limb d={d} w={w} />

const LOOKS: Record<string, Partial<Look>> = {
  human: {},
  elf: { scale: [0.88, 0.96], beforeHead: pair('M47 27 L35 15 L47 35 Z') },
  khoravar: { beforeHead: pair('M47 28 L40 21 L47 35 Z') },
  gnome: { scale: [0.74, 0.7], beforeHead: pair('M47 28 L39 21 L47 35 Z') },
  halfling: { scale: [0.8, 0.72], bigFeet: true },
  dwarf: {
    scale: [1.06, 0.78],
    afterHead: shape('M46 28 C45 50 50 70 60 82 C70 70 75 50 74 28 C70 37 65 41 60 41 C55 41 50 37 46 28 Z', MID)
  },
  orc: { scale: [1, 0.97], afterHead: pair('M52.5 43 L54 33 L57.5 43 Z', 'white') },
  goliath: {
    scale: [1.06, 1],
    afterHead: (
      <g stroke={DETAIL} strokeWidth={1.4} strokeLinecap='round'>
        <path d='M44 70 L48 82 M76 70 L72 82 M56 24 L58 30 M64 24 L62 30' />
      </g>
    )
  },
  tiefling: {
    behind: (
      <>
        {tail('M66 122 C92 138 100 170 88 196', 4)}
        {shape('M88 196 L82 204 L91 205 L95 197 Z', OUT)}
      </>
    ),
    afterHead: pair('M51 17 C45 12 42 4 47 -2 C47 6 50 11 56 14 Z', MID)
  },
  dragonborn: {
    scale: [1, 0.98],
    behind: tail('M64 120 C88 150 96 190 104 224', 9),
    afterHead: (
      <>
        {pair('M49 19 C42 13 37 7 35 0 C41 4 47 9 55 15 Z', MID)}
        {pair('M47 33 L38 38 L48 40 Z', MID)}
      </>
    )
  },
  aasimar: {
    behind: pair('M44 66 C22 40 6 46 2 78 C12 72 22 78 28 90 C30 80 36 74 44 78 Z', 'white'),
    afterHead: <ellipse cx={60} cy={6} rx={14} ry={4} fill='none' stroke={ACCENT} strokeWidth={2} opacity={0.6} />
  },
  hexblood: {
    afterHead: (
      <>
        {pair('M50 16 L47 4 L53 13 Z', MID)}
        {pair('M55 13 L54 1 L58 12 Z', MID)}
      </>
    )
  },
  dhampir: {
    behind: shape('M38 60 L24 176 L96 176 L82 60 Z', MID),
    beforeHead: pair('M38 66 C34 52 40 42 48 44 L49 58 Z', MID)
  },
  reborn: {
    afterHead: (
      <g stroke={DETAIL} strokeWidth={1.2} fill='none'>
        <path d='M45 80 L75 98' strokeDasharray='2 2' />
        <path d='M47 77 L45 82 M53 81 L51 86 M59 84 L57 89 M65 88 L63 93 M71 92 L69 97' />
        <path d='M53 22 L59 30' strokeDasharray='2 2' />
      </g>
    )
  },
  lupin: {
    behind: tail('M66 120 C88 136 92 160 84 182', 9),
    beforeHead: pair('M49 19 L45 1 L57 14 Z'),
    afterHead: <ellipse cx={60} cy={38} rx={7} ry={6} fill={MID} stroke={OUT} strokeWidth={1.5} />
  },
  shifter: {
    beforeHead: pair('M50 17 L47 6 L56 14 Z'),
    afterHead: <path d='M47 34 L51 40 M73 34 L69 40' stroke={DETAIL} strokeWidth={1.4} strokeLinecap='round' />
  },
  changeling: { dashed: true },
  kalashtar: {
    behind: <circle cx={60} cy={30} r={24} fill='none' stroke={ACCENT} strokeWidth={1.5} opacity={0.3} />,
    afterHead: <path d='M60 18 L63 23 L60 28 L57 23 Z' fill={ACCENT} opacity={0.8} />
  },
  warforged: {
    head: 'square',
    afterHead: (
      <g stroke={OUT} strokeWidth={1.5} fill={MID}>
        <circle cx={40} cy={64} r={7} />
        <circle cx={80} cy={64} r={7} />
        <path d='M46 76 L74 76 M48 98 L72 98' fill='none' />
        <path d='M52 28 L68 28' stroke={DETAIL} fill='none' />
      </g>
    )
  }
}

export function HeroFigure(props: { species?: string | null; small?: boolean }) {
  const look: Look = { scale: [0.94, 0.94], ...LOOKS[props.species || 'human'] }
  let [sx, sy] = look.scale
  // a Small hero of a Medium species
  if (props.small && sy > 0.8) {
    sx *= 0.8
    sy *= 0.76
  }
  const dash = look.dashed ? '3 2' : undefined
  const feet = look.bigFeet ? 10 : 8
  return (
    <svg viewBox='0 0 120 240' className='hero-figure-svg' aria-hidden='true'>
      <g transform={`translate(60 232) scale(${sx} ${sy}) translate(-60 -232)`}>
        {look.behind}
        <Limb d='M52 124 L49 220' w={14} dash={dash} />
        <Limb d='M68 124 L71 220' w={14} dash={dash} />
        <ellipse cx={47} cy={226} rx={feet} ry={4} fill={FILL} stroke={OUT} strokeWidth={1.5} />
        <ellipse cx={73} cy={226} rx={feet} ry={4} fill={FILL} stroke={OUT} strokeWidth={1.5} />
        <path
          d='M38 62 C38 56 46 54 60 54 C74 54 82 56 82 62 L78 100 C77 110 74 118 72 128 L48 128 C46 118 43 110 42 100 Z'
          fill={FILL}
          stroke={OUT}
          strokeWidth={1.5}
          strokeDasharray={dash}
        />
        <Limb d='M41 64 L29 130' w={11} dash={dash} />
        <Limb d='M79 64 L91 130' w={11} dash={dash} />
        <rect x={54} y={42} width={12} height={14} fill={FILL} stroke={OUT} strokeWidth={1.5} />
        {look.beforeHead}
        {look.head === 'square' ? (
          <rect x={46} y={12} width={28} height={34} rx={8} fill={FILL} stroke={OUT} strokeWidth={1.5} />
        ) : (
          <ellipse cx={60} cy={29} rx={14} ry={17} fill={FILL} stroke={OUT} strokeWidth={1.5} strokeDasharray={dash} />
        )}
        {look.afterHead}
      </g>
    </svg>
  )
}
