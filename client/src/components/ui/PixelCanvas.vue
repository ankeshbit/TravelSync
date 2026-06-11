<template>
  <div
    ref="containerRef"
    :class="['h-full w-full relative overflow-hidden', className]"
    v-bind="$attrs"
  >
    <canvas ref="canvasRef" class="block w-full h-full" />
  </div>
</template>

<script setup lang="ts">
/**
 * PixelCanvas — faithful Vue 3 port of Componentry PixelCanvas
 * Source: packages/ui/src/components/pixel-canvas.tsx
 *
 * Implements a 2D Canvas grid of pixel cells that light up and shimmer
 * based on pointer proximity and drift through a color array.
 *
 * // export from index.ts
 */
import { ref, onMounted, onUnmounted, useCallback } from 'vue'

interface Props {
  gap?: number
  speed?: number
  colors?: string[]
  noFocus?: boolean
  variant?: 'default' | 'trail' | 'glow'
  className?: string
}

const props = withDefaults(defineProps<Props>(), {
  gap: 6,
  speed: 0.02,
  colors: () => ['#e879f9', '#a78bfa', '#38bdf8', '#22d3ee'],
  noFocus: false,
  variant: 'default',
  className: '',
})

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

interface Pixel {
  x: number
  y: number
  size: number
  intensity: number
  targetIntensity: number
  colorPhase: number
}

const pixels = ref<Pixel[][]>([])
const mouse = ref({ x: -1000, y: -1000 })

let animationFrameId = 0
let lastTime = 0
let resizeObserver: ResizeObserver | null = null

// Helper to interpolate between two hex colors
function lerpColor(color1: string, color2: string, t: number): string {
  const c1 = hexToRgb(color1)
  const c2 = hexToRgb(color2)
  if (!c1 || !c2) return color1

  const r = Math.round(c1.r + (c2.r - c1.r) * t)
  const g = Math.round(c1.g + (c2.g - c1.g) * t)
  const b = Math.round(c1.b + (c2.b - c1.b) * t)
  return `rgb(${r}, ${g}, ${b})`
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1]!, 16),
        g: parseInt(result[2]!, 16),
        b: parseInt(result[3]!, 16),
      }
    : null
}

function getColorFromIntensity(intensity: number, phase: number): string {
  const colors = props.colors
  if (colors.length === 0) return '#ffffff'
  if (colors.length === 1) return colors[0]!

  const t = (phase + intensity) % 1
  const index = Math.floor(t * (colors.length - 1))
  const nextIndex = Math.min(index + 1, colors.length - 1)
  const localT = (t * (colors.length - 1)) % 1

  const color1 = colors[index]
  const color2 = colors[nextIndex]
  if (!color1) return '#ffffff'
  if (!color2) return color1

  return lerpColor(color1, color2, localT)
}

let cols = 0
let rows = 0
const pixelSize = Math.max(props.gap, 4)

function initPixels() {
  const canvas = canvasRef.value
  const container = containerRef.value
  if (!canvas || !container) return

  const rect = container.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  canvas.style.width = `${rect.width}px`
  canvas.style.height = `${rect.height}px`

  const ctx = canvas.getContext('2d')
  if (ctx) ctx.scale(dpr, dpr)

  cols = Math.ceil(rect.width / pixelSize)
  rows = Math.ceil(rect.height / pixelSize)

  const newPixels: Pixel[][] = []
  for (let i = 0; i < cols; i++) {
    const col: Pixel[] = []
    for (let j = 0; j < rows; j++) {
      const existing = pixels.value[i]?.[j]
      col.push({
        x: i * pixelSize,
        y: j * pixelSize,
        size: pixelSize - 1,
        intensity: existing?.intensity ?? 0,
        targetIntensity: 0,
        colorPhase: Math.random(),
      })
    }
    newPixels.push(col)
  }
  pixels.value = newPixels
}

function draw(timestamp: number) {
  const canvas = canvasRef.value
  const container = containerRef.value
  if (!canvas || !container) return

  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) return

  const deltaTime = timestamp - lastTime
  lastTime = timestamp

  const rect = container.getBoundingClientRect()
  ctx.clearRect(0, 0, rect.width, rect.height)

  const mouseX = mouse.value.x
  const mouseY = mouse.value.y

  const radius = props.variant === 'glow' ? 120 : 80
  const glowPasses = props.variant === 'glow' ? 2 : 1

  for (let i = 0; i < cols; i++) {
    const col = pixels.value[i]
    if (!col) continue
    for (let j = 0; j < rows; j++) {
      const pixel = col[j]
      if (!pixel) continue

      const centerX = pixel.x + pixel.size / 2
      const centerY = pixel.y + pixel.size / 2
      const dx = mouseX - centerX
      const dy = mouseY - centerY
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance < radius) {
        const falloff = 1 - distance / radius
        pixel.targetIntensity = Math.pow(falloff, 1.5)
      } else {
        pixel.targetIntensity = 0
      }

      const lerpSpeed = pixel.targetIntensity > pixel.intensity ? 0.3 : props.speed
      pixel.intensity += (pixel.targetIntensity - pixel.intensity) * lerpSpeed
      pixel.colorPhase = (pixel.colorPhase + 0.001 * (deltaTime / 16)) % 1

      if (pixel.intensity > 0.01) {
        const color = getColorFromIntensity(pixel.intensity, pixel.colorPhase)

        if (props.variant === 'glow' && pixel.intensity > 0.2) {
          for (let g = glowPasses; g > 0; g--) {
            const glowSize = pixel.size + g * 4
            const glowOffset = (glowSize - pixel.size) / 2
            ctx.globalAlpha = (pixel.intensity * 0.15) / g
            ctx.fillStyle = color
            ctx.fillRect(
              pixel.x - glowOffset,
              pixel.y - glowOffset,
              glowSize,
              glowSize
            )
          }
        }

        ctx.globalAlpha = pixel.intensity * 0.9
        ctx.fillStyle = color

        if (props.variant === 'trail') {
          const cornerRadius = pixel.size * 0.3
          ctx.beginPath()
          ctx.roundRect(pixel.x, pixel.y, pixel.size, pixel.size, cornerRadius)
          ctx.fill()
        } else {
          ctx.fillRect(pixel.x, pixel.y, pixel.size, pixel.size)
        }
      }
    }
  }

  ctx.globalAlpha = 1
  animationFrameId = requestAnimationFrame(draw)
}

function onMouseMove(e: MouseEvent) {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  mouse.value = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  }
}

function onMouseLeave() {
  mouse.value = { x: -1000, y: -1000 }
}

function onTouchMove(e: TouchEvent) {
  if (e.touches.length > 0) {
    const touch = e.touches[0]
    const canvas = canvasRef.value
    if (touch && canvas) {
      const rect = canvas.getBoundingClientRect()
      mouse.value = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      }
    }
  }
}

onMounted(() => {
  const container = containerRef.value
  if (!container) return

  initPixels()
  lastTime = performance.now()
  animationFrameId = requestAnimationFrame(draw)

  resizeObserver = new ResizeObserver(initPixels)
  resizeObserver.observe(container)

  if (!props.noFocus) {
    container.addEventListener('mousemove', onMouseMove)
    container.addEventListener('mouseleave', onMouseLeave)
    container.addEventListener('touchmove', onTouchMove, { passive: true })
    container.addEventListener('touchend', onMouseLeave)
  }
})

onUnmounted(() => {
  cancelAnimationFrame(animationFrameId)
  resizeObserver?.disconnect()

  const container = containerRef.value
  if (container) {
    container.removeEventListener('mousemove', onMouseMove)
    container.removeEventListener('mouseleave', onMouseLeave)
    container.removeEventListener('touchmove', onTouchMove)
    container.removeEventListener('touchend', onMouseLeave)
  }
})
</script>
