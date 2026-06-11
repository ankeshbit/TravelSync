<template>
  <div
    ref="containerRef"
    data-text-repel
    :class="[
      'inline-flex flex-wrap items-center justify-center cursor-default select-none',
      className
    ]"
    @mousemove="handleMouseMove"
    @mouseleave="handleMouseLeave"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleMouseLeave"
    :aria-label="text"
  >
    <span
      v-for="(letter, i) in letterStates"
      :key="i"
      class="repel-letter inline-block whitespace-pre will-change-transform"
      :class="letterClassName"
      :style="{
        transform: `translate3d(${letter.x}px, ${letter.y}px, 0) rotate(${letter.x * 0.3}deg)`,
        display: letter.char === ' ' ? 'inline-block' : undefined
      }"
      :aria-hidden="letter.char !== ' '"
    >{{ letter.char }}</span>
  </div>
</template>

<script setup lang="ts">
/**
 * TextRepel — faithful Vue 3 port of Componentry TextRepel
 * Source: packages/ui/src/components/text-repel.tsx
 *
 * Implements a cursor-driven repulsion/attraction effect on text characters
 * with custom spring physics (stiffness, damping, mass) solved inside rAF.
 *
 * // export from index.ts
 */
import { ref, onMounted, onUnmounted, watch } from 'vue'

interface Props {
  text: string
  className?: string
  letterClassName?: string
  radius?: number
  strength?: number
  mode?: 'repel' | 'attract'
  stiffness?: number
  damping?: number
  mass?: number
}

const props = withDefaults(defineProps<Props>(), {
  radius: 120,
  strength: 45,
  mode: 'repel',
  stiffness: 180,
  damping: 14,
  mass: 0.4,
})

interface LetterState {
  char: string
  ox: number
  oy: number
  x: number
  y: number
  vx: number
  vy: number
  targetX: number
  targetY: number
}

const containerRef = ref<HTMLDivElement | null>(null)
const letterStates = ref<LetterState[]>([])

const mouseX = ref(-9999)
const mouseY = ref(-9999)

function initLetters() {
  letterStates.value = props.text.split('').map((char) => ({
    char,
    ox: 0,
    oy: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    targetX: 0,
    targetY: 0,
  }))
}

watch(() => props.text, () => {
  initLetters()
  requestAnimationFrame(captureOrigins)
}, { immediate: true })

function captureOrigins() {
  const container = containerRef.value
  if (!container) return
  const rect = container.getBoundingClientRect()
  const spans = container.querySelectorAll('.repel-letter')
  spans.forEach((el, i) => {
    if (i < letterStates.value.length) {
      const lr = el.getBoundingClientRect()
      letterStates.value[i].ox = lr.left - rect.left + lr.width / 2
      letterStates.value[i].oy = lr.top - rect.top + lr.height / 2
    }
  })
}

function handleMouseMove(e: MouseEvent) {
  const container = containerRef.value
  if (!container) return
  const rect = container.getBoundingClientRect()
  mouseX.value = e.clientX - rect.left
  mouseY.value = e.clientY - rect.top
}

function handleMouseLeave() {
  mouseX.value = -9999
  mouseY.value = -9999
}

function handleTouchStart(e: TouchEvent) {
  if (!e.touches[0]) return
  const container = containerRef.value
  if (!container) return
  const rect = container.getBoundingClientRect()
  mouseX.value = e.touches[0].clientX - rect.left
  mouseY.value = e.touches[0].clientY - rect.top
}

function handleTouchMove(e: TouchEvent) {
  if (!e.touches[0]) return
  const container = containerRef.value
  if (!container) return
  const rect = container.getBoundingClientRect()
  mouseX.value = e.touches[0].clientX - rect.left
  mouseY.value = e.touches[0].clientY - rect.top
}

let rafId = 0
let lastTime = performance.now()

function updatePhysics(time: number) {
  const dt = Math.min((time - lastTime) / 1000, 0.1)
  lastTime = time

  const substeps = 4
  const subDt = dt / substeps

  const mx = mouseX.value
  const my = mouseY.value

  letterStates.value.forEach((letter) => {
    const dx = letter.ox - mx
    const dy = letter.oy - my
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance < props.radius && mx !== -9999 && my !== -9999 && distance > 0) {
      const force = Math.pow(1 - distance / props.radius, 2) * props.strength
      const angle = Math.atan2(dy, dx)
      const dir = props.mode === 'attract' ? -1 : 1
      letter.targetX = Math.cos(angle) * force * dir
      letter.targetY = Math.sin(angle) * force * dir
    } else {
      letter.targetX = 0
      letter.targetY = 0
    }

    for (let s = 0; s < substeps; s++) {
      const ax = (props.stiffness * (letter.targetX - letter.x) - props.damping * letter.vx) / props.mass
      const ay = (props.stiffness * (letter.targetY - letter.y) - props.damping * letter.vy) / props.mass
      letter.vx += ax * subDt
      letter.vy += ay * subDt
      letter.x += letter.vx * subDt
      letter.y += letter.vy * subDt
    }
  })

  rafId = requestAnimationFrame(updatePhysics)
}

onMounted(() => {
  captureOrigins()
  window.addEventListener('resize', captureOrigins)
  lastTime = performance.now()
  rafId = requestAnimationFrame(updatePhysics)
})

onUnmounted(() => {
  cancelAnimationFrame(rafId)
  window.removeEventListener('resize', captureOrigins)
})
</script>
