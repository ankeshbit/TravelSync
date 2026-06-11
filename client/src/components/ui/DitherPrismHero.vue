<template>
  <div
    ref="containerRef"
    :class="['relative w-full overflow-hidden', className]"
    :style="style"
  >
    <!-- WebGL Canvas or CSS fallback -->
    <div
      v-if="hasError"
      class="absolute inset-0"
      :style="fallbackStyle"
    />
    <canvas
      v-else
      ref="canvasRef"
      class="absolute inset-0 h-full w-full block"
      style="pointer-events: none;"
    />

    <!-- Particles 2D Canvas Layer -->
    <canvas
      v-if="showParticles && !hasError"
      ref="particlesRef"
      class="absolute inset-0 h-full w-full block pointer-events-none"
    />

    <!-- Content overlay -->
    <div class="relative z-10 w-full">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * DitherPrismHero — faithful Vue 3 port of Componentry DitherPrismHero
 * Source: packages/ui/src/components/dither-prism-hero.tsx
 *
 * WebGL-driven dithered liquid background with chromatic refraction,
 * simplex noise FBM waves, mouse interaction ripples/glow, and floating particles.
 *
 * // export from index.ts
 */
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'

interface Props {
  className?: string
  style?: any
  color1?: string
  color2?: string
  color3?: string
  speed?: number
  ditherIntensity?: number
  prismIntensity?: number
  particleCount?: number
  showParticles?: boolean
  particleColor?: string
}

const props = withDefaults(defineProps<Props>(), {
  color1: '#0f0f23',
  color2: '#6366f1',
  color3: '#ec4899',
  speed: 1,
  ditherIntensity: 0.15,
  prismIntensity: 0.5,
  particleCount: 50,
  showParticles: true,
  particleColor: '#ffffff',
})

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const particlesRef = ref<HTMLCanvasElement | null>(null)
const hasError = ref(false)

// Fallback CSS Gradient Style
const fallbackStyle = computed(() => ({
  background: `linear-gradient(135deg, ${props.color1}, ${props.color2}, ${props.color3})`,
}))

// Mouse Tracking
const mouseX = ref(0.5)
const mouseY = ref(0.5)
const targetMouseX = ref(0.5)
const targetMouseY = ref(0.5)

function handleMouseMove(e: MouseEvent) {
  const container = containerRef.value
  if (!container) return
  const rect = container.getBoundingClientRect()
  targetMouseX.value = (e.clientX - rect.left) / rect.width
  targetMouseY.value = 1.0 - ((e.clientY - rect.top) / rect.height)
}

function handleTouchMove(e: TouchEvent) {
  if (!e.touches[0]) return
  const container = containerRef.value
  if (!container) return
  const rect = container.getBoundingClientRect()
  targetMouseX.value = (e.touches[0].clientX - rect.left) / rect.width
  targetMouseY.value = 1.0 - ((e.touches[0].clientY - rect.top) / rect.height)
}

function handleMouseLeave() {
  targetMouseX.value = 0.5
  targetMouseY.value = 0.5
}

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
uniform vec2 uMouse;
uniform float uMouseIntensity;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uDitherIntensity;
uniform float uPrismIntensity;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }

vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    value += amplitude * snoise(p * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

float bayer8x8(vec2 uv) {
  ivec2 p = ivec2(mod(uv, 8.0));
  int matrix[64];
  matrix[0] = 0; matrix[1] = 32; matrix[2] = 8; matrix[3] = 40; matrix[4] = 2; matrix[5] = 34; matrix[6] = 10; matrix[7] = 42;
  matrix[8] = 48; matrix[9] = 16; matrix[10] = 56; matrix[11] = 24; matrix[12] = 50; matrix[13] = 18; matrix[14] = 58; matrix[15] = 26;
  matrix[16] = 12; matrix[17] = 44; matrix[18] = 4; matrix[19] = 36; matrix[20] = 14; matrix[21] = 46; matrix[22] = 6; matrix[23] = 38;
  matrix[24] = 60; matrix[25] = 28; matrix[26] = 52; matrix[27] = 20; matrix[28] = 62; matrix[29] = 30; matrix[30] = 54; matrix[31] = 22;
  matrix[32] = 3; matrix[33] = 35; matrix[34] = 11; matrix[35] = 43; matrix[36] = 1; matrix[37] = 33; matrix[38] = 9; matrix[39] = 41;
  matrix[40] = 51; matrix[41] = 19; matrix[42] = 59; matrix[43] = 27; matrix[44] = 49; matrix[45] = 17; matrix[46] = 57; matrix[47] = 25;
  matrix[48] = 15; matrix[49] = 47; matrix[50] = 7; matrix[51] = 39; matrix[52] = 13; matrix[53] = 45; matrix[54] = 5; matrix[55] = 37;
  matrix[56] = 63; matrix[57] = 31; matrix[58] = 55; matrix[59] = 23; matrix[60] = 61; matrix[61] = 29; matrix[62] = 53; matrix[63] = 21;
  
  // Lookup manual index in 1D mapping to compile on WebGL 1.0 ES
  int idx = p.y * 8 + p.x;
  for (int i = 0; i < 64; i++) {
    if (i == idx) return float(matrix[i]) / 64.0;
  }
  return 0.0;
}

float blueNoise(vec2 uv, float time) {
  float n1 = hash(uv + vec2(time * 0.1, 0.0));
  float n2 = hash(uv * 2.1 + vec2(0.0, time * 0.13));
  float n3 = hash(uv * 4.3 + vec2(time * 0.07, time * 0.11));
  return fract(n1 + n2 * 0.5 + n3 * 0.25);
}

vec3 prism(vec2 uv, float time, float intensity) {
  float angle = atan(uv.y - 0.5, uv.x - 0.5);
  float dist = length(uv - 0.5);
  float prismAngle = angle + time * 0.3 + dist * 3.0;
  float r = 0.5 + 0.5 * sin(prismAngle);
  float g = 0.5 + 0.5 * sin(prismAngle + 2.094);
  float b = 0.5 + 0.5 * sin(prismAngle + 4.188);
  return vec3(r, g, b) * intensity;
}

vec3 iridescence(vec2 uv, float time) {
  float t = time * 0.5;
  vec2 p = uv * 3.0;
  float n1 = snoise(p + vec2(t, 0.0));
  float n2 = snoise(p * 1.3 + vec2(0.0, t * 0.7));
  float n3 = snoise(p * 0.7 + vec2(t * 0.5, t * 0.3));
  vec3 col1 = vec3(0.5 + 0.5 * sin(n1 * 3.14159 + t));
  vec3 col2 = vec3(0.5 + 0.5 * sin(n2 * 3.14159 + t * 1.3 + 2.0));
  vec3 col3 = vec3(0.5 + 0.5 * sin(n3 * 3.14159 + t * 0.7 + 4.0));
  return (col1 + col2 + col3) / 3.0;
}

float diamond(vec2 p) {
  return abs(p.x) + abs(p.y);
}

float morphShape(vec2 uv, float time) {
  float morph = sin(time * 0.4) * 0.5 + 0.5;
  vec2 p = uv * 4.0 - 2.0;
  p = p + vec2(sin(time * 0.3), cos(time * 0.4)) * 0.5;
  float circle = length(p) - 1.0;
  float diam = diamond(p) - 1.4;
  float shape = mix(circle, diam, morph);
  vec2 q = mod(uv * 8.0, 2.0) - 1.0;
  float multiShape = mix(length(q), diamond(q), morph) - 0.3;
  return min(shape, multiShape);
}

float mouseRipple(vec2 uv, vec2 mouse, float time, float intensity) {
  float dist = length(uv - mouse);
  float ripple1 = sin(dist * 40.0 - time * 5.0) * exp(-dist * 3.0);
  float ripple2 = sin(dist * 25.0 - time * 3.5 + 1.0) * exp(-dist * 4.0);
  float ripple3 = sin(dist * 60.0 - time * 7.0) * exp(-dist * 5.0);
  return (ripple1 + ripple2 * 0.5 + ripple3 * 0.3) * intensity;
}

vec3 mouseGlow(vec2 uv, vec2 mouse, float time, float intensity, vec3 glowColor) {
  float dist = length(uv - mouse);
  float core = exp(-dist * 15.0) * 1.5;
  float outer = exp(-dist * 5.0) * 0.8;
  float pulse = 0.8 + 0.2 * sin(time * 3.0);
  float chromatic = sin(dist * 30.0 + time * 2.0) * exp(-dist * 8.0);
  vec3 rainbow = vec3(
    sin(time * 2.0) * 0.5 + 0.5,
    sin(time * 2.0 + 2.094) * 0.5 + 0.5,
    sin(time * 2.0 + 4.188) * 0.5 + 0.5
  );
  vec3 glow = glowColor * (core + outer) * pulse * intensity;
  glow += rainbow * chromatic * intensity * 0.5;
  return glow;
}

vec2 mouseLensDistort(vec2 uv, vec2 mouse, float intensity) {
  vec2 delta = uv - mouse;
  float dist = length(delta);
  float distortion = exp(-dist * 6.0) * intensity * 0.15;
  return uv + normalize(delta + 0.001) * distortion;
}

void main() {
  vec2 uv = vUv;
  vec2 pixelCoord = gl_FragCoord.xy;
  float time = uTime;

  vec2 distortedUv = mouseLensDistort(uv, uMouse, uMouseIntensity);

  float noise1 = fbm(distortedUv * 2.0 + vec2(time * 0.05, time * 0.03), 4);
  float noise2 = fbm(distortedUv * 3.0 + vec2(-time * 0.04, time * 0.06), 3);
  float diagonal = (distortedUv.x + distortedUv.y) * 0.5;
  float flow = diagonal + noise1 * 0.3 + noise2 * 0.2;
  flow += sin(time * 0.2) * 0.1;

  vec3 col;
  float t1 = smoothstep(0.0, 0.5, flow);
  float t2 = smoothstep(0.5, 1.0, flow);
  col = mix(uColor1, uColor2, t1);
  col = mix(col, uColor3, t2);

  vec3 prismColor = prism(distortedUv, time, uPrismIntensity);
  float edgeMask = abs(fract(flow * 5.0) - 0.5) * 2.0;
  edgeMask = smoothstep(0.3, 0.7, edgeMask);
  col += prismColor * edgeMask * 0.4;

  vec3 iris = iridescence(distortedUv, time);
  float irisMask = snoise(distortedUv * 5.0 + time * 0.1);
  irisMask = smoothstep(-0.2, 0.8, irisMask) * 0.15;
  col = mix(col, iris, irisMask);

  float shape = morphShape(distortedUv, time);
  float shapeMask = 1.0 - smoothstep(-0.1, 0.1, shape);
  col = mix(col, col * 1.15 + vec3(0.08), shapeMask * 0.3);

  float ripple = mouseRipple(uv, uMouse, time, uMouseIntensity);
  col += ripple * prismColor * 1.2;
  col += ripple * vec3(0.3, 0.2, 0.4);

  vec3 glow = mouseGlow(uv, uMouse, time, uMouseIntensity, vec3(1.0, 0.8, 1.0));
  col += glow;

  float mouseDist = length(uv - uMouse);
  float proximityBoost = exp(-mouseDist * 4.0) * uMouseIntensity;
  col = mix(col, col * 1.5 + prismColor * 0.3, proximityBoost);

  float bayer = bayer8x8(pixelCoord);
  float blue = blueNoise(pixelCoord * 0.1, time);
  float ditherPattern = mix(bayer, blue, 0.3 + 0.2 * sin(time * 0.5));
  vec3 ditherOffset = (vec3(ditherPattern) - 0.5) * uDitherIntensity;
  col += ditherOffset;

  float levels = 16.0;
  vec3 quantized = floor(col * levels + ditherPattern) / levels;
  col = mix(col, quantized, uDitherIntensity * 0.5);

  float scanline = sin(pixelCoord.y * 2.0 + time * 2.0) * 0.02;
  col += scanline * uDitherIntensity;

  float vignette = 1.0 - length((uv - 0.5) * 1.2);
  vignette = smoothstep(0.0, 0.7, vignette);
  col *= 0.85 + vignette * 0.15;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`

// ─── WebGL Lifecycle ──────────────────────────────────────────────────────────

let gl: WebGLRenderingContext | null = null
let program: WebGLProgram | null = null
let vs: WebGLShader | null = null
let fs: WebGLShader | null = null
let buffer: WebGLBuffer | null = null

function hexToRgb(h: string): [number, number, number] {
  const v = h.replace('#', '')
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

// ─── Floating 2D Particles Layer ──────────────────────────────────────────────

interface Particle {
  x: number
  y: number
  size: number
  phase: number
  speedX: number
  speedY: number
}

let particles: Particle[] = []

function initParticles(width: number, height: number) {
  particles = []
  for (let i = 0; i < props.particleCount; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2.5 + 0.5,
      phase: Math.random() * Math.PI * 2,
      speedX: (Math.random() - 0.5) * 0.2,
      speedY: -Math.random() * 0.4 - 0.1,
    })
  }
}

function updateParticles2D(ctx: CanvasRenderingContext2D, width: number, height: number, time: number) {
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = props.particleColor

  particles.forEach((p) => {
    p.y += p.speedY + Math.sin(time + p.phase) * 0.1
    p.x += p.speedX + Math.cos(time * 0.5 + p.phase) * 0.05

    // Wrap-around logic
    if (p.y < -10) p.y = height + 10
    if (p.x < -10) p.x = width + 10
    if (p.x > width + 10) p.x = -10

    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fill()
  })
}

// ─── Rendering Loop ───────────────────────────────────────────────────────────

let rafId = 0
let start = performance.now()

function render(now: number) {
  const elapsed = (now - start) / 1000 * props.speed

  // Interpolate mouse coordinates smoothly
  mouseX.value += (targetMouseX.value - mouseX.value) * 0.08
  mouseY.value += (targetMouseY.value - mouseY.value) * 0.08

  const canvas = canvasRef.value
  if (canvas && gl && program) {
    gl.useProgram(program)

    // Set Uniforms
    const uTime = gl.getUniformLocation(program, 'uTime')
    const uResolution = gl.getUniformLocation(program, 'uResolution')
    const uMouse = gl.getUniformLocation(program, 'uMouse')
    const uMouseIntensity = gl.getUniformLocation(program, 'uMouseIntensity')
    const uColor1 = gl.getUniformLocation(program, 'uColor1')
    const uColor2 = gl.getUniformLocation(program, 'uColor2')
    const uColor3 = gl.getUniformLocation(program, 'uColor3')
    const uDitherIntensity = gl.getUniformLocation(program, 'uDitherIntensity')
    const uPrismIntensity = gl.getUniformLocation(program, 'uPrismIntensity')

    gl.uniform1f(uTime, elapsed)
    gl.uniform2f(uResolution, canvas.width, canvas.height)
    gl.uniform2f(uMouse, mouseX.value, mouseY.value)
    gl.uniform1f(uMouseIntensity, 0.8)

    const c1 = hexToRgb(props.color1)
    const c2 = hexToRgb(props.color2)
    const c3 = hexToRgb(props.color3)
    gl.uniform3f(uColor1, c1[0], c1[1], c1[2])
    gl.uniform3f(uColor2, c2[0], c2[1], c2[2])
    gl.uniform3f(uColor3, c3[0], c3[1], c3[2])

    gl.uniform1f(uDitherIntensity, props.ditherIntensity)
    gl.uniform1f(uPrismIntensity, props.prismIntensity)

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  // Draw 2D floating particles
  const pCanvas = particlesRef.value
  if (pCanvas && props.showParticles) {
    const pCtx = pCanvas.getContext('2d')
    if (pCtx) {
      if (pCanvas.width !== pCanvas.clientWidth || pCanvas.height !== pCanvas.clientHeight) {
        const dpr = window.devicePixelRatio || 1
        pCanvas.width = pCanvas.clientWidth * dpr
        pCanvas.height = pCanvas.clientHeight * dpr
        pCtx.scale(dpr, dpr)
        initParticles(pCanvas.clientWidth, pCanvas.clientHeight)
      }
      updateParticles2D(pCtx, pCanvas.width / (window.devicePixelRatio || 1), pCanvas.height / (window.devicePixelRatio || 1), elapsed)
    }
  }

  rafId = requestAnimationFrame(render)
}

onMounted(() => {
  const container = containerRef.value
  if (container) {
    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mouseleave', handleMouseLeave)
    container.addEventListener('touchstart', handleTouchMove, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: true })
    container.addEventListener('touchend', handleMouseLeave, { passive: true })

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

  const container = containerRef.value
  if (container) {
    container.removeEventListener('mousemove', handleMouseMove)
    container.removeEventListener('mouseleave', handleMouseLeave)
    container.removeEventListener('touchstart', handleTouchMove)
    container.removeEventListener('touchmove', handleTouchMove)
    container.removeEventListener('touchend', handleMouseLeave)
  }
})

watch(() => [props.color1, props.color2, props.color3], () => {
  // Clear error flag if colors update, allowing re-initialization attempt
  if (hasError.value) {
    initWebGL()
  }
})
</script>
