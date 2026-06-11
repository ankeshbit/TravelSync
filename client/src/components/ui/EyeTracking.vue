<template>
  <div
    ref="containerRef"
    :class="['relative flex items-center justify-center overflow-hidden', className]"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <!-- Background slot -->
    <slot name="background" />

    <!-- The eyes -->
    <div class="relative flex gap-12 z-10">
      <div
        v-for="(eye, i) in [0, 1]"
        :key="i"
        :class="[
          'relative overflow-hidden rounded-full border-2 border-white/20 bg-white/10 backdrop-blur-sm',
          eyeSize === 'lg' ? 'h-28 w-28' : eyeSize === 'sm' ? 'h-16 w-16' : 'h-20 w-20',
        ]"
      >
        <!-- Iris -->
        <div
          class="absolute rounded-full"
          :class="irisSize"
          :style="{
            background: eyeColor,
            transform: `translate(${pupils[i]?.x ?? 0}px, ${pupils[i]?.y ?? 0}px) translate(-50%, -50%)`,
            left: '50%',
            top: '50%',
            transition: 'transform 0.12s cubic-bezier(0.34,1.56,0.64,1)',
          }"
        >
          <!-- Pupil -->
          <div class="absolute left-1/2 top-1/2 h-1/2 w-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-950" />
          <!-- Glare -->
          <div class="absolute right-2 top-2 h-2 w-2 rounded-full bg-white/70" />
        </div>
      </div>
    </div>

    <!-- Content slot -->
    <div class="absolute inset-0 flex items-end justify-center pb-8 pointer-events-none">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Props {
  eyeColor?: string
  eyeSize?: 'sm' | 'md' | 'lg'
  trackRadius?: number
  className?: string
}

const props = withDefaults(defineProps<Props>(), {
  eyeColor: 'radial-gradient(circle at 30% 30%, #60a5fa, #1d4ed8)',
  eyeSize: 'md',
  trackRadius: 24,
})

const containerRef = ref<HTMLDivElement | null>(null)
const pupils = ref<Array<{ x: number; y: number }>>([{ x: 0, y: 0 }, { x: 0, y: 0 }])

const irisSize = computed(() => {
  if (props.eyeSize === 'lg') return 'h-16 w-16'
  if (props.eyeSize === 'sm') return 'h-8 w-8'
  return 'h-12 w-12'
})

function onMouseMove(e: MouseEvent) {
  const container = containerRef.value
  if (!container) return

  const eyes = container.querySelectorAll('.relative.rounded-full')
  const newPupils: Array<{ x: number; y: number }> = []

  eyes.forEach((eye) => {
    const rect = eye.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = e.clientX - cx
    const dy = e.clientY - cy
    const dist = Math.hypot(dx, dy)
    const maxDist = props.trackRadius
    const clampedDist = Math.min(dist, maxDist)
    const angle = Math.atan2(dy, dx)
    newPupils.push({
      x: Math.cos(angle) * clampedDist,
      y: Math.sin(angle) * clampedDist,
    })
  })

  pupils.value = newPupils
}

function onMouseLeave() {
  pupils.value = [{ x: 0, y: 0 }, { x: 0, y: 0 }]
}
</script>
