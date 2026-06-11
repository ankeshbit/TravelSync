<template>
  <!--
    VelocityScroll (ScrollBasedVelocity) — faithful Vue 3 port
    Source: packages/ui/src/components/scroll-based-velocity.tsx

    Two parallel marquee tracks running in opposite directions.
    Scroll velocity is read, smoothed with a damped spring, then fed into
    each track's baseX velocity — exactly mirroring the Framer Motion
    useVelocity → useSpring → useAnimationFrame chain.
  -->
  <div :class="['relative overflow-hidden', className]" v-bind="$attrs">
    <ParallaxTrack
      :text="text"
      :base-velocity="defaultVelocity"
      :segment-class="segmentClass"
    />
    <ParallaxTrack
      :text="text"
      :base-velocity="-defaultVelocity"
      :segment-class="segmentClass"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * VelocityScroll — faithful Vue 3 port of Componentry ScrollBasedVelocity
 * Source: packages/ui/src/components/scroll-based-velocity.tsx
 *
 * Original Framer Motion primitives mapped:
 *   useMotionValue + useVelocity → manual velocity tracking with rAF
 *   useSpring({ damping:50, stiffness:400 }) → spring integrator
 *   useTransform([0,1000],[0,5]) → velocityFactor computed inline
 *   useAnimationFrame → requestAnimationFrame render loop
 *   wrap(min,max,v) → modulo wrap helper
 *
 * // export from index.ts
 */
import { defineComponent, ref, onMounted, onUnmounted, h, type PropType } from 'vue'

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Framer-motion wrap() equivalent — keeps value in [min, max) range */
function wrap(min: number, max: number, v: number): number {
  const range = max - min
  return ((((v - min) % range) + range) % range) + min
}

/** 1-D spring integrator — matches Framer { damping:50, stiffness:400 } */
function springStep(
  current: number,
  target:  number,
  vel:     { v: number },
  dt:      number,
  stiffness = 400,
  damping   = 50,
): number {
  const acc = stiffness * (target - current) - damping * vel.v
  vel.v += acc * dt
  return current + vel.v * dt
}

/** Clamp a value to [min, max] */
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

// ─── ParallaxTrack — inner marquee band ──────────────────────────────────────

const ParallaxTrack = defineComponent({
  name: 'ParallaxTrack',
  props: {
    text:          { type: String,  required: true },
    baseVelocity: { type: Number,  default: 5 },
    segmentClass: { type: String,  default: '' },
  },
  setup(props) {
    // x offset in percent, range [−50, 0) for seamless loop
    const x    = ref(0)
    const xPct = ref('0%')

    // Spring state
    const springVel = { v: 0 }
    let smoothedFactor = 0

    // Scroll tracking
    let lastScrollY  = 0
    let lastTs       = 0
    let scrollVelRaw = 0
    let rafId        = 0
    let directionFactor = 1  // +1 or -1 based on scroll direction

    function onScroll() {
      const now = performance.now()
      const dy  = window.scrollY - lastScrollY
      const dt  = Math.max(now - lastTs, 1)
      scrollVelRaw = dy / dt * 16       // px/frame-equivalent
      lastScrollY  = window.scrollY
      lastTs       = now
    }

    function tick(ts: number) {
      const dt = Math.min((ts - (lastTs || ts)) / 1000, 0.05)
      lastTs = ts

      // Scroll direction
      if (scrollVelRaw < 0)       directionFactor = -1
      else if (scrollVelRaw > 0)  directionFactor =  1

      // velocityFactor = map(smoothed, [0,1000],[0,5]) — matches original
      const targetFactor = clamp(Math.abs(scrollVelRaw) / 1000 * 5, 0, 5)
      smoothedFactor = springStep(smoothedFactor, targetFactor, springVel, dt, 400, 50)

      // Move x by baseVelocity ± scroll contribution (matches original useAnimationFrame formula)
      const move = props.baseVelocity
        + props.baseVelocity * directionFactor * smoothedFactor

      x.value = wrap(-50, 0, x.value + move * dt * 15)
      xPct.value = `${x.value}%`

      scrollVelRaw *= 0.9  // decay toward zero between scroll events

      rafId = requestAnimationFrame(tick)
    }

    onMounted(() => {
      lastScrollY = window.scrollY
      lastTs      = performance.now()
      window.addEventListener('scroll', onScroll, { passive: true })
      rafId = requestAnimationFrame(tick)
    })

    onUnmounted(() => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', onScroll)
    })

    return () => {
      // Render: two copies of the text span side-by-side to fill the track
      // translateX drives infinite marquee (matches original <motion.div style={{x}}>)
      return h(
        'div',
        { class: 'flex whitespace-nowrap overflow-hidden py-2', 'aria-hidden': true },
        [
          h(
            'div',
            {
              class: 'flex shrink-0',
              style: { transform: `translateX(${xPct.value})`, willChange: 'transform' },
            },
            // Four copies ensure seamless looping at any viewport width
            Array.from({ length: 4 }, (_, i) =>
              h(
                'span',
                {
                  key: i,
                  class: [
                    'block whitespace-nowrap px-4',
                    props.segmentClass,
                  ].filter(Boolean).join(' '),
                },
                props.text,
              ),
            ),
          ),
        ],
      )
    }
  },
})

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  text: string
  /** Marquee base speed — positive value, direction managed internally */
  defaultVelocity?: number
  /** CSS classes for each text segment */
  segmentClass?: string
  className?: string
}

const props = withDefaults(defineProps<Props>(), {
  defaultVelocity: 5,
  segmentClass: 'font-display text-center text-4xl font-bold tracking-[-0.02em] text-foreground drop-shadow-sm',
})
</script>
