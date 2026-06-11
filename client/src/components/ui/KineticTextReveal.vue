<template>
  <!--
    KineticTextReveal — faithful Vue 3 port of Componentry KineticTextReveal
    Source: packages/ui/src/components/kinetic-text-reveal.tsx

    Splits text into words / characters / lines, then reveals each segment
    by translating + fading it in from a directional offset. The stagger
    wave can originate from start / end / center / edges / random / a fixed
    index — exactly matching the original's getStaggeredIndex logic.

    Original Framer Motion → Vue translation:
      motion.span variants idle/visible  → :style inline transitions with
                                           CSS transition-delay driven by
                                           IntersectionObserver state
      useReducedMotion                   → prefers-reduced-motion media query
      autoPlay + delay                   → onMounted setTimeout
      forwardRef + imperative handle     → expose({ play, reset })
  -->
  <span
    ref="rootRef"
    :class="['inline', className]"
    aria-label="text"
    v-bind="$attrs"
  >
    <template v-for="(seg, i) in segments" :key="i">
      <!-- Non-animated spacer (e.g. spaces between words) -->
      <span v-if="!seg.animated" class="inline whitespace-pre">{{ seg.value }}</span>

      <!-- Animated segment — clipped mask wrapping the sliding element -->
      <span
        v-else
        :class="['inline-block overflow-hidden align-bottom', maskClassName]"
      >
        <span
          :class="['inline-block', segmentClass]"
          :style="segmentStyle(seg.index)"
        >{{ seg.value === ' ' ? '\u00a0' : seg.value }}</span>
      </span>

      <!-- Line break after each line in lines mode -->
      <br v-if="splitBy === 'lines' && i < segments.length - 1 && seg.animated" />
    </template>
  </span>
</template>

<script setup lang="ts">
/**
 * KineticTextReveal — faithful Vue 3 port of Componentry KineticTextReveal
 * Source: packages/ui/src/components/kinetic-text-reveal.tsx
 *
 * // export from index.ts
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'

// ─── Types matching original ──────────────────────────────────────────────────

type SplitMode      = 'words' | 'characters' | 'lines'
type RevealDirection = 'up' | 'down' | 'left' | 'right'
type StaggerOrigin  = 'start' | 'end' | 'center' | 'edges' | 'random' | number

interface Segment {
  value:    string
  animated: boolean
  index:    number   // position within animated segments only
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  text:               string
  className?:         string
  segmentClass?:      string
  maskClassName?:     string
  splitBy?:           SplitMode
  direction?:         RevealDirection
  distance?:          number
  stagger?:           number
  staggerFrom?:       StaggerOrigin
  blur?:              boolean
  autoPlay?:          boolean
  delay?:             number
  onRevealStart?:     () => void
  onRevealComplete?:  () => void
}

const props = withDefaults(defineProps<Props>(), {
  splitBy:    'words',
  direction:  'up',
  distance:   20,
  stagger:    0.05,
  staggerFrom:'start',
  blur:        true,
  autoPlay:    true,
  delay:       0,
})

// ─── Imperative handle — play() / reset() ────────────────────────────────────

const emit = defineEmits<{
  (e: 'reveal-start'):    void
  (e: 'reveal-complete'): void
}>()

const visible = ref(false)

function play()  { visible.value = true;  emit('reveal-start'); scheduleComplete() }
function reset() { visible.value = false }

defineExpose({ play, reset })

// ─── Segment splitting (matches original getSegments logic) ──────────────────

function splitGraphemes(str: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const s = new (Intl as any).Segmenter('en', { granularity: 'grapheme' })
    return Array.from(s.segment(str), (x: any) => x.segment as string)
  }
  return Array.from(str)
}

const segments = computed<Segment[]>(() => {
  const { text, splitBy } = props
  let animIdx = 0

  if (splitBy === 'lines') {
    return text.split('\n').map((line) => ({ value: line, animated: true, index: animIdx++ }))
  }

  if (splitBy === 'characters') {
    return splitGraphemes(text).map((ch) => {
      if (ch === ' ') return { value: ' ', animated: false, index: -1 }
      return { value: ch, animated: true, index: animIdx++ }
    })
  }

  // words (default)
  return text.split(' ').flatMap((word, wi, arr) => {
    const seg: Segment[] = [{ value: word, animated: true, index: animIdx++ }]
    if (wi < arr.length - 1) seg.push({ value: ' ', animated: false, index: -1 })
    return seg
  })
})

// ─── Stagger index computation (matches original getStaggeredIndex) ───────────

const animatedCount = computed(() => segments.value.filter((s) => s.animated).length)

function getDelay(segIndex: number): number {
  const n    = animatedCount.value
  const from = props.staggerFrom

  let ordered: number

  if (from === 'start')  ordered = segIndex
  else if (from === 'end')   ordered = n - 1 - segIndex
  else if (from === 'center') {
    const mid = (n - 1) / 2
    ordered = Math.abs(segIndex - mid) / mid * (n - 1) / 2
  } else if (from === 'edges') {
    const mid = (n - 1) / 2
    ordered = (n - 1) / 2 - Math.abs(segIndex - mid)
  } else if (from === 'random') {
    // deterministic pseudo-random so it doesn't change every render
    ordered = ((segIndex * 6364136223846793005 + 1442695040888963407) >>> 0) % n
  } else if (typeof from === 'number') {
    ordered = Math.abs(segIndex - from)
  } else {
    ordered = segIndex
  }

  return props.stagger * ordered
}

// ─── Direction → CSS hidden transform ────────────────────────────────────────

function hiddenTransform(): string {
  const d = props.distance
  switch (props.direction) {
    case 'up':    return `translateY(${d}px)`
    case 'down':  return `translateY(-${d}px)`
    case 'left':  return `translateX(${d}px)`
    case 'right': return `translateX(-${d}px)`
  }
}

// ─── Per-segment style ────────────────────────────────────────────────────────

const prefersReducedMotion = typeof window !== 'undefined'
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false

function segmentStyle(segIndex: number): Record<string, string> {
  const shown = visible.value || prefersReducedMotion
  const delay = getDelay(segIndex)

  return {
    transform:        shown ? 'translate(0,0)' : hiddenTransform(),
    opacity:          shown ? '1' : '0',
    filter:           props.blur && !shown ? 'blur(8px)' : 'blur(0px)',
    transitionProperty: 'transform, opacity, filter',
    transitionDuration: '0.65s',
    transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
    transitionDelay:  `${delay}s`,
    display: 'inline-block',
    willChange: 'transform, opacity',
  }
}

// ─── Completion callback scheduling ──────────────────────────────────────────

function scheduleComplete() {
  const lastDelay = getDelay(animatedCount.value - 1)
  setTimeout(() => emit('reveal-complete'), (lastDelay + 0.65) * 1000)
}

// ─── IntersectionObserver trigger ────────────────────────────────────────────

const rootRef = ref<HTMLElement | null>(null)
let io: IntersectionObserver | null = null

onMounted(() => {
  if (props.autoPlay) {
    io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setTimeout(play, props.delay * 1000)
          io?.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    if (rootRef.value) io.observe(rootRef.value)
  }
})

onUnmounted(() => io?.disconnect())
</script>
