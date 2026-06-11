<template>
  <div
    ref="containerRef"
    class="relative h-[560px] w-full overflow-hidden text-white"
    @pointermove="handlePointerMove"
    v-bind="$attrs"
  >
    <!-- WebGL Canvas or Fallback -->
    <div
      v-if="hasError"
      class="absolute inset-0 flex items-center justify-center bg-zinc-950 gap-4"
    >
      <img
        v-for="(img, idx) in images"
        :key="idx"
        :src="img.src"
        class="max-h-[300px] object-cover rounded-lg shadow-lg"
        alt="fallback image"
      />
    </div>
    <canvas
      v-else
      ref="canvasRef"
      class="absolute inset-0 h-full w-full block pointer-events-none"
      style="width: 100%; height: 100%; display: block;"
    />

    <!-- Slot content on top -->
    <div v-if="$slots.default" class="pointer-events-none absolute inset-0 z-10">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ImageRipple — faithful Vue 3 port of Componentry ImageRippleEffect
 * Source: packages/ui/src/components/image-ripple-effect.tsx
 *
 * WebGL-based pointer-driven ripple displacement deformation on image textures,
 * using dual offscreen canvases for displacement mapping and image grid layouts.
 *
 * // export from index.ts
 */
import { ref, onMounted, onUnmounted, watch } from 'vue'

export interface RippleImageItem {
  src: string
  x?: number
  y?: number
  widthScale?: number
  heightScale?: number
}

interface Props {
  images?: RippleImageItem[]
  distortionStrength?: number
  waveCount?: number
  waveSize?: number
  waveRotationSpeed?: number
  waveFadeMultiplier?: number
  waveGrowth?: number
  waveSpawnThreshold?: number
  className?: string
}

// Generate fallback SVGs if no images are supplied
function createDemoImage(title: string, colorA: string, colorB: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${colorA}" />
          <stop offset="100%" stop-color="${colorB}" />
        </linearGradient>
      </defs>
      <rect width="800" height="1000" fill="url(#g)"/>
      <circle cx="610" cy="180" r="130" fill="white" fill-opacity="0.12"/>
      <circle cx="180" cy="760" r="190" fill="white" fill-opacity="0.12"/>
      <text x="64" y="900" fill="white" font-size="64" font-family="system-ui, sans-serif" opacity="0.9">
        ${title}
      </text>
    </svg>
  `
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const DEFAULT_IMAGES: RippleImageItem[] = [
  { src: createDemoImage('Aurora', '#0f172a', '#155e75') },
]

const props = withDefaults(defineProps<Props>(), {
  images: () => DEFAULT_IMAGES,
  distortionStrength: 0.075,
  waveCount: 100,
  waveSize: 60,
  waveRotationSpeed: 0.025,
  waveFadeMultiplier: 0.95,
  waveGrowth: 0.155,
  waveSpawnThreshold: 0.1,
  className: '',
})

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const hasError = ref(false)

// Interaction
const pointerX = ref(0)
const pointerY = ref(0)
const prevPointerX = ref(0)
const prevPointerY = ref(0)

function handlePointerMove(e: PointerEvent) {
  const container = containerRef.value
  if (!container) return
  const rect = container.getBoundingClientRect()
  pointerX.value = e.clientX - rect.left
  pointerY.value = e.clientY - rect.top
}

// ─── Offscreen Canvases ───────────────────────────────────────────────────────

let imageCanvas: HTMLCanvasElement | null = null
let rippleCanvas: HTMLCanvasElement | null = null
let loadedImages: HTMLImageElement[] = []

interface RippleSpot {
  x: number
  y: number
  size: number
  opacity: number
  rotation: number
}

const activeRipples = ref<RippleSpot[]>([])

function loadImages() {
  loadedImages = props.images.map((item) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = item.src
    img.onload = () => {
      drawImagesToCanvas()
    }
    return img
  })
}

function drawImagesToCanvas() {
  if (!imageCanvas) return
  const ctx = imageCanvas.getContext('2d')
  if (!ctx) return

  const W = imageCanvas.width
  const H = imageCanvas.height
  ctx.clearRect(0, 0, W, H)

  props.images.forEach((item, index) => {
    const img = loadedImages[index]
    if (img && img.complete && img.naturalWidth > 0) {
      const x = (item.x ?? (index - (props.images.length - 1) / 2) * 0.25) * W + W / 2
      const y = (item.y ?? 0) * H + H / 2
      const w = W * (item.widthScale ?? 0.22)
      const h = W * (item.heightScale ?? 0.28)
      ctx.drawImage(img, x - w / 2, y - h / 2, w, h)
    }
  })
}

function drawRipplesToCanvas() {
  if (!rippleCanvas) return
  const ctx = rippleCanvas.getContext('2d')
  if (!ctx) return

  const W = rippleCanvas.width
  const H = rippleCanvas.height
  ctx.clearRect(0, 0, W, H)

  activeRipples.value.forEach((r) => {
    ctx.beginPath()
    const grad = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, r.size)
    grad.addColorStop(0, `rgba(255,255,255,${r.opacity})`)
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.arc(r.x, r.y, r.size, 0, Math.PI * 2)
    ctx.fill()
  })
}

// ─── WebGL Lifecycle ──────────────────────────────────────────────────────────

const VERTEX_SHADER = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `
precision highp float;
uniform sampler2D uTexture;
uniform sampler2D uDisplacement;
uniform vec2 winResolution;
uniform float uStrength;
varying vec2 vUv;

const float PI = 3.141592653589793238;

void main() {
  vec4 displacement = texture2D(uDisplacement, vUv);
  float theta = displacement.r * 2.0 * PI;
  vec2 dir = vec2(sin(theta), cos(theta));
  vec2 uv = vUv + dir * displacement.r * uStrength;
  vec4 color = texture2D(uTexture, uv);
  gl_FragColor = color;
}
`

let gl: WebGLRenderingContext | null = null
let program: WebGLProgram | null = null
let vs: WebGLShader | null = null
let fs: WebGLShader | null = null
let buffer: WebGLBuffer | null = null
let texImage: WebGLTexture | null = null
let texDisplacement: WebGLTexture | null = null

function initWebGL() {
  const canvas = canvasRef.value
  if (!canvas) return

  gl = canvas.getContext('webgl', { antialias: false, alpha: true })
  if (!gl) {
    hasError.value = true
    return
  }

  const compile = (type: number, src: string) => {
    const shader = gl!.createShader(type)
    if (!shader) return null
    gl!.shaderSource(shader, src)
    gl!.compileShader(shader)
    if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
      gl!.deleteShader(shader)
      return null
    }
    return shader
  }

  vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER)
  fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
  if (!vs || !fs) {
    hasError.value = true
    return
  }

  program = gl.createProgram()
  if (!program) return
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    hasError.value = true
    return
  }

  gl.useProgram(program)

  buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  )

  const pos = gl.getAttribLocation(program, 'position')
  gl.enableVertexAttribArray(pos)
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0)

  // Texture bindings
  texImage = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texImage)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

  texDisplacement = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texDisplacement)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
}

let resizeObserver: ResizeObserver | null = null

function handleResize() {
  const canvas = canvasRef.value
  const container = containerRef.value
  if (!canvas || !container || !gl) return

  const rect = container.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 1.75)
  const W = Math.max(1, Math.floor(rect.width * dpr))
  const H = Math.max(1, Math.floor(rect.height * dpr))

  canvas.width = W
  canvas.height = H
  gl.viewport(0, 0, W, H)

  // Resize offscreen canvases
  if (imageCanvas) {
    imageCanvas.width = W
    imageCanvas.height = H
  }
  if (rippleCanvas) {
    rippleCanvas.width = W
    rippleCanvas.height = H
  }

  drawImagesToCanvas()
}

function disposeWebGL() {
  if (gl) {
    if (buffer) gl.deleteBuffer(buffer)
    if (vs) gl.deleteShader(vs)
    if (fs) gl.deleteShader(fs)
    if (program) gl.deleteProgram(program)
    if (texImage) gl.deleteTexture(texImage)
    if (texDisplacement) gl.deleteTexture(texDisplacement)

    const lose = gl.getExtension('WEBGL_lose_context')
    if (lose) lose.loseContext()
  }
  gl = null
  program = null
  vs = null
  fs = null
  buffer = null
}

// ─── Render Loop ──────────────────────────────────────────────────────────────

let rafId = 0

function render() {
  const canvas = canvasRef.value
  if (!canvas || hasError.value || !gl || !program) return

  // Spawn new ripples if mouse moved past threshold
  const dx = pointerX.value - prevPointerX.value
  const dy = pointerY.value - prevPointerY.value
  const distance = Math.hypot(dx, dy)

  if (distance > props.waveSpawnThreshold) {
    activeRipples.value.push({
      x: pointerX.value * (window.devicePixelRatio || 1),
      y: (canvas.height / (window.devicePixelRatio || 1) - pointerY.value) * (window.devicePixelRatio || 1), // flip y coordinate to match WebGL space
      size: props.waveSize,
      opacity: 1,
      rotation: Math.random() * Math.PI,
    })
    prevPointerX.value = pointerX.value
    prevPointerY.value = pointerY.value
  }

  // Update existing ripples
  activeRipples.value.forEach((r) => {
    r.size = 0.98 * r.size + props.waveGrowth
    r.opacity *= props.waveFadeMultiplier
    r.rotation += props.waveRotationSpeed
  })
  // Remove dead ripples
  activeRipples.value = activeRipples.value.filter((r) => r.opacity > 0.01)

  // Draw displacement offscreen canvas
  drawRipplesToCanvas()

  gl.useProgram(program)

  // Upload displacement texture
  gl.activeTexture(gl.TEXTURE1)
  gl.bindTexture(gl.TEXTURE_2D, texDisplacement)
  if (rippleCanvas) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, rippleCanvas)
  }

  // Upload image texture
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, texImage)
  if (imageCanvas) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageCanvas)
  }

  // Bind uniforms
  const uTexture = gl.getUniformLocation(program, 'uTexture')
  const uDisplacement = gl.getUniformLocation(program, 'uDisplacement')
  const winResolution = gl.getUniformLocation(program, 'winResolution')
  const uStrength = gl.getUniformLocation(program, 'uStrength')

  gl.uniform1i(uTexture, 0)
  gl.uniform1i(uDisplacement, 1)
  gl.uniform2f(winResolution, canvas.width, canvas.height)
  gl.uniform1f(uStrength, props.distortionStrength)

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

  rafId = requestAnimationFrame(render)
}

onMounted(() => {
  const container = containerRef.value
  if (!container) return

  // Initialize offscreen canvases
  imageCanvas = document.createElement('canvas')
  rippleCanvas = document.createElement('canvas')

  initWebGL()
  if (!hasError.value) {
    handleResize()
    resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(container)
    loadImages()
    rafId = requestAnimationFrame(render)
  }
})

onUnmounted(() => {
  cancelAnimationFrame(rafId)
  resizeObserver?.disconnect()
  disposeWebGL()
  imageCanvas = null
  rippleCanvas = null
})

watch(() => props.images, () => {
  loadImages()
}, { deep: true })
</script>
