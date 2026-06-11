<template>
  <div
    ref="containerRef"
    :class="['relative overflow-hidden', className]"
    :style="style"
  >
    <!-- Background Canvas -->
    <canvas
      ref="canvasRef"
      class="absolute inset-0 h-full w-full block"
      style="image-rendering: pixelated;"
    />

    <!-- Slot content layered on top -->
    <div v-if="$slots.default" class="relative z-10 h-full w-full">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * DitherGradient — faithful Vue 3 port of Componentry DitherGradient
 * Source: packages/ui/src/components/dither-gradient.tsx
 *
 * Renders an animated dithered gradient background on a 2D canvas using a
 * 4x4 Bayer matrix, optimized for performance by rendering at low resolution.
 *
 * // export from index.ts
 */
import { ref, onMounted, onUnmounted } from 'vue'

interface Props {
  className?: string
  style?: any
  colorFrom?: string
  colorTo?: string
  colorMid?: string
  intensity?: number
  speed?: number
  angle?: number
}

const props = withDefaults(defineProps<Props>(), {
  className: '',
  colorFrom: '#4f46e5',
  colorTo: '#ec4899',
  colorMid: '#a855f7',
  intensity: 0.15,
  speed: 3,
  angle: 45,
})

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

let animationFrameId = 0
let resizeObserver: ResizeObserver | null = null
let time = 0

const bayerMatrix = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return { r: 0, g: 0, b: 0 }
  return {
    r: parseInt(result[1]!, 16),
    g: parseInt(result[2]!, 16),
    b: parseInt(result[3]!, 16),
  }
}

function smoothstep(t: number) {
  return t * t * (3 - 2 * t)
}

function resize() {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  
  // Downscale canvas to maximum 192px width/height for retro pixelated look & 60fps performance
  const maxDim = 192
  const scale = Math.min(1, maxDim / Math.max(rect.width, rect.height || 1))
  canvas.width = Math.max(1, Math.round(rect.width * scale))
  canvas.height = Math.max(1, Math.round(rect.height * scale))
}

function animate() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const { width, height } = canvas
  const imageData = ctx.createImageData(width, height)
  const data = imageData.data

  const from = hexToRgb(props.colorFrom)
  const mid = hexToRgb(props.colorMid)
  const to = hexToRgb(props.colorTo)
  const rad = (props.angle * Math.PI) / 180

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const normalizedX = x / width
      const normalizedY = y / height
      const gradientPos =
        (normalizedX * Math.cos(rad) + normalizedY * Math.sin(rad)) * 0.8 +
        0.1 +
        Math.sin(time * props.speed * 0.0008) * 0.1
      const clampedPos = Math.max(0, Math.min(1, gradientPos))

      let r = 0, g = 0, b = 0
      if (clampedPos < 0.5) {
        const t = smoothstep(clampedPos * 2)
        r = from.r + (mid.r - from.r) * t
        g = from.g + (mid.g - from.g) * t
        b = from.b + (mid.b - from.b) * t
      } else {
        const t = smoothstep((clampedPos - 0.5) * 2)
        r = mid.r + (to.r - mid.r) * t
        g = mid.g + (to.g - mid.g) * t
        b = mid.b + (to.b - mid.b) * t
      }

      const threshold = (bayerMatrix[y % 4]![x % 4]! / 16 - 0.5) * props.intensity * 180
      const noise = (Math.random() - 0.5) * props.intensity * 60

      const idx = (y * width + x) * 4
      data[idx] = Math.min(255, Math.max(0, r + threshold + noise))
      data[idx + 1] = Math.min(255, Math.max(0, g + threshold + noise))
      data[idx + 2] = Math.min(255, Math.max(0, b + threshold + noise))
      data[idx + 3] = 255
    }
  }

  ctx.putImageData(imageData, 0, 0)
  time += 16

  animationFrameId = requestAnimationFrame(animate)
}

onMounted(() => {
  const canvas = canvasRef.value
  const container = containerRef.value
  if (!canvas || !container) return

  resize()
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container)

  animate()
})

onUnmounted(() => {
  cancelAnimationFrame(animationFrameId)
  resizeObserver?.disconnect()
})
</script>
