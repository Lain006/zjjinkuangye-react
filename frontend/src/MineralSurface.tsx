const contourFields = [
  { cx: 69, cy: 168, breadth: 137, depth: 94, count: 10, start: -.36, color: '#58795e' },
  { cx: 301, cy: 5, breadth: 142, depth: 80, count: 9, start: 1.52, color: '#66866b' },
  { cx: 291, cy: 197, breadth: 115, depth: 74, count: 6, start: -1.65, color: '#778c6d' },
]
const periods = [11.6, 13.2, 12.4, 14.8]
const fault = 'm-10 40 38-1 21 9 28-1 23 11 32-2 21 11 25-1 34 17 31 1 18 11 23-2 35 12 22 1 18 13 30-3 26 9'

// Precompute in the specimen's horizontal plane; the parent applies the same projection as the rock.
const contours = contourFields.flatMap(({ cx, cy, breadth, depth, count, start, color }, field) =>
  Array.from({ length: count }, (_, i) => {
    const size = (i + 1) / count
    const points = Array.from({ length: 80 }, (_, step) => {
      const a = start + step * Math.PI / 40
      const wobble = 1 + .095 * Math.sin(3 * a + size) + .063 * Math.cos(5 * a - size * 2)
      const x = cx + (1 - size) * 9 + size * breadth * Math.cos(a) * wobble
      const y = cy - (1 - size) * 8 + size * depth * Math.sin(a) * wobble
      return x.toFixed(1) + ' ' + y.toFixed(1)
    })
    const batch = (field + Math.floor(i / 3)) % periods.length
    const phase = (batch * .24 + (i % 3) * .055 + field * .08 + .15) % 1
    return { d: 'M' + points.join(' L') + ' Z', color, width: i % 4 === 0 ? 2.25 : 1.45, batch, phase }
  })
)

// Each fork begins on its own stem, and has its own reveal and withdrawal.
const branches = [
  ['M44 46 Q57 43 66 31 T98 15', 'M65 33 Q74 32 84 26'],
  ['M76 47 Q93 52 105 67 T138 86', 'M105 67 Q121 69 131 78'],
  ['M115 57 Q135 49 145 32 T174 13', 'M145 32 Q152 31 161 24'],
  ['M155 67 Q168 70 185 93 T224 121', 'M185 93 Q202 97 215 109'],
  ['M191 73 Q213 72 232 51 T264 34', 'M230 54 Q236 42 239 30'],
  ['M239 84 Q256 91 270 108 T305 132', 'M271 109 Q282 111 293 117'],
  ['M281 93 Q300 86 314 68 T351 47', 'M314 68 Q325 65 339 64'],
  ['M329 105 Q347 116 358 131 T387 148', 'M358 131 Q373 134 389 134'],
].flatMap(([stem, fork], i) => {
  const batch = i % periods.length
  const phase = .18 + i * .10
  return [stem, fork].map((d, part) => ({
    d, color: part ? '#738661' : '#577857', width: part ? 1.3 : 1.85,
    batch, phase: phase - part * .075,
  }))
})

function SurfaceLines({ lines }: { lines: typeof contours }) {
  return lines.map(({ d, color, width, batch, phase }) => (
    <path key={d} className="sample-vein-line" data-batch={batch} d={d} pathLength="1"
      fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"
      style={{ animationDuration: periods[batch] + 's', animationDelay: -phase * periods[batch] + 's' }} />
  ))
}

export function MineralSurface() {
  return <g data-ore-face="top" transform="matrix(1 .14 .92 -.49 64 150)">
    <rect width="395" height="195" fill="#cbd9af" stroke="#3f584b" strokeWidth="3" />
    <g clipPath="url(#spec-top)">
      <path d="M-30-35C40 13 25 63 98 71s135-30 192-4 110 37 146-18v-84Z" fill="#aac399" />
      <SurfaceLines lines={contours} />
      <path d={fault} fill="none" stroke="#e8e3bc" strokeWidth="7" />
      <path d={fault} fill="none" stroke="#987355" strokeWidth="1.5" />
      <SurfaceLines lines={branches} />
      <rect width="395" height="195" fill="url(#sample-fleck)" opacity=".22" />
    </g>
  </g>
}
