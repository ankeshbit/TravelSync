<template>
  <span
    ref="containerRef"
    :class="['inline-flex cursor-pointer select-none items-center justify-center', className]"
    @click="handleClick"
    @mouseenter="handleMouseEnter"
    :aria-label="text"
  >
    <span
      v-for="(letter, i) in letterStates"
      :key="i"
      class="relative inline-flex whitespace-pre"
      style="perspective: 500px;"
    >
      <!-- Front face — visible by default, tilts backward on trigger -->
      <span
        :class="['inline-block', letterClassName]"
        :style="getFrontStyle(i)"
      >
        {{ letter.char }}
      </span>

      <!-- Echo face — hidden below, flips up into view on trigger -->
      <span
        :class="['absolute inset-0 inline-block', letterClassName]"
        :style="getEchoStyle(i)"
      >
        {{ letter.char }}
      </span>
    </span>
  </span>
</template>

<script setup lang="ts">
/**
 * LetterCascade — faithful Vue 3 port of Componentry LetterCascade
 * Source: packages/ui/src/components/letter-cascade.tsx
 *
 * Replicates the staggered dual-face flip typography effect.
 *
 * // export from index.ts
 */
import { ref, computed, watch } from 'vue'

interface Props {
  text: string
  className?: string
  letterClassName?: string
  staggerDuration?: number
  staggerFrom?: 'first' | 'last' | 'center' | number
  stiffness?: number
  damping?: number
  triggerOnClick?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  staggerDuration: 0.04,
  staggerFrom: 'first',
  stiffness: 220,
  damping: 16,
  triggerOnClick: false,
})

const emit = defineEmits<{
  (e: 'complete'): void
}>()

interface LetterState {
  char: string
  isAnimating: boolean
  isResetting: boolean
}

const containerRef = ref<HTMLSpanElement | null>(null)
const letterStates = ref<LetterState[]>([])
const blocked = ref(false)

function initLetterStates() {
  letterStates.value = props.text.split('').map((char) => ({
    char,
    isAnimating: false,
    isResetting: false,
  }))
}

watch(() => props.text, initLetterStates, { immediate: true })

function getStaggerIndex(i: number, length: number): number {
  const from = props.staggerFrom
  if (from === 'first') return i
  if (from === 'last') return length - 1 - i
  if (from === 'center') {
    const mid = (length - 1) / 2
    return Math.abs(i - mid)
  }
  if (typeof from === 'number') {
    return Math.abs(i - from)
  }
  return i
}

const duration = computed(() => {
  const baseMs = 450
  const stiffnessFactor = 220 / props.stiffness
  const dampingFactor = props.damping / 16
  return Math.round(baseMs * stiffnessFactor * dampingFactor)
})

const transitionEasing = computed(() => {
  if (props.damping < 10) {
    return 'cubic-bezier(0.175, 0.885, 0.45, 1.45)'
  }
  return 'cubic-bezier(0.34, 1.56, 0.64, 1)'
})

function trigger() {
  if (blocked.value) return
  blocked.value = true

  const length = letterStates.value.length
  let maxDelay = 0

  letterStates.value.forEach((state, i) => {
    const staggerIdx = getStaggerIndex(i, length)
    const delay = props.staggerDuration * staggerIdx * 1000
    if (delay > maxDelay) {
      maxDelay = delay
    }

    setTimeout(() => {
      state.isResetting = false
      state.isAnimating = true

      setTimeout(() => {
        state.isAnimating = false
        state.isResetting = true
      }, duration.value)
    }, delay)
  })

  const totalDuration = maxDelay + duration.value
  setTimeout(() => {
    blocked.value = false
    emit('complete')
  }, totalDuration)
}

function handleClick() {
  if (props.triggerOnClick) {
    trigger()
  }
}

function handleMouseEnter() {
  if (!props.triggerOnClick) {
    trigger()
  }
}

function getFrontStyle(i: number) {
  const state = letterStates.value[i]
  if (!state) return {}

  const transform = state.isAnimating
    ? 'rotateX(90deg) translateY(-6px)'
    : 'rotateX(0deg) translateY(0px)'
  const opacity = state.isAnimating ? '0' : '1'
  const filter = state.isAnimating ? 'blur(4px)' : 'blur(0px)'
  const transition = state.isResetting
    ? 'none'
    : `transform ${duration.value}ms cubic-bezier(0.25, 1, 0.5, 1), opacity ${duration.value}ms ease, filter ${duration.value}ms ease`

  return {
    transform,
    opacity,
    filter,
    transition,
    transformOrigin: 'bottom center',
    backfaceVisibility: 'hidden' as const,
  }
}

function getEchoStyle(i: number) {
  const state = letterStates.value[i]
  if (!state) return {}

  const transform = state.isAnimating
    ? 'rotateX(0deg) translateY(0px) scale(1)'
    : 'rotateX(-90deg) translateY(6px) scale(0.8)'
  const opacity = state.isAnimating ? '1' : '0'
  const filter = state.isAnimating ? 'blur(0px)' : 'blur(4px)'
  const transition = state.isResetting
    ? 'none'
    : `transform ${duration.value}ms ${transitionEasing.value}, opacity ${duration.value}ms ease, filter ${duration.value}ms ease`

  return {
    transform,
    opacity,
    filter,
    transition,
    transformOrigin: 'top center',
    backfaceVisibility: 'hidden' as const,
  }
}
</script>
