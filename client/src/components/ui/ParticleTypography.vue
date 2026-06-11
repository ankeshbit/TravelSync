<template>
  <div
    ref="containerRef"
    :class="[
      'w-full h-full min-h-[400px] flex items-center justify-center relative touch-none',
      className
    ]"
  >
    <canvas ref="canvasRef" class="block w-full h-full" />
  </div>
</template>

<script setup lang="ts">
/**
 * ParticleTypography — faithful Vue 3 port of Componentry CursorDrivenParticleTypography
 * Source: packages/ui/src/components/cursor-driven-particle-typography.tsx
 *
 * Implements a high-performance interactive text-to-particles visual effect
 * on canvas. Handles devicePixelRatio rendering scaling, custom particle physics,
 * theme mutation monitoring, resize observing, and touch interactions.
 *
 * // export from index.ts
 */
import { ref, onMounted, onUnmounted, watch } from 'vue'

interface Props {
  className?: string
  text: string
  fontSize?: number
  fontFamily?: string
  particleSize?: number
  particleDensity?: number
  dispersionStrength?: number
  returnSpeed?: number
  color?: string
}

const props = withDefaults(defineProps<Props>(), {
  fontSize: 120,
  fontFamily: 'Inter, sans-serif',
  particleSize: 1.5,
  particleDensity: 6,
  dispersionStrength: 15,
  returnSpeed: 0.08,
})

class Particle {
  x: number
  y: number
  originX: number
  originY: number
  vx: number
  vy: number
  size: number
  color: string
  dispersion: number
  returnSpd: number

  constructor(
    x: number,
    y: number,
    size: number,
    color: string,
    dispersion: number,
    returnSpd: number
  ) {
    this.x = x + (Math.random() - 0.5) * 10
    this.y = y + (Math.random() - 0.5) * 10
    this.originX = x
    this.originY = y
    this.vx = (Math.random() - 0.5) * 5
    this.vy = (Math.random() - 0.5) * 5
    this.size = size
    this.color = color
    this.dispersion = dispersion
    this.returnSpd = returnSpd
  }

  update(mouseX: number, mouseY: number) {
    const dx = mouseX - this.x
    const dy = mouseY - this.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    const interactionRadius = 120

    if (distance < interactionRadius && mouseX !== -1000 && mouseY !== -1000) {
      const forceDirectionX = dx / distance
      const forceDirectionY = dy / distance
      const force = (interactionRadius - distance) / interactionRadius
      const repulsionX = forceDirectionX * force * this.dispersion
      const repulsionY = forceDirectionY * force * this.dispersion
      this.vx -= repulsionX
      this.vy -= repulsionY
    }

    this.vx += (this.originX - this.x) * this.returnSpd
    this.vy += (this.originY - this.y) * this.returnSpd

    this.vx *= 0.85
    this.vy *= 0.85

    const distToOrigin = Math.sqrt(
      Math.pow(this.x - this.originX, 2) + Math.pow(this.y - this.originY, 2)
    )
    if (distToOrigin < 1 && Math.random() > 0.95) {
      this.vx += (Math.random() - 0.5) * 0.2
      this.vy += (Math.random() - 0.5) * 0.2
    }

    this.x += this.vx
    this.y += this.vy
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.color
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
    ctx.fill()
  }
}

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

let animationFrameId = 0
let particles: Particle[] = []
let mouseX = -1000
let mouseY = -1000
let containerWidth = 0
let containerHeight = 0
let ctx: CanvasRenderingContext2D | null = null

function init() {
  const canvas = canvasRef.value
  const container = containerRef.value
  if (!canvas || !container) return

  ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return

  containerWidth = container.clientWidth
  containerHeight = container.clientHeight
  const dpr = window.devicePixelRatio || 1

  canvas.width = containerWidth * dpr
  canvas.height = containerHeight * dpr
  canvas.style.width = `${containerWidth}px`
  canvas.style.height = `${containerHeight}px`

  ctx.scale(dpr, dpr)

  const computedStyle = window.getComputedStyle(container)
  const textColor = props.color || computedStyle.color || '#000000'

  ctx.clearRect(0, 0, containerWidth, containerHeight)
  ctx.fillStyle = textColor

  const effectiveFontSize = Math.min(props.fontSize, containerWidth * 0.15)
  ctx.font = `bold ${effectiveFontSize}px ${props.fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.fillText(props.text, containerWidth / 2, containerHeight / 2)

  const textCoordinates = ctx.getImageData(0, 0, canvas.width, canvas.height)
  particles = []

  const step = Math.max(1, Math.floor(props.particleDensity * dpr))
  for (let y = 0; y < textCoordinates.height; y += step) {
    for (let x = 0; x < textCoordinates.width; x += step) {
      const index = (y * textCoordinates.width + x) * 4
      const alpha = textCoordinates.data[index + 3] || 0
      if (alpha > 128) {
        particles.push(
          new Particle(
            x / dpr,
            y / dpr,
            props.particleSize,
            textColor,
            props.dispersionStrength,
            props.returnSpeed
          )
        )
      }
    }
  }
}

function animate() {
  if (!ctx) return
  ctx.clearRect(0, 0, containerWidth, containerHeight)
  particles.forEach((particle) => {
    particle.update(mouseX, mouseY)
    particle.draw(ctx!)
  })
  animationFrameId = requestAnimationFrame(animate)
}

function handleMouseMove(e: MouseEvent) {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  mouseX = e.clientX - rect.left
  mouseY = e.clientY - rect.top
}

function handleMouseLeave() {
  mouseX = -1000
  mouseY = -1000
}

function handleTouchStart(e: TouchEvent) {
  if (!e.touches[0]) return
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  mouseX = e.touches[0].clientX - rect.left
  mouseY = e.touches[0].clientY - rect.top
}

function handleTouchMove(e: TouchEvent) {
  if (!e.touches[0]) return
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  mouseX = e.touches[0].clientX - rect.left
  mouseY = e.touches[0].clientY - rect.top
}

let resizeObserver: ResizeObserver | null = null
let themeObserver: MutationObserver | null = null
let timeoutId = 0

watch(
  () => [
    props.text,
    props.fontSize,
    props.fontFamily,
    props.particleSize,
    props.particleDensity,
    props.dispersionStrength,
    props.returnSpeed,
    props.color,
  ],
  () => {
    init()
  }
)

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return

  timeoutId = window.setTimeout(() => {
    init()
    animate()
  }, 100)

  resizeObserver = new ResizeObserver(() => {
    init()
  })
  if (containerRef.value) {
    resizeObserver.observe(containerRef.value)
  }

  themeObserver = new MutationObserver(() => {
    init()
  })
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })

  canvas.addEventListener('mousemove', handleMouseMove)
  canvas.addEventListener('mouseleave', handleMouseLeave)
  canvas.addEventListener('touchstart', handleTouchStart, { passive: true })
  canvas.addEventListener('touchmove', handleTouchMove, { passive: true })
  canvas.addEventListener('touchend', handleMouseLeave, { passive: true })
})

onUnmounted(() => {
  clearTimeout(timeoutId)
  resizeObserver?.disconnect()
  themeObserver?.disconnect()
  cancelAnimationFrame(animationFrameId)

  const canvas = canvasRef.value
  if (canvas) {
    canvas.removeEventListener('mousemove', handleMouseMove)
    canvas.removeEventListener('mouseleave', handleMouseLeave)
    canvas.removeEventListener('touchstart', handleTouchStart)
    canvas.removeEventListener('touchmove', handleTouchMove)
    canvas.removeEventListener('touchend', handleMouseLeave)
  }
})
</script>
