<template>
  <!--
    FlightStatusCardAdaptive — faithful Vue 3 port of Componentry FlightStatusCard
    Source: packages/ui/src/components/flight-status-card.tsx

    The original renders airport codes with a real dot-matrix (5×7 pixel grid)
    instead of plain text. We replicate that exactly here. The card also shows
    a live progress bar, ETA, and timezone info.
  -->
  <div
    :class="[
      'relative overflow-hidden rounded-2xl shadow-2xl select-none',
      'bg-[#0a0a0a] text-white border border-white/[0.08]',
      className,
    ]"
    v-bind="$attrs"
  >
    <!-- ── Ambient glow ──────────────────────────────────────────────────── -->
    <div
      class="pointer-events-none absolute inset-0 rounded-2xl"
      style="background: radial-gradient(ellipse 80% 50% at 50% 0%, rgba(255,255,255,0.06) 0%, transparent 100%)"
    />

    <!-- ── Header: airline + flight + status ────────────────────────────── -->
    <div class="flex items-center justify-between px-5 pt-5 pb-4">
      <div class="flex items-center gap-2.5">
        <!-- Carrier monogram -->
        <div
          class="flex h-9 w-9 items-center justify-center rounded-xl bg-white/8 text-sm font-bold tracking-tight text-white"
        >
          {{ (airline ?? 'TS').slice(0, 2).toUpperCase() }}
        </div>
        <div>
          <p class="text-[10px] font-medium uppercase tracking-widest text-white/40">
            {{ airline }}
          </p>
          <p class="text-sm font-bold tracking-widest text-white leading-none">
            {{ flightNumber }}
          </p>
        </div>
      </div>

      <!-- Status pill with animated pulse dot -->
      <div
        :class="[
          'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold',
          STATUS_PILL[status],
        ]"
      >
        <span :class="['h-1.5 w-1.5 rounded-full', STATUS_DOT[status]]" />
        {{ STATUS_LABEL[status] }}
      </div>
    </div>

    <!-- ── Dot-matrix airport code display ────────────────────────────────
         Replicates the original 5×7 pixel dot-matrix rendering.
    -->
    <div class="flex items-center justify-between px-5 pb-5">
      <!-- Departure -->
      <div class="flex flex-col gap-2">
        <DotMatrixText :text="departureCode" :dot-size="dotSize" :color="dotColor" />
        <div>
          <p class="text-xs font-semibold text-white/80">{{ departureCity }}</p>
          <p class="text-[10px] text-white/40 mt-0.5">{{ departureTime }}</p>
        </div>
      </div>

      <!-- Flight path arrow -->
      <div class="flex flex-col items-center gap-1 px-4">
        <svg
          class="w-20 text-white/20"
          viewBox="0 0 80 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <line x1="0" y1="8" x2="64" y2="8" stroke="currentColor" stroke-width="1" stroke-dasharray="3 3" />
          <path
            d="M60 4 L76 8 L60 12"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="none"
          />
        </svg>
        <!-- Duration / ETA label -->
        <p v-if="eta" class="text-[10px] font-mono font-semibold text-white/50">{{ eta }}</p>
      </div>

      <!-- Arrival -->
      <div class="flex flex-col items-end gap-2">
        <DotMatrixText :text="arrivalCode" :dot-size="dotSize" :color="dotColor" class="justify-end" />
        <div class="text-right">
          <p class="text-xs font-semibold text-white/80">{{ arrivalCity }}</p>
          <p class="text-[10px] text-white/40 mt-0.5">{{ arrivalTime }}</p>
        </div>
      </div>
    </div>

    <!-- ── Progress bar ──────────────────────────────────────────────────── -->
    <div class="px-5 pb-4">
      <div class="relative h-[3px] w-full overflow-hidden rounded-full bg-white/8">
        <!-- Completed portion -->
        <div
          class="absolute inset-y-0 left-0 rounded-full bg-white/50 transition-all duration-700 ease-out"
          :style="{ width: `${Math.min(100, Math.max(0, progress))}%` }"
        />
        <!-- Plane icon at current progress -->
        <div
          class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
          :style="{ left: `${Math.min(100, Math.max(0, progress))}%` }"
        >
          <svg class="h-3 w-3 text-white drop-shadow-sm" viewBox="0 0 16 16" fill="currentColor">
            <path d="M14.5 6.5l-5-1.5L6 2H4.5l1.5 3-3.5-.5L1 3H0l.5 2.5L0 8l.5 2.5L1 13h1.5l1-1.5 3.5-.5-1.5 3H6l3.5-3 5-1.5c1-.5 1-2 0-2.5z"/>
          </svg>
        </div>
      </div>

      <!-- Remaining time + next event -->
      <div class="mt-2 flex items-center justify-between">
        <p class="text-[10px] font-mono text-white/35">{{ nextEvent }}</p>
        <p class="text-[10px] font-mono font-bold text-white/70">{{ nextEventTime }}</p>
      </div>
    </div>

    <!-- ── Footer: remaining time + timezone ────────────────────────────── -->
    <div class="flex items-center justify-between border-t border-white/[0.06] px-5 py-3">
      <div class="flex items-center gap-1.5">
        <svg class="h-3 w-3 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
        </svg>
        <p class="text-[11px] font-mono font-semibold text-white/50">{{ remainingTime }}</p>
      </div>
      <p class="text-[10px] text-white/30">{{ timezone }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * FlightStatusCard (FlightStatusCardAdaptive) — faithful Vue 3 port of Componentry
 * Source: packages/ui/src/components/flight-status-card.tsx
 *
 * Replicates the original's 5×7 dot-matrix airport code display using a
 * lightweight sub-component (DotMatrixText defined below via defineComponent).
 *
 * // export from index.ts
 */
import { defineComponent, h, computed, type PropType } from 'vue'

// ─── Dot-matrix bitmap data ────────────────────────────────────────────────
// Verbatim 5-column × 7-row bitmaps from the original source.

type Grid = number[][]

const DOT_MATRIX: Record<string, Grid> = {
  A: [[0,0,1,0,0],[0,1,0,1,0],[1,0,0,0,1],[1,1,1,1,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1]],
  B: [[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,0]],
  C: [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,1],[0,1,1,1,0]],
  D: [[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,0]],
  E: [[1,1,1,1,1],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,1]],
  F: [[1,1,1,1,1],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0]],
  G: [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,0],[1,0,1,1,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  H: [[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1]],
  I: [[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[1,1,1,1,1]],
  J: [[0,0,1,1,1],[0,0,0,1,0],[0,0,0,1,0],[0,0,0,1,0],[1,0,0,1,0],[1,0,0,1,0],[0,1,1,0,0]],
  K: [[1,0,0,0,1],[1,0,0,1,0],[1,0,1,0,0],[1,1,0,0,0],[1,0,1,0,0],[1,0,0,1,0],[1,0,0,0,1]],
  L: [[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,1]],
  M: [[1,0,0,0,1],[1,1,0,1,1],[1,0,1,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1]],
  N: [[1,0,0,0,1],[1,1,0,0,1],[1,0,1,0,1],[1,0,0,1,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1]],
  O: [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  P: [[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0]],
  Q: [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,1,0,1],[1,0,0,1,0],[0,1,1,0,1]],
  R: [[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,0],[1,0,1,0,0],[1,0,0,1,0],[1,0,0,0,1]],
  S: [[0,1,1,1,1],[1,0,0,0,0],[1,0,0,0,0],[0,1,1,1,0],[0,0,0,0,1],[0,0,0,0,1],[1,1,1,1,0]],
  T: [[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0]],
  U: [[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  V: [[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,0,1,0],[0,1,0,1,0],[0,0,1,0,0]],
  W: [[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,1,0,1],[1,0,1,0,1],[1,1,0,1,1],[1,0,0,0,1]],
  X: [[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,1,0,1,0],[1,0,0,0,1]],
  Y: [[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0]],
  Z: [[1,1,1,1,1],[0,0,0,1,0],[0,0,1,0,0],[0,1,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,1]],
  '0': [[0,1,1,1,0],[1,0,0,1,1],[1,0,1,0,1],[1,1,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  '1': [[0,0,1,0,0],[0,1,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,1,1,1,0]],
  '2': [[0,1,1,1,0],[1,0,0,0,1],[0,0,0,0,1],[0,0,0,1,0],[0,0,1,0,0],[0,1,0,0,0],[1,1,1,1,1]],
  '3': [[1,1,1,1,1],[0,0,0,1,0],[0,0,1,0,0],[0,0,0,1,0],[0,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  '4': [[0,0,0,1,0],[0,0,1,1,0],[0,1,0,1,0],[1,0,0,1,0],[1,1,1,1,1],[0,0,0,1,0],[0,0,0,1,0]],
  '5': [[1,1,1,1,1],[1,0,0,0,0],[1,1,1,1,0],[0,0,0,0,1],[0,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  '6': [[0,1,1,1,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  '7': [[1,1,1,1,1],[0,0,0,0,1],[0,0,0,1,0],[0,0,1,0,0],[0,1,0,0,0],[0,1,0,0,0],[0,1,0,0,0]],
  '8': [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  '9': [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,1],[0,0,0,0,1],[0,0,0,0,1],[0,1,1,1,0]],
  ' ': [[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0]],
}

/** Renders a string of characters as a 5×7 dot-matrix bitmap */
const DotMatrixText = defineComponent({
  props: {
    text:    { type: String, required: true },
    dotSize: { type: Number, default: 3 },
    color:   { type: String, default: 'rgba(255,255,255,0.9)' },
    class:   { type: String, default: '' },
  },
  setup(p) {
    return () => {
      const chars = p.text.toUpperCase().split('')
      return h(
        'div',
        { class: `flex items-start gap-[${p.dotSize + 1}px] ${p.class}` },
        chars.map((ch) => {
          const grid = DOT_MATRIX[ch] ?? DOT_MATRIX[' ']!
          return h(
            'div',
            {
              class: 'grid gap-px',
              style: {
                gridTemplateColumns: `repeat(5, ${p.dotSize}px)`,
                gridTemplateRows:    `repeat(7, ${p.dotSize}px)`,
                gap: `${Math.max(1, Math.round(p.dotSize * 0.4))}px`,
              },
            },
            grid.flatMap((row) =>
              row.map((lit) =>
                h('div', {
                  style: {
                    width:  `${p.dotSize}px`,
                    height: `${p.dotSize}px`,
                    borderRadius: '50%',
                    background: lit ? p.color : 'rgba(255,255,255,0.05)',
                  },
                }),
              ),
            ),
          )
        }),
      )
    }
  },
})

// ─── Status maps ─────────────────────────────────────────────────────────────

type Status = 'on-time' | 'delayed' | 'boarding' | 'departed' | 'cancelled' | 'landed'

const STATUS_PILL: Record<Status, string> = {
  'on-time':  'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  'delayed':  'bg-amber-500/15   text-amber-400   border border-amber-500/25',
  'boarding': 'bg-blue-500/15    text-blue-400    border border-blue-500/25',
  'departed': 'bg-violet-500/15  text-violet-400  border border-violet-500/25',
  'cancelled':'bg-red-500/15     text-red-400     border border-red-500/25',
  'landed':   'bg-teal-500/15    text-teal-400    border border-teal-500/25',
}

const STATUS_DOT: Record<Status, string> = {
  'on-time':  'bg-emerald-400 animate-pulse',
  'delayed':  'bg-amber-400   animate-pulse',
  'boarding': 'bg-blue-400    animate-pulse',
  'departed': 'bg-violet-400',
  'cancelled':'bg-red-400',
  'landed':   'bg-teal-400',
}

const STATUS_LABEL: Record<Status, string> = {
  'on-time':  'On Time',
  'delayed':  'Delayed',
  'boarding': 'Boarding',
  'departed': 'Departed',
  'cancelled':'Cancelled',
  'landed':   'Landed',
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** IATA departure airport code (e.g. "JFK") */
  departureCode?: string
  /** IATA arrival airport code (e.g. "LHR") */
  arrivalCode?: string
  /** Departure city name */
  departureCity?: string
  /** Arrival city name */
  arrivalCity?: string
  /** Departure time string */
  departureTime?: string
  /** Arrival time string */
  arrivalTime?: string
  /** ETA label shown below the route arrow */
  eta?: string
  /** Timezone label in the footer */
  timezone?: string
  /** Next event label (e.g. "LANDING IN") */
  nextEvent?: string
  /** Next event time value (e.g. "4:15H") */
  nextEventTime?: string
  /** Flight progress 0–100 */
  progress?: number
  /** Remaining time label (e.g. "-4H 15M") */
  remainingTime?: string
  /** Airline name */
  airline?: string
  /** Flight number string */
  flightNumber?: string
  /** Current flight status */
  status?: Status
  /** Dot size in px for the matrix display */
  dotSize?: number
  /** Dot color (CSS color string) */
  dotColor?: string
  className?: string
}

const props = withDefaults(defineProps<Props>(), {
  departureCode:  'JFK',
  arrivalCode:    'LHR',
  departureCity:  'New York',
  arrivalCity:    'London',
  departureTime:  'FRI, 10:30 AM',
  arrivalTime:    'SAT, 6:45 AM',
  eta:            'ETA 6:45 AM',
  timezone:       'London Time',
  nextEvent:      'LANDING IN',
  nextEventTime:  '4:15H',
  progress:       55,
  remainingTime:  '-4H 15M',
  airline:        'TravelSync Air',
  flightNumber:   'TS 4201',
  status:         'on-time',
  dotSize:        3,
  dotColor:       'rgba(255,255,255,0.9)',
})
</script>
