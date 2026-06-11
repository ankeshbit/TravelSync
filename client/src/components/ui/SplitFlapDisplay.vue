<template>
  <!--
    SplitFlapDisplay — faithful Vue 3 port of Componentry SplitFlapDisplay
    Source: packages/ui/src/components/split-flap-display.tsx

    Two modes:
      • rows  — label/value pair table (airport board style)
      • text  — single string rendered character-by-character

    Each character cell is a FlapCell that cycles through CHARACTERS using the
    same stagger + flip-speed logic as the original React version.
  -->
  <div
    :class="[
      'overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0d0d] shadow-2xl font-mono',
      className,
    ]"
    v-bind="$attrs"
  >
    <!-- ── Board header ─────────────────────────────────────────────────── -->
    <div class="flex items-center justify-between border-b border-white/[0.06] bg-[#111] px-4 py-2.5">
      <div class="flex items-center gap-1.5">
        <div class="h-2 w-2 rounded-full bg-red-500/80" />
        <div class="h-2 w-2 rounded-full bg-yellow-500/80" />
        <div class="h-2 w-2 rounded-full bg-green-500/80" />
      </div>
      <p class="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
        {{ boardTitle }}
      </p>
      <p class="text-[10px] font-mono text-white/25">{{ liveTime }}</p>
    </div>

    <!-- ── Text mode: single row of flap cells ──────────────────────────── -->
    <div v-if="text" class="flex flex-wrap items-center gap-1 p-4">
      <FlapCell
        v-for="(ch, i) in paddedText"
        :key="i"
        :target-char="ch"
        :size="size"
        :delay="staggerDelay * i"
        :flip-speed="flipSpeed"
      />
    </div>

    <!-- ── Rows mode: label/value table ─────────────────────────────────── -->
    <div v-else class="divide-y divide-white/[0.04]">
      <div
        v-for="(row, ri) in rows"
        :key="ri"
        class="flex items-center gap-3 px-4 py-3"
      >
        <!-- Green indicator strip (matches original showIndicators) -->
        <div
          v-if="showIndicators"
          :class="[
            'h-full w-[3px] min-h-[2rem] rounded-full shrink-0',
          ]"
          :style="{ background: accentColor }"
        />

        <!-- Label -->
        <div class="flex min-w-[6rem] items-center gap-0.5 shrink-0">
          <FlapCell
            v-for="(ch, ci) in padRow(row.label, columns)"
            :key="ci"
            :target-char="ch"
            :size="size"
            :delay="staggerDelay * ci"
            :flip-speed="flipSpeed"
          />
        </div>

        <!-- Separator -->
        <div class="h-5 w-px bg-white/10 shrink-0" />

        <!-- Value -->
        <div class="flex items-center gap-0.5">
          <FlapCell
            v-for="(ch, ci) in padRow(row.value, columns)"
            :key="ci"
            :target-char="ch"
            :size="size"
            :delay="staggerDelay * (row.label.length + ci)"
            :flip-speed="flipSpeed"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * SplitFlapDisplay — faithful Vue 3 port of Componentry SplitFlapDisplay
 * Source: packages/ui/src/components/split-flap-display.tsx
 *
 * The FlapCell sub-component is defined inline using defineComponent so this
 * file remains self-contained (no extra .vue files).
 *
 * // export from index.ts
 */
import {
  ref, computed, watch, onMounted, onUnmounted,
  defineComponent, h, type PropType
} from 'vue'

// ─── Character set (verbatim from original) ────────────────────────────────────

const CHARACTERS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$.,!?:;+-=%&#@'

function getNextChar(current: string): string {
  const idx = CHARACTERS.indexOf(current)
  if (idx === -1 || idx >= CHARACTERS.length - 1) return CHARACTERS[0] ?? ' '
  return CHARACTERS[idx + 1] ?? ' '
}

// ─── Size map ─────────────────────────────────────────────────────────────────

const SIZE_MAP = {
  sm: { cell: 'h-7 w-5',  text: 'text-sm',  gap: 'gap-[1px]' },
  md: { cell: 'h-9 w-6',  text: 'text-base', gap: 'gap-[1px]' },
  lg: { cell: 'h-12 w-8', text: 'text-xl',  gap: 'gap-[1px]' },
} as const

// ─── FlapCell sub-component ───────────────────────────────────────────────────
// Mirrors React FlapCell: cycles through CHARACTERS until reaching targetChar,
// with stagger delay and CSS flip animation (scaleY transition on top half).

const FlapCell = defineComponent({
  name: 'FlapCell',
  props: {
    targetChar: { type: String,  required: true },
    size:       { type: String as PropType<'sm' | 'md' | 'lg'>, default: 'md' },
    delay:      { type: Number,  default: 0 },
    flipSpeed:  { type: Number,  default: 35 },
  },
  setup(props) {
    const displayChar = ref(' ')
    const flipPhase   = ref<'idle' | 'top-down' | 'bottom-up'>('idle')

    let timer: ReturnType<typeof setTimeout>  | null = null
    let loop:  ReturnType<typeof setInterval> | null = null

    function cleanup() {
      if (timer) { clearTimeout(timer);  timer = null }
      if (loop)  { clearInterval(loop);  loop  = null }
    }

    function animate(target: string) {
      cleanup()
      const t = target.toUpperCase()
      if (displayChar.value === t) return

      timer = setTimeout(() => {
        loop = setInterval(() => {
          const next = getNextChar(displayChar.value)

          flipPhase.value = 'top-down'
          setTimeout(() => { flipPhase.value = 'bottom-up' }, props.flipSpeed * 0.4)
          setTimeout(() => { flipPhase.value = 'idle' },       props.flipSpeed * 0.8)

          displayChar.value = next

          if (next === t) cleanup()
        }, props.flipSpeed)
      }, props.delay)
    }

    watch(() => props.targetChar, (v) => animate(v), { immediate: true })

    onUnmounted(cleanup)

    const sizes = computed(() => SIZE_MAP[props.size] ?? SIZE_MAP.md)

    return () => {
      const { cell, text } = sizes.value
      const phase = flipPhase.value

      // Top half of the split flap (clips to top, flips down when animating)
      const topHalf = h('div', {
        class: 'absolute inset-x-0 top-0 h-1/2 overflow-hidden',
        style: { zIndex: 2 },
      }, [
        h('div', {
          class: `flex items-end justify-center h-full ${text} font-bold text-white select-none`,
          style: {
            transform:      phase === 'top-down' ? 'scaleY(0)' : 'scaleY(1)',
            transformOrigin:'bottom center',
            transition:     phase !== 'idle'
              ? `transform ${props.flipSpeed * 0.4}ms ease-in`
              : 'none',
          },
        }, displayChar.value === ' ' ? '\u00a0' : displayChar.value)
      ])

      // Bottom half (clips to bottom, flips up when revealing)
      const bottomHalf = h('div', {
        class: 'absolute inset-x-0 bottom-0 h-1/2 overflow-hidden',
        style: { zIndex: 1 },
      }, [
        h('div', {
          class: `flex items-start justify-center h-full ${text} font-bold text-white/80 select-none`,
          style: {
            transform:      phase === 'bottom-up' ? 'scaleY(0)' : 'scaleY(1)',
            transformOrigin:'top center',
            transition:     phase !== 'idle'
              ? `transform ${props.flipSpeed * 0.4}ms ease-out`
              : 'none',
          },
        }, displayChar.value === ' ' ? '\u00a0' : displayChar.value)
      ])

      // Horizontal divider line (the split)
      const divider = h('div', {
        class: 'absolute inset-x-0 top-1/2 h-px bg-black/60 z-10',
      })

      return h('div', {
        class: [
          'relative overflow-hidden rounded-sm bg-[#1a1a1a]',
          'border border-white/[0.06]',
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
          cell,
        ].join(' '),
      }, [topHalf, bottomHalf, divider])
    }
  },
})

// ─── Main component types ──────────────────────────────────────────────────────

interface SplitFlapRow {
  label: string
  value: string
}

interface Props {
  rows?: SplitFlapRow[]
  text?: string
  columns?: number
  size?: 'sm' | 'md' | 'lg'
  accentColor?: string
  showIndicators?: boolean
  staggerDelay?: number
  flipSpeed?: number
  boardTitle?: string
  className?: string
}

const props = withDefaults(defineProps<Props>(), {
  columns: 12,
  size: 'md',
  accentColor: '#22c55e',
  showIndicators: true,
  staggerDelay: 40,
  flipSpeed: 35,
  boardTitle: 'DEPARTURES',
  rows: () => [
    { label: 'LONDON LHR', value: '09:45' },
    { label: 'TOKYO NRT',  value: '10:30' },
    { label: 'DUBAI DXB',  value: '11:00' },
    { label: 'PARIS CDG',  value: '12:15' },
    { label: 'SYDNEY SYD', value: '13:45' },
  ],
})

// ─── Computed ─────────────────────────────────────────────────────────────────

function padRow(str: string, len: number): string[] {
  const upper = str.toUpperCase()
  return (upper.length >= len ? upper.slice(0, len) : upper + ' '.repeat(len - upper.length)).split('')
}

const paddedText = computed(() => {
  if (!props.text) return []
  return padRow(props.text, props.text.length)
})

// ─── Live clock ───────────────────────────────────────────────────────────────

const liveTime = ref('')
let clockTimer: ReturnType<typeof setInterval> | null = null

function tick() {
  liveTime.value = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

onMounted(() => { tick(); clockTimer = setInterval(tick, 1000) })
onUnmounted(() => { if (clockTimer) clearInterval(clockTimer) })
</script>

<style scoped>
/* Extra shadow under the board to give it depth */
.font-mono { font-family: 'JetBrains Mono', 'Fira Code', monospace, monospace; }
</style>
