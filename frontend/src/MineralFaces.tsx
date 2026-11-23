import type { CSSProperties, ReactNode } from 'react'
import './mineralFaces.css'

const frontWidth = 395
const rightWidth = 195
const frontOutline = 'M0 0h395v123l-27 3-10-2-18 5-22-1-24 4-44-3-30 4-21-2-21 2-27-3-18 3-32-1-19-4-28 2-34-4-20 1Z'
const rightOutline = 'M0 0h195v121l-20 2-37-3-29 5-39-1-24 4-46-5Z'

const beds = {
  limestone: { wavelength: 167, amplitude: 4, seconds: 13, delay: -3, traceY: 11, ink: '#536f58' },
  greenstone: { wavelength: 224, amplitude: 4.3, seconds: 17, delay: -8, traceY: 57, ink: '#a8cbb0' },
  silt: { wavelength: 184, amplitude: 3.5, seconds: 15, delay: -1, traceY: 79, ink: '#eee2df' },
  copper: { wavelength: 201, amplitude: 5.8, seconds: 12, delay: -4, traceY: 87, ink: '#855138' },
  shale: { wavelength: 187, amplitude: 4.8, seconds: 16, delay: -9, traceY: 110, ink: '#635b71' },
} as const
type Bed = keyof typeof beds

// Draw the front and return as one unfolded strip. Identical, tangent-matched
// periods on either end let each bed slide through the corner without a splice.
function profilePaths(bed: Bed) {
  const { wavelength: w, amplitude: a } = beds[bed]
  let crest = `M${-w} 0`
  let inclusions = ''
  const cycles = Math.ceil((frontWidth + rightWidth) / w) + 2
  for (let cycle = -1; cycle < cycles - 1; cycle++) {
    const x = cycle * w
    crest += ` C${x + w * .12} 0 ${x + w * .17} ${a} ${x + w * .35} ${a}`
    crest += ` S${x + w * .60} ${-a} ${x + w * .74} ${-a} S${x + w * .91} 0 ${x + w} 0`
    inclusions += `M${x + w * .18} ${a * .62} q${w * .068} -1.8 ${w * .16} .5 q${-w * .087} .9 ${-w * .16} -.5Z `
    inclusions += `M${x + w * .70} ${-a} q${w * .032} -1.4 ${w * .095} .4 q${-w * .05} 1 ${-w * .095} -.4Z `
  }
  const trace = `M${w * .06} 0 C${w * .20} 0 ${w * .19} ${a} ${w * .35} ${a} S${w * .60} ${-a} ${w * .74} ${-a}`
  const offsets = Array.from({ length: cycles }, (_, index) => (index - 1) * w)
  return { bed, crest, below: crest + `v160H${-w}Z`, inclusions, trace, offsets }
}
const profiles = (Object.keys(beds) as Bed[]).map(profilePaths)

function Flow({ bed, children }: { bed: Bed; children: ReactNode }) {
  const { wavelength, seconds, delay, traceY, ink } = beds[bed]
  return <g className="ore-wave-motion" data-rock-layer={bed} style={{
    '--ore-distance': wavelength + 'px', animationDuration: seconds + 's', animationDelay: delay + 's',
  } as CSSProperties}>
    {children}
    <use className="ore-wave-trace" href={`#ore-${bed}-trace`} y={traceY} stroke={ink} />
  </g>
}

function CouplingSeam() {
  return <>
    <path d="M-2 48h24l11-9h19l8 9h15l8-6h14l7 6h20m126 0h13l10-8h13l9 8h20l13-13 12 2 8 9h14l7-6h10l7 4h11" fill="none" stroke="#a2eab3" strokeWidth="4" />
    <path d="M-2 54h26l11-8h14l8 9h17l8-6h13l6 6h21m128 0h16l10-7h9l10 6h19l15-13h8l8 9 17 1 9-5h6l9 4h11" fill="none" stroke="#87c797" strokeWidth="1.6" />
    {[0, 1, 2].map(index => <svg key={index} x={124 + 42 * index} y="27" width="42" height="42" viewBox="0 0 64 64" overflow="hidden">
      <rect width="64" height="64" fill={index === 0 ? '#a2eab3' : '#305640'} />
      <g className={'vein-turn vein-turn--' + (index + 1)} color={index === 0 ? '#214b39' : '#a2eab3'}><use href="#ore-seam" /></g>
    </svg>)}
  </>
}

function CutFace({ right }: { right: boolean }) {
  const face = right ? 'right' : 'front'
  const width = right ? rightWidth : frontWidth
  const outline = right ? rightOutline : frontOutline
  return <g data-ore-face={face} transform={right ? 'matrix(.92 -.49 0 1 459 205.3)' : 'matrix(1 .14 0 1 64 150)'}>
    <g clipPath={`url(#ore-cut-${face})`}>
      <rect width={width} height="140" fill={right ? '#aec1a1' : '#d4d7b7'} />
      <g transform={right ? `translate(${-frontWidth} 0)` : undefined}>
        <Flow bed="limestone">
          <use href="#ore-limestone-crest" y="8" fill="none" stroke="#92ab92" strokeWidth="3.1" />
          <use href="#ore-limestone-crest" y="15" fill="none" stroke="#637d62" strokeWidth="1.3" />
          <use href="#ore-limestone-inclusions" y="18" fill="#728971" />
          <use href="#ore-limestone-crest" y="24" fill="none" stroke="#758b6c" strokeWidth="2" />
        </Flow>
        <Flow bed="greenstone">
          <use href="#ore-greenstone-below" y="32" fill={right ? '#365f4c' : '#244438'} />
          <use href="#ore-greenstone-crest" y="36" fill="none" stroke="#85a484" strokeWidth="1" />
          <use href="#ore-greenstone-inclusions" y="40" fill="#96ba99" />
          {right && <use href="#ore-greenstone-crest" y="51" fill="none" stroke="#a4c4a2" strokeWidth="1.8" />}
          <use href="#ore-greenstone-crest" y="62" fill="none" stroke="#719476" strokeWidth="1.7" />
          <use href="#ore-greenstone-inclusions" y="66" fill="#67816e" />
        </Flow>
        <Flow bed="silt">
          <use href="#ore-silt-below" y="74" fill={right ? '#9d9aa8' : '#b8abb7'} />
          <use href="#ore-silt-crest" y="76" fill="none" stroke="#797984" strokeWidth="1.1" />
        </Flow>
        <Flow bed="copper">
          <use href="#ore-copper-crest" y="89" fill="none" stroke={right ? '#a77755' : '#cd8d60'} strokeWidth="12" />
          <use href="#ore-copper-inclusions" y="87" fill="#81573f" />
          <use href="#ore-copper-crest" y="92" fill="none" stroke={right ? '#e0bb89' : '#f8daa2'} strokeWidth="2.25" />
        </Flow>
        <Flow bed="shale">
          <use href="#ore-shale-crest" y="103" fill="none" stroke="#847b91" strokeWidth="6.4" />
          <use href="#ore-shale-inclusions" y="108" fill="#675f74" />
          <use href="#ore-shale-crest" y="114" fill="none" stroke={right ? '#bdb4b5' : '#efdbcd'} strokeWidth="2" />
          <use href="#ore-shale-crest" y="122" fill="none" stroke="#646c73" strokeWidth="1.7" />
        </Flow>
      </g>
      <rect width={width} height="140" fill={right ? 'url(#sample-hatch)' : 'url(#sample-fleck)'} opacity={right ? .50 : .24} />
      {!right && <CouplingSeam />}
    </g>
    <path d={outline} fill="none" stroke="#3c5146" strokeWidth="1.8" />
  </g>
}

export default function MineralFaces() {
  return <>
    <defs>
      <clipPath id="ore-cut-front"><path d={frontOutline} /></clipPath>
      <clipPath id="ore-cut-right"><path d={rightOutline} /></clipPath>
      {profiles.map(({ bed, crest, below, inclusions, trace, offsets }) => <g key={bed}>
        <path id={`ore-${bed}-crest`} d={crest} />
        <path id={`ore-${bed}-trace-stroke`} d={trace} pathLength="1" />
        <g id={`ore-${bed}-trace`}>
          {offsets.map(x => <use key={x} href={`#ore-${bed}-trace-stroke`} x={x} />)}
        </g>
        {(bed === 'greenstone' || bed === 'silt') && <path id={`ore-${bed}-below`} d={below} />}
        {bed !== 'silt' && <path id={`ore-${bed}-inclusions`} d={inclusions} />}
      </g>)}
    </defs>
    <CutFace right />
    <CutFace right={false} />
  </>
}
