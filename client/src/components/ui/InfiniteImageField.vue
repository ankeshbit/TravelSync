<template>
  <div
    ref="containerRef"
    :class="['relative w-full h-full overflow-hidden', className]"
    :style="style"
  >
    <canvas
      ref="canvasRef"
      class="block w-full h-full bg-transparent cursor-grab active:cursor-grabbing"
      @click="handleCanvasClick"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * InfiniteImageField — faithful Vue 3 port of Componentry InfiniteImageField
 * Source: packages/ui/src/components/infinite-image-field.tsx
 *
 * Implements a cursor-driven infinitely panning canvas grid displaying image cards,
 * with hit testing support to emit selected elements.
 *
 * // export from index.ts
 */
import { ref, onMounted, onUnmounted, watch } from 'vue'

const DEFAULT_IMAGES = [
  'https://plus.unsplash.com/premium_photo-1665311515452-a9f54c4266c9?w=400&h=560&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=560&fit=crop&q=80',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&h=560&fit=crop&q=80',
  'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=400&h=560&fit=crop&q=80',
  'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&h=560&fit=crop&q=80',
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&h=560&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=400&h=560&fit=crop&q=80',
  'https://images.unsplash.com/photo-1440342359743-84fcb8c21f21?w=400&h=560&fit=crop&q=80',
  'https://images.unsplash.com/photo-1511884642898-4c92249e20b6?w=400&h=560&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&h=560&fit=crop&q=80',
  'https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&h=560&fit=crop&q=80',
  'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?w=400&h=560&fit=crop&q=80',
]

interface Props {
  className?: string
  images?: string[]
  imageWidth?: number
  imageHeight?: number
  gap?: number
  maxSpeed?: number
  smoothing?: number
  borderRadius?: number
  style?: any
}

const props = withDefaults(defineProps<Props>(), {
  images: () => DEFAULT_IMAGES,
  imageWidth: 200,
  imageHeight: 280,
  gap: 28,
  maxSpeed: 5,
  smoothing: 0.07,
  borderRadius: 0,
  className: '',
})

const emit = defineEmits<{
  (e: 'select', url: string): void
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const loadedImages = ref<HTMLImageElement[]>([])
const dims = ref({ w: 0, h: 0 })
const cam = ref({ x: 0, y: 0 })
const vel = ref({ x: 0, y: 0 })
const mouse = ref({ x: 0.5, y: 0.5 })
const isInside = ref(false)

let rafId = 0
let resizeObserver: ResizeObserver | null = null

function preloadImages() {
  loadedImages.value = props.images.map((src) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = src
    return img
  })
}

watch(() => props.images, preloadImages, { immediate: true })

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const clampedR = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + clampedR, y)
  ctx.lineTo(x + w - clampedR, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + clampedR)
  ctx.lineTo(x + w, y + h - clampedR)
  ctx.quadraticCurveTo(x + w, y + h, x + w - clampedR, y + h)
  ctx.lineTo(x + clampedR, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - clampedR)
  ctx.lineTo(x, y + clampedR)
  ctx.quadraticCurveTo(x, y, x + clampedR, y)
  ctx.closePath()
}

function handleCanvasClick(e: MouseEvent) {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const clickX = e.clientX - rect.left
  const clickY = e.clientY - rect.top

  const { w: W, h: H } = dims.value
  const cellW = props.imageWidth + props.gap
  const cellH = props.imageHeight + props.gap
  const camX = cam.value.x
  const camY = cam.value.y
  const numImages = loadedImages.value.length
  if (numImages === 0) return

  // Calculate row and col of clicked cell
  const col = Math.round((clickX + camX - W / 2) / cellW)
  const row = Math.round((clickY + camY - H / 2) / cellH)

  // Top-left bounds of calculated cell
  const sx = col * cellW - camX + W / 2 - props.imageWidth / 2
  const sy = row * cellH - camY + H / 2 - props.imageHeight / 2

  // Check if click lands within the cell boundaries
  if (
    clickX >= sx &&
    clickX <= sx + props.imageWidth &&
    clickY >= sy &&
    clickY <= sy + props.imageHeight
  ) {
    const imgIdx = Math.abs(col * 7 + row * 13 + ((col * row * 3) | 0)) % numImages
    const selectedUrl = props.images[imgIdx]
    if (selectedUrl) {
      emit('select', selectedUrl)
    }
  }
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const { w: W, h: H } = dims.value
  if (W === 0 || H === 0) {
    rafId = requestAnimationFrame(draw)
    return
  }

  const dpr = window.devicePixelRatio || 1
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const cellW = props.imageWidth + props.gap
  const cellH = props.imageHeight + props.gap
  const imgs = loadedImages.value
  const numImages = imgs.length

  // Calculate velocity based on cursor distance from center
  const tx = isInside.value ? (mouse.value.x - 0.5) * 2 * props.maxSpeed : 0
  const ty = isInside.value ? (mouse.value.y - 0.5) * 2 * props.maxSpeed : 0

  vel.value.x += (tx - vel.value.x) * props.smoothing
  vel.value.y += (ty - vel.value.y) * props.smoothing

  cam.value.x += vel.value.x
  cam.value.y += vel.value.y

  const camX = cam.value.x
  const camY = cam.value.y

  ctx.clearRect(0, 0, W, H)

  // Compute visible columns and rows bounds
  const colMin = Math.floor((camX - W / 2) / cellW) - 1
  const colMax = Math.ceil((camX + W / 2) / cellW) + 1
  const rowMin = Math.floor((camY - H / 2) / cellH) - 1
  const rowMax = Math.ceil((camY + H / 2) / cellH) + 1

  for (let row = rowMin; row <= rowMax; row++) {
    for (let col = colMin; col <= colMax; col++) {
      const sx = col * cellW - camX + W / 2 - props.imageWidth / 2
      const sy = row * cellH - camY + H / 2 - props.imageHeight / 2

      // Deterministic hash to map grid coordinate to same image
      const imgIdx = Math.abs(col * 7 + row * 13 + ((col * row * 3) | 0)) % numImages
      const img = imgs[imgIdx]

      ctx.save()
      drawRoundedRect(ctx, sx, sy, props.imageWidth, props.imageHeight, props.borderRadius)
      ctx.clip()

      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, sx, sy, props.imageWidth, props.imageHeight)
      } else {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'
        ctx.fillRect(sx, sy, props.imageWidth, props.imageHeight)
      }
      ctx.restore()

      // Glass panel border overlay
      ctx.save()
      drawRoundedRect(ctx, sx, sy, props.imageWidth, props.imageHeight, props.borderRadius)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.restore()
    }
  }

  rafId = requestAnimationFrame(draw)
}

function handleResize() {
  const canvas = canvasRef.value
  if (!canvas) return
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  dims.value = { w: rect.width, h: rect.height }
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
}

function onMove(e: MouseEvent) {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  mouse.value = {
    x: (e.clientX - rect.left) / rect.width,
    y: (e.clientY - rect.top) / rect.height,
  }
}

function onTouchMove(e: TouchEvent) {
  if (e.touches.length > 0) {
    const touch = e.touches[0]
    const canvas = canvasRef.value
    if (touch && canvas) {
      const rect = canvas.getBoundingClientRect()
      mouse.value = {
        x: (touch.clientX - rect.left) / rect.width,
        y: (touch.clientY - rect.top) / rect.height,
      }
    }
  }
}

function onEnter() {
  isInside.value = true
}

function onLeave() {
  isInside.value = false
}

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return

  handleResize()
  resizeObserver = new ResizeObserver(handleResize)
  resizeObserver.observe(canvas)

  canvas.addEventListener('mousemove', onMove)
  canvas.addEventListener('mouseenter', onEnter)
  canvas.addEventListener('mouseleave', onLeave)
  canvas.addEventListener('touchstart', onEnter, { passive: true })
  canvas.addEventListener('touchmove', onTouchMove, { passive: true })
  canvas.addEventListener('touchend', onLeave)

  rafId = requestAnimationFrame(draw)
})

onUnmounted(() => {
  cancelAnimationFrame(rafId)
  resizeObserver?.disconnect()

  const canvas = canvasRef.value
  if (canvas) {
    canvas.removeEventListener('mousemove', onMove)
    canvas.removeEventListener('mouseenter', onEnter)
    canvas.removeEventListener('mouseleave', onLeave)
    canvas.removeEventListener('touchstart', onEnter)
    canvas.removeEventListener('touchmove', onTouchMove)
    canvas.removeEventListener('touchend', onLeave)
  }
})
</script>
