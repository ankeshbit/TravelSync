<template>
  <div
    ref="containerRef"
    :class="['relative isolate z-0 flex h-full w-full items-center justify-center overflow-hidden', className]"
    :style="{
      '--image-width': `${imageWidth}px`,
      '--image-height': `${imageHeight}px`,
      ...style,
    }"
  >
    <!-- Slot content layered on top -->
    <div v-if="$slots.default" class="relative z-10 w-full h-full">
      <slot />
    </div>

    <!-- Trail Images -->
    <img
      v-for="(img, idx) in trailImages"
      :key="idx"
      :src="img.url"
      class="pointer-events-none absolute top-0 left-0 h-[var(--image-height)] w-[var(--image-width)] object-cover opacity-0 will-change-transform"
      :style="{
        opacity: img.opacity,
        zIndex: img.zIndex,
        transform: `translate3d(${img.x}px, ${img.y + img.translateY}px, 0)`,
      }"
      alt="trail element"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * ImageTrail — faithful Vue 3 port of Componentry ImageTrail
 * Source: packages/ui/src/components/image-trail.tsx
 *
 * Implements a cursor trail of images that spawn and drop off-screen
 * with custom transition easing solved inside rAF to replace GSAP.
 *
 * // export from index.ts
 */
import { ref, onMounted, onUnmounted, watch } from 'vue'

interface Props {
  images: string[]
  imageWidth?: number
  imageHeight?: number
  threshold?: number
  duration?: number
  className?: string
  style?: any
}

const props = withDefaults(defineProps<Props>(), {
  images: () => [],
  imageWidth: 200,
  imageHeight: 200,
  threshold: 50,
  duration: 1.6,
  className: '',
})

interface TrailState {
  url: string
  x: number
  y: number
  opacity: number
  zIndex: number
  translateY: number
  startX: number
  startY: number
  targetX: number
  targetY: number
  animating: boolean
  startTime: number
}

const containerRef = ref<HTMLDivElement | null>(null)
const trailImages = ref<TrailState[]>([])

const mousePos = ref({ x: 0, y: 0 })
const cacheMousePos = ref({ x: 0, y: 0 })
const lastMousePos = ref({ x: 0, y: 0 })
const zIndexVal = ref(1)
const imgPosition = ref(0)
const parentSize = ref({ width: 0, height: 0 })

function initTrail() {
  trailImages.value = props.images.map((url) => ({
    url,
    x: 0,
    y: 0,
    opacity: 0,
    zIndex: 1,
    translateY: 0,
    startX: 0,
    startY: 0,
    targetX: 0,
    targetY: 0,
    animating: false,
    startTime: 0,
  }))
}

watch(() => props.images, initTrail, { immediate: true })

function calcParentSize() {
  const rect = containerRef.value?.getBoundingClientRect()
  if (rect) {
    parentSize.current = { width: rect.width, height: rect.height }
  }
}

function handleMouseMove(e: MouseEvent) {
  const rect = containerRef.value?.getBoundingClientRect()
  if (rect) {
    mousePos.value = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }
}

// ─── Mathematical Easing Curves ────────────────────────────────────────────────

function lerp(a: number, b: number, n: number) {
  return (1 - n) * a + n * b
}

function easeOutExpo(x: number): number {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x)
}

function easeOutQuad(x: number): number {
  return 1 - (1 - x) * (1 - x)
}

function easeInOutQuint(x: number): number {
  return x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2
}

// ─── Physics & Animation Update Loop ──────────────────────────────────────────

let rafId = 0

function showNextImage() {
  if (trailImages.value.length === 0) return

  const idx = imgPosition.value
  const img = trailImages.value[idx]
  if (!img) return

  zIndexVal.value += 1
  imgPosition.value = (imgPosition.value + 1) % trailImages.value.length

  const startX = cacheMousePos.value.x - props.imageWidth / 2
  const startY = cacheMousePos.value.y - props.imageHeight / 2
  const targetX = mousePos.value.x - props.imageWidth / 2
  const targetY = mousePos.value.y - props.imageHeight / 2

  img.animating = true
  img.startTime = performance.now()
  img.startX = startX
  img.startY = startY
  img.targetX = targetX
  img.targetY = targetY
  img.x = startX
  img.y = startY
  img.translateY = 0
  img.opacity = 1
  img.zIndex = zIndexVal.value
}

function renderImages(time: number) {
  // LERP trailing position towards actual cursor position
  cacheMousePos.value.x = lerp(cacheMousePos.value.x, mousePos.value.x, 0.1)
  cacheMousePos.value.y = lerp(cacheMousePos.value.y, mousePos.value.y, 0.1)

  // Distance trigger check
  const dx = mousePos.value.x - lastMousePos.value.x
  const dy = mousePos.value.y - lastMousePos.value.y
  const distance = Math.hypot(dx, dy)

  if (distance > props.threshold) {
    showNextImage()
    lastMousePos.value = { ...mousePos.value }
  }

  // Update active image trajectories
  trailImages.value.forEach((img) => {
    if (!img.animating) return

    const elapsed = (time - img.startTime) / 1000
    const duration = props.duration

    // Phase 1: Slide to target position
    const t1 = Math.min(elapsed / duration, 1)
    const pT = easeOutExpo(t1)
    img.x = lerp(img.startX, img.targetX, pT)
    img.y = lerp(img.startY, img.targetY, pT)

    // Phase 2: Fade and Fall translation
    const fadeDelay = Math.max(0.2, duration - 1.0)
    if (elapsed > fadeDelay) {
      const t2 = Math.min((elapsed - fadeDelay) / 1.0, 1) // 1.0s to complete fall/fade
      img.opacity = 1.0 - easeOutQuad(t2)
      img.translateY = easeInOutQuint(t2) * (parentSize.current.height + props.imageHeight / 2)
      
      if (t2 >= 1) {
        img.animating = false
        img.opacity = 0
      }
    }
  })

  rafId = requestAnimationFrame(renderImages)
}

onMounted(() => {
  calcParentSize()
  window.addEventListener('resize', calcParentSize)
  window.addEventListener('mousemove', handleMouseMove)
  rafId = requestAnimationFrame(renderImages)
})

onUnmounted(() => {
  cancelAnimationFrame(rafId)
  window.removeEventListener('resize', calcParentSize)
  window.removeEventListener('mousemove', handleMouseMove)
})
</script>
