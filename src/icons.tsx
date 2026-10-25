// Small line icons for square buttons (24×24 grid, drawn with the current text colour).
const PATHS = {
  upload: ['M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2', 'M12 15V4', 'M7 9l5-5 5 5'],
  download: ['M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2', 'M12 4v11', 'M7 10l5 5 5-5'],
  print: [
    'M7 9V3h10v6',
    'M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2',
    'M7 14h10v7H7z'
  ],
  trash: ['M4 7h16', 'M10 11v6', 'M14 11v6', 'M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12', 'M9 7V4h6v3'],
  undo: ['M9 14L4 9l5-5', 'M4 9h11a5 5 0 0 1 0 10h-3'],
  redo: ['M15 14l5-5-5-5', 'M20 9H9a5 5 0 0 0 0 10h3']
}

export type IconName = keyof typeof PATHS

export function Icon(props: { name: IconName; size?: number }) {
  const size = props.size ?? 18
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.8}
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      {PATHS[props.name].map((d) => <path key={d} d={d} />)}
    </svg>
  )
}
