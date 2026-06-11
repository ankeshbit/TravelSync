<template>
  <canvas
    ref="canvasRef"
    :class="[
      'block rounded-[inherit]',
      !transparent && 'bg-background',
      className,
    ]"
    :style="{
      width: width ? `${width}px` : '100%',
      height: height ? `${height}px` : '100%',
      display: 'block',
    }"
  />
</template>

<script setup lang="ts">
/**
 * MatrixRain — faithful Vue 3 port of Componentry MatrixRain
 * Source: packages/ui/src/components/matrix-rain.tsx
 *
 * Uses canvas 2D with requestAnimationFrame + ResizeObserver.
 * Fully cleans up on unmount (clearInterval + disconnect observer).
 *
 * // export from index.ts
 */
import { ref, onMounted, onUnmounted, watch } from 'vue'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  className?: string
  variant?: 'default' | 'cyan' | 'rainbow'
  width?: number
  height?: number
  fontSize?: number
  speed?: number
  fixedColor?: string
  transparent?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  fontSize: 16,
  speed: 50,
  transparent: false,
})

// ─── Refs ─────────────────────────────────────────────────────────────────────

const canvasRef = ref<HTMLCanvasElement | null>(null)

// Internal handles kept outside reactive state for performance
let intervalId: ReturnType<typeof setInterval> | null = null
let resizeObserver: ResizeObserver | null = null

// ─── Core draw setup ──────────────────────────────────────────────────────────

function setup() {
  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Tear down previous loop before re-initialising
  teardown()

  // ── Sizing ──────────────────────────────────────────────────────────────────
  if (props.width)  canvas.width  = props.width
  if (props.height) canvas.height = props.height
  if (!props.width && !props.height) {
    canvas.width  = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
  }

  // ── Columns ─────────────────────────────────────────────────────────────────
  const columns = Math.floor(canvas.width / props.fontSize)
  // Each column tracks the y-position (in character rows) of the leading drop
  const drops: number[] = new Array(columns).fill(1)

  // ── Character set: Katakana + Numbers (matches original) ────────────────────
  const chars = 'ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ1234567890'

  // Track current theme so we can detect changes between frames
  let isDark = document.documentElement.classList.contains('dark')

  // Initial fill
  if (!props.transparent) {
    ctx.fillStyle = isDark ? '#000000' : '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  // ── Draw loop ───────────────────────────────────────────────────────────────
  const draw = () => {
    const nowDark = document.documentElement.classList.contains('dark')

    // Theme changed mid-flight — repaint the background
    if (nowDark !== isDark) {
      isDark = nowDark
      if (!props.transparent) {
        ctx.fillStyle = isDark ? '#000000' : '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
    }

    // Translucent overlay creates the trailing fade effect
    if (props.transparent) {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0,0,0,0.05)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.globalCompositeOperation = 'source-over'
    } else {
      ctx.fillStyle = isDark ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    ctx.font = `${props.fontSize}px monospace`

    for (let i = 0; i < drops.length; i++) {
      const text = chars[Math.floor(Math.random() * chars.length)] ?? ''

      // Colour selection
      if (props.fixedColor) {
        ctx.fillStyle = props.fixedColor
      } else if (props.variant === 'rainbow') {
        const hue = (Date.now() / 20 + i * 10) % 360
        ctx.fillStyle = `hsl(${hue},100%,50%)`
      } else if (props.variant === 'cyan') {
        ctx.fillStyle = isDark ? '#0FF' : '#0e7490'
      } else {
        // default — green
        ctx.fillStyle = isDark ? '#0F0' : '#15803d'
      }

      ctx.fillText(text, i * props.fontSize, (drops[i] as number) * props.fontSize)

      // Random reset when a column has scrolled past the bottom
      if ((drops[i] as number) * props.fontSize > canvas.height && Math.random() > 0.975) {
        drops[i] = 0
      }
      ;(drops[i] as number)++
    }
  }

  intervalId = setInterval(draw, props.speed)
}

// ─── Resize observer ──────────────────────────────────────────────────────────

function attachResizeObserver() {
  const canvas = canvasRef.value
  if (!canvas) return

  resizeObserver = new ResizeObserver(() => {
    // Only auto-resize when no explicit dimensions are provided
    if (!props.width && !props.height) {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      // Re-init so column count and drop array match the new size
      setup()
    }
  })
  resizeObserver.observe(canvas)
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

function teardown() {
  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  setup()
  attachResizeObserver()
})

// Re-init when any configuring prop changes (colour, speed, size, etc.)
watch(
  () => [
    props.variant,
    props.fontSize,
    props.speed,
    props.fixedColor,
    props.width,
    props.height,
    props.transparent,
  ],
  () => {
    setup()
  },
)

onUnmounted(() => {
  teardown()
})
</script>
