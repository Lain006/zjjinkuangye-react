import reliefUrl from './assets/earth-relief.webp'

type Surface = { width: number; height: number; pixels: Uint8ClampedArray }
let surface: Promise<Surface | null> | undefined

function loadSurface() {
  if (surface) return surface
  surface = new Promise<Surface | null>(resolve => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      const width = canvas.width = image.naturalWidth
      const height = canvas.height = image.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(null)
      ctx.drawImage(image, 0, 0)
      resolve({ width, height, pixels: ctx.getImageData(0, 0, width, height).data })
    }
    image.onerror = () => resolve(null)
    image.src = reliefUrl
  })
  return surface
}

export async function createGlobeRelief() {
  const map = await loadSurface()
  if (!map) return null
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  let size = 0
  let frame: ImageData
  let samples: Float32Array

  const prepare = (resolution: number) => {
    size = canvas.width = canvas.height = resolution
    frame = ctx.createImageData(size, size)
    samples = new Float32Array(size * size * 4)
    for (let row = 0; row < size; row++) {
      const y = 1 - (row + .5) * 2 / size
      for (let column = 0; column < size; column++) {
        const x = (column + .5) * 2 / size - 1
        const zSquared = 1 - x * x - y * y
        if (zSquared <= 0) continue
        const z = Math.sqrt(zSquared)
        const offset = (row * size + column) * 4
        // A fixed raking light illuminates the tilted specimen as it turns.
        const diffuse = Math.max(0, -.47 * x + .52 * y + .71 * z)
        samples.set([x, y, z, .48 + diffuse * .66], offset)
        frame.data[offset + 3] = 255
      }
    }
  }

  return (target: CanvasRenderingContext2D, cx: number, cy: number, radius: number, yaw: number, pitch: number) => {
    const resolution = radius > 155 ? 300 : 224
    if (size !== resolution) prepare(resolution)
    const sin = Math.sin(pitch)
    const cos = Math.cos(pitch)
    const radiansToColumn = map.width / (2 * Math.PI)
    const radiansToRow = map.height / Math.PI
    const heading = map.width * .5 - yaw * radiansToColumn
    for (let i = 0; i < samples.length; i += 4) {
      const z = samples[i + 2]
      if (!z) continue
      const x = samples[i]
      const y = samples[i + 1]
      const latitude = Math.asin(Math.max(-1, Math.min(1, y * cos + z * sin)))
      const longitude = Math.atan2(x, z * cos - y * sin)
      const column = (Math.floor(heading + longitude * radiansToColumn) + map.width * 2) % map.width
      const row = Math.min(map.height - 1, Math.floor(map.height * .5 - latitude * radiansToRow))
      const source = (row * map.width + column) * 4
      const light = samples[i + 3]
      frame.data[i] = map.pixels[source] * light
      frame.data[i + 1] = map.pixels[source + 1] * light
      frame.data[i + 2] = map.pixels[source + 2] * light
    }
    ctx.putImageData(frame, 0, 0)
    target.drawImage(canvas, cx - radius, cy - radius, radius * 2, radius * 2)
  }
}

export type GlobeRelief = NonNullable<Awaited<ReturnType<typeof createGlobeRelief>>>
