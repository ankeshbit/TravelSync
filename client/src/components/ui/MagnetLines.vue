<template>
  <div
    ref="containerRef"
    :class="['relative grid place-items-center overflow-hidden', className]"
    :style="{
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      gridTemplateRows: `repeat(${rows}, 1fr)`,
      width: containerSize,
      height: containerSize,
      ...style,
    }"
  >
    <div
      v-for="(line, i) in lines"
      :key="i"
      class="magnet-line-wrapper flex items-center justify-center w-full h-full"
    >
      <div
        class="magnet-line will-change-transform"
        :style="{
          width: lineWidth,
          height: lineHeight,
          backgroundColor: lineColor,
          transform: `rotate(${line.angle}deg)`,
        }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * MagnetLines — faithful Vue 3 port of Componentry MagnetLines
 * Source: packages/ui/src/components/magnet-lines.tsx
 *
 * Renders a grid of lines that point toward the mouse cursor,
 * using short-path angular spring physics inside a single rAF loop.
 *
 * // export from index.ts
 */
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useMouse } from '@vueuse/core'

interface Props {
  rows?: number
  columns?: number
  containerSize?: string
  lineColor?: string
  lineWidth?: string
  lineHeight?: string
  baseAngle?: number
  className?: string
  style?: any
}

const props = withDefaults(defineProps<Props>(), {
  rows: 9,
  columns: 9,
  containerSize: '80vmin',
  lineColor: '#efefef',
  lineWidth: '1vmin',
  lineHeight: '6vmin',
  baseAngle: 0,
  className: '',
})

interface LineState {
  x: number
  y: number
  angle: number
  targetAngle: number
  vel: number
}

const containerRef = ref<HTMLDivElement | null>(null)
const lines = ref<LineState[]>([])

// Cursor tracking
const { x: mouseX, y: mouseY } = useMouse()

function initLines() {
  const total = props.rows * props.columns
  lines.value = Array.from({ length: total }, () => ({
    x: 0,
    y: 0,
    angle: props.baseAngle,
    targetAngle: props.baseAngle,
    vel: 0,
  }))
}

watch(() => [props.rows, props.columns], initLines, { immediate: true })

function captureLineCoords() {
  const container = containerRef.value
  if (!container) return

  const wrappers = container.querySelectorAll('.magnet-line-wrapper')
  wrappers.forEach((el, idx) => {
    if (idx < lines.value.length) {
      const rect = el.getBoundingClientRect()
      lines.value[idx].x = rect.left + rect.width / 2
      lines.value[idx].y = rect.top + rect.height / 2
    }
  })
}

let rafId = 0
let lastTime = performance.now()

// Spring physics parameters
const stiffness = 280
const damping = 18
const mass = 0.5

function updatePhysics(time: number) {
  const dt = Math.min((time - lastTime) / 1000, 0.1)
  lastTime = time

  const mx = mouseX.value
  const my = mouseY.value

  lines.value.forEach((line) => {
    // Determine target angle toward mouse
    const dx = mx - line.x
    const dy = my - line.y
    
    // Fall back to base angle if mouse is not in viewport or too close
    if (mx === 0 && my === 0) {
      line.targetAngle = props.baseAngle
    } else {
      line.targetAngle = (Math.atan2(dy, dx) * 180) / Math.PI + props.baseAngle
    }

    // Shortest-path angular difference to prevent 360 wrap-around spin
    let diff = line.targetAngle - line.angle
    diff = ((((diff + 180) % 360) + 360) % 360) - 180

    // Angular spring solver
    const acc = (stiffness * diff - damping * line.vel) / mass
    line.vel += acc * dt
    line.angle += line.vel * dt
  })

  rafId = requestAnimationFrame(updatePhysics)
}

onMounted(() => {
  captureLineCoords()
  window.addEventListener('resize', captureLineCoords)
  lastTime = performance.now()
  rafId = requestAnimationFrame(updatePhysics)
})

onUnmounted(() => {
  cancelAnimationFrame(rafId)
  window.removeEventListener('resize', captureLineCoords)
})
</script>
