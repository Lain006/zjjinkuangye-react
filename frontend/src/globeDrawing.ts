import landCoordinates from './globeLand.json'
import type { GlobeRelief } from './globeRelief'

const radians = Math.PI / 180
export const turn = 2 * Math.PI
export type Vector = [number, number, number]
export type Orientation = { yaw: number; pitch: number }
export type GlobePin = { label: string; vector: Vector }
export type Hit = { label: string; x: number; y: number }

export function globeVector(latitude: number, longitude: number): Vector {
  const lat = latitude * radians
  const lon = longitude * radians
  return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)]
}

export function faceRegion(latitude: number, longitude: number): Orientation {
  return { yaw: -longitude * radians, pitch: latitude * radians }
}

export function angleDistance(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

// Natural Earth v5.1.2 physical land, sampled on a Fibonacci sphere.
const land = new Float32Array(landCoordinates.length / 2 * 3)
for (let i = 0; i < landCoordinates.length; i += 2) {
  land.set(globeVector(landCoordinates[i] / 100, landCoordinates[i + 1] / 100), i / 2 * 3)
}

const meridians = Array.from({ length: 12 }, (_, i) =>
  Array.from({ length: 91 }, (_, step) => globeVector(step * 2 - 90, i * 30)))
const parallels = Array.from({ length: 9 }, (_, i) =>
  Array.from({ length: 181 }, (_, step) => globeVector(i * 15 - 60, step * 2)))

export function drawGlobe(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  orientation: Orientation,
  pins: GlobePin[],
  active: string,
  pulse: number,
  relief?: GlobeRelief,
): Hit[] {
  const radius = Math.min(width * .395, height * .42)
  const cx = width / 2
  const cy = height / 2
  const yawSin = Math.sin(orientation.yaw)
  const yawCos = Math.cos(orientation.yaw)
  const pitchSin = Math.sin(orientation.pitch)
  const pitchCos = Math.cos(orientation.pitch)
  const project = ([x, y, z]: Vector) => {
    const depth = z * yawCos - x * yawSin
    return {
      x: cx + radius * (x * yawCos + z * yawSin),
      y: cy - radius * (y * pitchCos - depth * pitchSin),
      z: y * pitchSin + depth * pitchCos,
    }
  }

  ctx.clearRect(0, 0, width, height)
  ctx.save()
  ctx.translate(cx + radius * .08, cy + radius * 1.04)
  ctx.scale(1, .19)
  const shadow = ctx.createRadialGradient(0, 0, radius * .18, 0, 0, radius * 1.22)
  shadow.addColorStop(0, '#17241b72')
  shadow.addColorStop(1, '#17241b00')
  ctx.fillStyle = shadow
  ctx.fillRect(-radius * 1.22, -radius * 1.22, radius * 2.44, radius * 2.44)
  ctx.restore()

  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, turn)
  const ocean = ctx.createRadialGradient(cx - radius * .34, cy - radius * .38, 0, cx, cy, radius * 1.14)
  ocean.addColorStop(0, '#467760')
  ocean.addColorStop(.52, '#295446')
  ocean.addColorStop(.84, '#132e2b')
  ocean.addColorStop(1, '#091c20')
  ctx.fillStyle = ocean
  ctx.fill()
  ctx.save()
  ctx.clip()
  relief?.(ctx, cx, cy, radius, orientation.yaw, orientation.pitch)

  for (const line of [...meridians, ...parallels]) {
    ctx.beginPath()
    let visible = false
    for (const point of line) {
      const p = project(point)
      if (p.z >= 0) {
        if (visible) ctx.lineTo(p.x, p.y)
        else ctx.moveTo(p.x, p.y)
      }
      visible = p.z >= 0
    }
    ctx.lineWidth = .65
    ctx.strokeStyle = line === parallels[4] ? '#dedfc768' : '#dedfc72b'
    ctx.stroke()
  }

  if (!relief) drawLandFallback(ctx, cx, cy, radius, yawSin, yawCos, pitchSin, pitchCos)
  ctx.restore()
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, turn)
  const rim = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius)
  rim.addColorStop(0, '#e6edd5bc')
  rim.addColorStop(.48, '#8caa91b3')
  rim.addColorStop(1, '#263f35bc')
  ctx.strokeStyle = rim
  ctx.lineWidth = 1.35
  ctx.stroke()

  const visiblePins = pins.map(pin => ({ ...pin, ...project(pin.vector) }))
    .filter(pin => pin.z > .025)
    .sort((a, b) => Number(a.label === active) - Number(b.label === active) || a.z - b.z)
  for (const pin of visiblePins) {
    const { x, y } = pin
    const selected = pin.label === active
    const ring = selected ? 9 + pulse * 16 : 7
    ctx.beginPath()
    const radialAngle = Math.atan2(y - cy, x - cx)
    ctx.ellipse(x, y, ring * Math.max(.34, pin.z), ring, radialAngle, 0, turn)
    ctx.strokeStyle = selected ? `rgba(255, 199, 123, ${.9 - pulse * .77})` : '#fff1c98c'
    ctx.lineWidth = 1
    ctx.stroke()
    const size = selected ? 4.9 : 3.3
    ctx.beginPath()
    ctx.arc(x, y, size + .75, 0, turn)
    ctx.fillStyle = '#152920'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x, y, size, 0, turn)
    const metal = ctx.createLinearGradient(x - size, y - size, x + size, y + size)
    metal.addColorStop(0, '#fff7cc')
    metal.addColorStop(.52, selected ? '#e3a465' : '#dfd9a1')
    metal.addColorStop(1, '#8f5c38')
    ctx.fillStyle = metal
    ctx.fill()
    if (!selected) continue

    ctx.font = '600 13px system-ui, sans-serif'
    const labelWidth = ctx.measureText(pin.label).width + 18
    const labelX = x + 33 + labelWidth <= width - 8 ? x + 30 : Math.max(8, x - 30 - labelWidth)
    const labelY = Math.max(18, y - 27)
    ctx.beginPath()
    ctx.moveTo(x + (x < labelX ? size + 2 : -size - 2), y - 2)
    ctx.lineTo(x < labelX ? labelX : labelX + labelWidth, labelY)
    ctx.strokeStyle = '#eed29e'
    ctx.stroke()
    ctx.fillStyle = '#f1e8cd'
    ctx.fillRect(labelX, labelY - 12, labelWidth, 24)
    ctx.strokeStyle = '#98784d'
    ctx.strokeRect(labelX, labelY - 12, labelWidth, 24)
    ctx.fillStyle = '#2c4437'
    ctx.textBaseline = 'middle'
    ctx.fillText(pin.label, labelX + 9, labelY)
  }
  return visiblePins
}

// Local map fallback when the relief image does not load.
function drawLandFallback(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number,
  yawSin: number, yawCos: number, pitchSin: number, pitchCos: number) {
  const bands = ['#6e9078', '#97b396', '#bdd1aa', '#ebdfae'].map(color => ({ color, path: new Path2D() }))
  for (let i = 0; i < land.length; i += 3) {
    const x = land[i] * yawCos + land[i + 2] * yawSin
    const depth = land[i + 2] * yawCos - land[i] * yawSin
    const y = land[i + 1] * pitchCos - depth * pitchSin
    const z = land[i + 1] * pitchSin + depth * pitchCos
    if (z <= 0) continue
    const light = Math.max(0, -.34 * x + .44 * y + .67 * z)
    const size = Math.max(.5, radius * (.003 + .0045 * z))
    bands[Math.min(3, Math.floor(light * 4.8))].path.rect(cx + radius * x, cy - radius * y, size, size)
  }
  for (const band of bands) {
    ctx.fillStyle = band.color
    ctx.fill(band.path)
  }
}
