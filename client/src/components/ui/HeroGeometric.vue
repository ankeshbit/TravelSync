<template>
  <div
    ref="containerRef"
    :class="['relative overflow-hidden', className]"
    :style="{ minHeight: height + 'px' }"
  >
    <!-- WebGL Background or CSS Fallback -->
    <div
      v-if="hasError"
      class="absolute inset-0"
      :style="fallbackStyle"
    />
    <canvas
      v-else
      ref="canvasRef"
      class="absolute inset-0 h-full w-full block pointer-events-none"
      style="width: 100%; height: 100%; display: block;"
    />

    <!-- SVG Geometric Overlay (Triangles + Grid Lines) -->
    <svg
      class="absolute inset-0 h-full w-full pointer-events-none z-5"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
    >
      <!-- Animated geometric triangles -->
      <polygon
        v-for="(t, i) in triangles"
        :key="i"
        :points="t.points"
        :fill="t.fill"
        :opacity="t.opacity"
        :style="{
          animation: `float${i % 3} ${t.duration}s ease-in-out infinite`,
          animationDelay: `${t.delay}s`,
          transformOrigin: 'center',
        }"
      />

      <!-- Grid lines -->
      <line
        v-for="i in 8"
        :key="`h${i}`"
        :x1="0"
        :y1="`${i * 12.5}%`"
        :x2="'100%'"
        :y2="`${i * 12.5}%`"
        :stroke="lineColor"
        stroke-width="0.5"
        stroke-opacity="0.08"
      />
      <line
        v-for="i in 12"
        :key="`v${i}`"
        :x1="`${i * 8.333}%`"
        y1="0"
        :x2="`${i * 8.333}%`"
        y2="100%"
        :stroke="lineColor"
        stroke-width="0.5"
        stroke-opacity="0.08"
      />
    </svg>

    <!-- Content slot on top -->
    <div class="relative z-10">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * HeroGeometric — faithful Vue 3 port of Componentry HeroGeometric
 * Source: packages/ui/src/components/hero-geometric.tsx
 *
 * Implements a geometric hero background layering an animated SVG triangles
 * grid on top of a WebGL simplex noise gradient shader with Bayer ordered dithering.
 *
 * // export from index.ts
 */
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'

interface Props {
  height?: number
  accent1?: string
  accent2?: string
  lineColor?: string
  speed?: number
  className?: string
}

const props = withDefaults(defineProps<Props>(), {
  height: 600,
  accent1: '#3B82F6', // Default soft blue
  accent2: '#F0F9FF', // Default pale blue
  lineColor: '#ffffff',
  speed: 1,
})

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const hasError = ref(false)

// Fallback CSS Gradient Style
const fallbackStyle = computed(() => ({
  background: `linear-gradient(135deg, ${props.accent1}, ${props.accent2})`,
}))

// Floating SVG triangles config
const triangles = computed(() => [
  { points: '0,0 200,0 0,200', fill: props.accent1, opacity: 0.08, duration: 8, delay: 0 },
  { points: '800,0 560,0 800,240', fill: props.accent2, opacity: 0.1, duration: 10, delay: 1.5 },
  { points: '400,600 240,360 560,360', fill: props.accent1, opacity: 0.06, duration: 12, delay: 0.5 },
  { points: '160,480 40,300 320,330', fill: props.accent2, opacity: 0.07, duration: 9, delay: 2 },
  { points: '640,480 800,300 800,600', fill: props.accent1, opacity: 0.09, duration: 11, delay: 0.8 },
])

// ─── WebGL Shaders ────────────────────────────────────────────────────────────

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
uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColor1;
uniform vec3 uColor2;
varying vec2 vUv;

vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy) );
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m;
  m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float bayerDither4x4(vec2 uv) {
  int x = int(mod(uv.x, 4.0));
  int y = int(mod(uv.y, 4.0));
  int matrix[16];
  matrix[0] = 0; matrix[1] = 8; matrix[2] = 2; matrix[3] = 10;
  matrix[4] = 12; matrix[5] = 4; matrix[6] = 14; matrix[7] = 6;
  matrix[8] = 3; matrix[9] = 11; matrix[10] = 1; matrix[11] = 9;
  matrix[12] = 15; matrix[13] = 7; matrix[14] = 13; matrix[15] = 5;
  
  int idx = y * 4 + x;
  for (int i = 0; i < 16; i++) {
    if (i == idx) return float(matrix[i]) / 16.0;
  }
  return 0.0;
}

void main() {
  vec2 uv = vUv;
  vec2 coord = gl_FragCoord.xy;
  
  float noise = snoise(uv * 1.5 + vec2(uTime * 0.05, uTime * 0.03)) * 0.25;
  float diagonal = (uv.x + uv.y) * 0.5;
  float gradient = diagonal * 1.2 + noise;
  
  vec3 deepBlue = uColor1;
  vec3 paleBlue = uColor2;
  vec3 softBlue = mix(deepBlue, paleBlue, 0.33);
  vec3 lightBlue = mix(deepBlue, paleBlue, 0.66);
  
  vec3 color;
  if (gradient < 0.3) {
    color = deepBlue;
  } else if (gradient < 0.55) {
    color = softBlue;
  } else if (gradient < 0.8) {
    color = lightBlue;
  } else {
    color = paleBlue;
  }
  
  float dither = bayerDither4x4(coord);
  float threshold = fract(gradient * 4.0);
  if (gradient < 0.3 && threshold > dither * 0.5) {
    color = softBlue;
  } else if (gradient >= 0.3 && gradient < 0.55 && threshold > dither * 0.5) {
    color = lightBlue;
  } else if (gradient >= 0.55 && gradient < 0.8 && threshold > dither * 0.5) {
    color = paleBlue;
  }
  
  vec2 cornerDist = vec2(uv.x, uv.y);
  float fadeMask = smoothstep(0.0, 0.25, length(cornerDist));
  color = mix(vec3(1.0), color, fadeMask);
  
  float vignette = smoothstep(1.2, 0.3, length(uv - 0.5));
  color = mix(color, color * 0.95, (1.0 - vignette) * 0.3);
  
  gl_FragColor = vec4(color, 1.0);
}
`

// ─── WebGL Lifecycle ──────────────────────────────────────────────────────────

let gl: WebGLRenderingContext | null = null
let program: WebGLProgram | null = null
let vs: WebGLShader | null = null
let fs: WebGLShader | null = null
let buffer: WebGLBuffer | null = null

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace('#', '')
  if (v.length === 3) {
    return [
      parseInt(v.charAt(0) + v.charAt(0), 16) / 255,
      parseInt(v.charAt(1) + v.charAt(1), 16) / 255,
      parseInt(v.charAt(2) + v.charAt(2), 16) / 255,
    ]
  }
  return [
    parseInt(v.slice(0, 2), 16) / 255,
    parseInt(v.slice(2, 4), 16) / 255,
    parseInt(v.slice(4, 6), 16) / 255,
  ]
}

function initWebGL() {
  const canvas = canvasRef.value
  if (!canvas) return

  gl = canvas.getContext('webgl', { antialias: false, alpha: true })
  if (!gl) {
    hasError.value = true
    return
  }

  vs = gl.createShader(gl.VERTEX_SHADER)
  if (!vs) return
  gl.shaderSource(vs, VERTEX_SHADER)
  gl.compileShader(vs)
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
    hasError.value = true
    return
  }

  fs = gl.createShader(gl.FRAGMENT_SHADER)
  if (!fs) return
  gl.shaderSource(fs, FRAGMENT_SHADER)
  gl.compileShader(fs)
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
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
}

let resizeObserver: ResizeObserver | null = null

function handleResize() {
  const canvas = canvasRef.value
  const container = containerRef.value
  if (!canvas || !container || !gl) return

  const rect = container.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 1.75)
  canvas.width = Math.max(1, Math.floor(rect.width * dpr))
  canvas.height = Math.max(1, Math.floor(rect.height * dpr))
  canvas.style.width = `${rect.width}px`
  canvas.style.height = `${rect.height}px`
  gl.viewport(0, 0, canvas.width, canvas.height)
}

function disposeWebGL() {
  if (gl) {
    if (buffer) gl.deleteBuffer(buffer)
    if (vs) gl.deleteShader(vs)
    if (fs) gl.deleteShader(fs)
    if (program) gl.deleteProgram(program)

    const lose = gl.getExtension('WEBGL_lose_context')
    if (lose) lose.loseContext()
  }
  gl = null
  program = null
  vs = null
  fs = null
  buffer = null
}

// ─── Rendering Loop ───────────────────────────────────────────────────────────

let rafId = 0
let start = performance.now()

function render(now: number) {
  const elapsed = (now - start) / 1000 * props.speed
  const canvas = canvasRef.value

  if (canvas && gl && program) {
    gl.useProgram(program)

    const uTime = gl.getUniformLocation(program, 'uTime')
    const uResolution = gl.getUniformLocation(program, 'uResolution')
    const uColor1 = gl.getUniformLocation(program, 'uColor1')
    const uColor2 = gl.getUniformLocation(program, 'uColor2')

    gl.uniform1f(uTime, elapsed)
    gl.uniform2f(uResolution, canvas.width, canvas.height)

    const c1 = hexToRgb(props.accent1)
    const c2 = hexToRgb(props.accent2)
    gl.uniform3f(uColor1, c1[0], c1[1], c1[2])
    gl.uniform3f(uColor2, c2[0], c2[1], c2[2])

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  rafId = requestAnimationFrame(render)
}

onMounted(() => {
  const container = containerRef.value
  if (container) {
    initWebGL()
    if (!hasError.value) {
      handleResize()
      resizeObserver = new ResizeObserver(handleResize)
      resizeObserver.observe(container)
    }
    start = performance.now()
    rafId = requestAnimationFrame(render)
  }
})

onUnmounted(() => {
  cancelAnimationFrame(rafId)
  resizeObserver?.disconnect()
  disposeWebGL()
})

watch(() => [props.accent1, props.accent2], () => {
  if (hasError.value) {
    initWebGL()
  }
})
</script>

<style scoped>
@keyframes float0 {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(3deg); }
}
@keyframes float1 {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(15px) rotate(-5deg); }
}
@keyframes float2 {
  0%, 100% { transform: translateX(0px) translateY(0px); }
  50% { transform: translateX(10px) translateY(-10px); }
}
</style>
