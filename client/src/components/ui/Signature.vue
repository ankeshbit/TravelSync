<template>
  <svg
    ref="svgRef"
    :class="['block', className]"
    :viewBox="`0 0 ${width} ${height}`"
    :width="width"
    :height="height"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      :d="pathD"
      fill="none"
      :stroke="color"
      :stroke-width="strokeWidth"
      stroke-linecap="round"
    />
    <!-- Animated draw-on -->
    <path
      v-if="animated"
      :d="pathD"
      fill="none"
      :stroke="color"
      :stroke-width="strokeWidth"
      stroke-linecap="round"
      :stroke-dasharray="pathLength"
      :stroke-dashoffset="dashOffset"
      style="transition: stroke-dashoffset 2s cubic-bezier(0.6, 0, 0.4, 1)"
    />
  </svg>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'

interface Props {
  text?: string
  pathD?: string
  width?: number
  height?: number
  color?: string
  strokeWidth?: number
  animated?: boolean
  className?: string
}

const props = withDefaults(defineProps<Props>(), {
  text: 'TravelSync',
  width: 280,
  height: 80,
  color: '#ffffff',
  strokeWidth: 2.5,
  animated: true,
})

const svgRef = ref<SVGSVGElement | null>(null)
const pathLength = ref(800)
const dashOffset = ref(800)
const revealed = ref(false)

// If no custom path, use a handwritten "Signature" style path
const pathD = computed(() => {
  if (props.pathD) return props.pathD
  // Default handwritten wave path for branding
  return `
    M 20,40
    C 30,20 45,18 55,35
    C 62,47 68,52 80,40
    C 92,28 100,22 112,35
    C 120,44 125,50 140,40
    C 150,32 158,26 168,38
    C 175,47 180,52 195,45
    C 207,39 215,32 228,40
    C 238,47 245,52 258,42
  `.trim()
})

const { stop } = useIntersectionObserver(
  svgRef,
  ([entry]) => {
    if (entry?.isIntersecting && !revealed.value) {
      revealed.value = true
      dashOffset.value = 0
      stop()
    }
  },
  { threshold: 0.3 }
)

onMounted(() => {
  // Get path length for animation
  const paths = svgRef.value?.querySelectorAll('path')
  if (paths && paths.length > 0) {
    const len = (paths[1] || paths[0])?.getTotalLength?.() || 800
    pathLength.value = len
    dashOffset.value = revealed.value ? 0 : len
  }
})
</script>
