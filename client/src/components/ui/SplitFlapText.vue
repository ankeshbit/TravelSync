<template>
  <span class="inline-flex gap-[1px]">
    <span
      v-for="(char, i) in displayedChars"
      :key="i"
      class="relative inline-flex items-center justify-center overflow-hidden"
      :style="{ width: charWidth + 'px' }"
    >
      <!-- Bottom half (revealed new char) -->
      <span
        class="absolute inset-x-0 bottom-0 flex h-1/2 items-end justify-center overflow-hidden"
        aria-hidden="true"
      >
        <span :class="['select-none leading-none', className]">{{ char }}</span>
      </span>
      <!-- Top half (flipping) -->
      <span
        :class="[
          'relative z-10 flex h-full items-center justify-center select-none leading-none',
          className
        ]"
        :style="{
          animationDuration: animationMs + 'ms',
        }"
      >{{ char }}</span>
    </span>
  </span>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .:/-'

interface Props {
  text: string
  running?: boolean
  speed?: number
  charWidth?: number
  className?: string
  animationMs?: number
}

const props = withDefaults(defineProps<Props>(), {
  running: true,
  speed: 50,
  charWidth: 10,
  animationMs: 80,
})

const displayedChars = ref<string[]>([])
let intervalId: ReturnType<typeof setInterval> | null = null
let targetText = ''
let shuffleCount = ref<Record<number, number>>({})

function padText(text: string, len: number): string {
  const upper = text.toUpperCase()
  if (upper.length >= len) return upper.slice(0, len)
  return upper + ' '.repeat(len - upper.length)
}

function startAnimation(newText: string) {
  if (intervalId) clearInterval(intervalId)
  targetText = newText
  const len = newText.length

  // Initialize displayed chars if needed
  if (displayedChars.value.length !== len) {
    displayedChars.value = new Array(len).fill(' ')
  }

  const shuffleArr: number[] = new Array(len).fill(0).map((_, i) => i)

  intervalId = setInterval(() => {
    if (!props.running) return
    let allDone = true

    displayedChars.value = displayedChars.value.map((c, i) => {
      const target = targetText[i] ?? ' '
      if (c === target) return c
      allDone = false

      // Randomly chance to settle
      if (Math.random() < 0.2) return target

      // Otherwise show random char
      return CHARSET[Math.floor(Math.random() * CHARSET.length)] || target
    })

    if (allDone) {
      clearInterval(intervalId!)
      intervalId = null
    }
  }, props.speed)
}

watch(
  () => props.text,
  (newText) => {
    const padded = padText(newText, Math.max(newText.length, displayedChars.value.length))
    startAnimation(padded)
  },
  { immediate: false }
)

watch(
  () => props.running,
  (r) => {
    if (r && targetText) startAnimation(targetText)
  }
)

onMounted(() => {
  const padded = padText(props.text, props.text.length)
  displayedChars.value = new Array(padded.length).fill(' ')
  if (props.running) {
    startAnimation(padded)
  } else {
    displayedChars.value = padded.split('')
  }
})

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId)
})
</script>
