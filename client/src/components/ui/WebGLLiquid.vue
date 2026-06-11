<template>
  <div
    ref="hostRef"
    :class="[
      'relative flex w-full items-center overflow-hidden bg-[#02040b] text-white',
      className,
    ]"
    style="container-type: size;"
    v-bind="$attrs"
  >
    <!-- ── WebGL canvas ─────────────────────────────────────────────────── -->
    <canvas
      v-if="!glFailed"
      ref="canvasRef"
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 block h-full w-full"
    />

    <!-- ── Cinematic overlays (only with WebGL) ───────────────────────── -->
    <template v-if="!glFailed">
      <!-- Left-to-right vignette that blends into the content area -->
      <div
        class="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/35 via-black/15 to-transparent"
      />
      <!-- Soft specular highlight in the upper-right -->
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_65%_40%,rgba(255,255,255,0.16),transparent_45%)]"
      />
    </template>

    <!-- ── CSS fallback when WebGL is unavailable ─────────────────────── -->
    <div
      v-if="glFailed"
      class="absolute inset-0 bg-gradient-to-br from-[#04050b] via-[#134d93] to-[#8cecff]/30"
    />

    <!-- ── Content slot (title / subtitle / description / children) ────── -->
    <div
      class="relative z-10 mx-auto w-full max-w-[1240px] px-6 py-20 md:px-10 md:py-28"
      style="container-type: inline-size;"
    >
      <div class="max-w-[760px]">
        <slot>
          <!-- Default slot content — mirrors the original React defaults -->
          <h1
            v-if="title"
            class="pb-[0.08em] text-6xl leading-[0.92] tracking-[-0.03em] font-semibold text-white"
          >
            {{ title }}
          </h1>
          <h2
            v-if="subtitle"
            class="mt-2 text-5xl leading-[0.9] tracking-[-0.03em] font-bold text-white/95"
          >
            {{ subtitle }}
          </h2>
          <p
            v-if="description"
            class="mt-6 max-w-[620px] text-base leading-relaxed text-white/75 md:text-xl"
          >
            {{ description }}
          </p>
        </slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * WebGLLiquid — faithful Vue 3 port of Componentry WebGLLiquid
 * Source: packages/ui/src/components/webgl-liquid.tsx
 *         apps/web/components/landing/webgl-liquid.tsx
 *
 * Uses raw WebGL (no Three.js) with the original GLSL vertex + fragment shaders
 * from Componentry verbatim. Falls back gracefully to a CSS gradient when
 * WebGL is unavailable.
 *
 * Cleanup on unmount: cancelAnimationFrame + ResizeObserver disconnect +
 * WebGL buffer / shader / program deletion.
 *
 * // export from index.ts
 */
import { ref, onMounted, onUnmounted } from 'vue'

// ─── Props (matches WebGLLiquidProps in original) ─────────────────────────────

interface Props {
  title?: string
  subtitle?: string
  description?: string
  colorDeep?: string
  colorMid?: string
  colorHighlight?: string
  speed?: number
  flowStrength?: number
  grain?: number
  contrast?: number
  opacity?: number
  reveal?: boolean
  delayMs?: number
  revealDuration?: number
  className?: string
}

const props = withDefaults(defineProps<Props>(), {
  colorDeep: '#04050b',
  colorMid: '#134d93',
  colorHighlight: '#8cecff',
  speed: 1,
  flowStrength: 1,
  grain: 0.05,
  contrast: 1.1,
  opacity: 0.95,
  reveal: true,
  delayMs: 0,
  revealDuration: 1.2,
})

// ─── GLSL shaders (verbatim from the original) ────────────────────────────────

const VERTEX_SHADER = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_colorDeep;
uniform vec3 u_colorMid;
uniform vec3 u_colorHighlight;
uniform float u_speed;
uniform float u_flowStrength;
uniform float u_grain;
uniform float u_contrast;
uniform float u_opacity;
uniform float u_reveal;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.86, 0.51, -0.51, 0.86);
  for (int i = 0; i < 6; i++) {
    v += a * noise(p);
    p = rot * p * 2.0;
    a *= 0.5;
  }
  return v;
}

vec3 applyContrast(vec3 c, float contrast) {
  return clamp((c - 0.5) * contrast + 0.5, 0.0, 1.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float t = u_time * (0.14 * u_speed);
  vec2 aspect = vec2(u_res.x / max(u_res.y, 1.0), 1.0);
  vec2 p = (uv - 0.5) * aspect;

  vec2 flowP = vec2(p.x * 1.1, p.y - t * 0.35);
  float n1 = fbm(flowP * 2.8 + vec2(0.0, t * 0.2));
  float n2 = fbm((flowP + n1 * 0.45) * 4.0 - vec2(0.0, t * 0.35));
  float n3 = fbm((flowP + n2 * 0.4) * 6.5 + vec2(t * 0.15, 0.0));

  float structure = n3 * 1.15 + (n2 - 0.5) * 0.5;
  structure += (n1 - 0.5) * 0.3 * u_flowStrength;

  float lowBand  = smoothstep(0.18, 0.6,  structure);
  float highBand = smoothstep(0.62, 1.08, structure);
  vec3 col = mix(u_colorDeep, u_colorMid, lowBand);
  col = mix(col, u_colorHighlight, highBand);

  float glow = smoothstep(0.52, 0.95, structure) * (0.35 + 0.5 * u_flowStrength);
  col += glow * u_colorHighlight * 0.35;

  float verticalMask = smoothstep(1.05, 0.05, uv.y);
  verticalMask = pow(verticalMask, 1.1);

  float vignette = smoothstep(1.28, 0.36, length(uv - 0.5));
  col *= mix(0.9, 1.05, vignette);

  col = applyContrast(col, u_contrast);

  float dither = (hash(gl_FragCoord.xy + t * 10.0) - 0.5) * u_grain;
  col += dither;

  float alpha = verticalMask * smoothstep(0.08, 0.95, structure);
  alpha *= smoothstep(0.0, 0.28, u_reveal - uv.x);
  alpha *= u_opacity;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), clamp(alpha, 0.0, 1.0));
}
`

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HEX_COLOR_REGEX = /^#?[0-9a-fA-F]{6}$/

function sanitizeHex(value: string, fallback: string): string {
  const trimmed = value.trim()
  if (!HEX_COLOR_REGEX.test(trimmed)) return fallback
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`
}

function hexToRgb01(hex: string): [number, number, number] {
  const n = sanitizeHex(hex, '#04050b').replace('#', '')
  return [
    parseInt(n.slice(0, 2), 16) / 255,
    parseInt(n.slice(2, 4), 16) / 255,
    parseInt(n.slice(4, 6), 16) / 255,
  ]
}

// ─── Refs ─────────────────────────────────────────────────────────────────────

const hostRef   = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const glFailed  = ref(false)

let rafId = 0
let ro: ResizeObserver | null = null
let glCleanup: (() => void) | null = null

// ─── WebGL init ───────────────────────────────────────────────────────────────

function initGL() {
  if (glFailed.value) return

  const canvas = canvasRef.value
  const host   = hostRef.value
  if (!canvas || !host) return

  try {
    const gl = canvas.getContext('webgl', { antialias: true, alpha: true })
    if (!gl) { glFailed.value = true; return }

    // ── compile ─────────────────────────────────────────────────────────────
    function compile(type: number, src: string): WebGLShader | null {
      const s = gl.createShader(type)
      if (!s) return null
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null }
      return s
    }

    const vs = compile(gl.VERTEX_SHADER,   VERTEX_SHADER)
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
    if (!vs || !fs) { glFailed.value = true; return }

    const prog = gl.createProgram()
    if (!prog) { glFailed.value = true; return }
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { glFailed.value = true; return }
    gl.useProgram(prog)

    // ── fullscreen quad ──────────────────────────────────────────────────────
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const posLoc = gl.getAttribLocation(prog, 'position')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    // ── uniform locations ────────────────────────────────────────────────────
    const uRes           = gl.getUniformLocation(prog, 'u_res')
    const uTime          = gl.getUniformLocation(prog, 'u_time')
    const uColorDeep     = gl.getUniformLocation(prog, 'u_colorDeep')
    const uColorMid      = gl.getUniformLocation(prog, 'u_colorMid')
    const uColorHighlight= gl.getUniformLocation(prog, 'u_colorHighlight')
    const uSpeed         = gl.getUniformLocation(prog, 'u_speed')
    const uFlowStrength  = gl.getUniformLocation(prog, 'u_flowStrength')
    const uGrain         = gl.getUniformLocation(prog, 'u_grain')
    const uContrast      = gl.getUniformLocation(prog, 'u_contrast')
    const uOpacity       = gl.getUniformLocation(prog, 'u_opacity')
    const uReveal        = gl.getUniformLocation(prog, 'u_reveal')

    // ── resize ───────────────────────────────────────────────────────────────
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const { width, height } = host.getBoundingClientRect()
      canvas.width  = Math.max(1, Math.floor(width  * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(uRes, canvas.width, canvas.height)
    }
    resize()
    ro = new ResizeObserver(resize)
    ro.observe(host)

    // ── render loop ───────────────────────────────────────────────────────────
    const startTs = performance.now()

    function render(now: number) {
      const elapsed = Math.max(0, (now - startTs - props.delayMs) / 1000)
      const revealProgress = props.reveal
        ? Math.min(1, elapsed / Math.max(props.revealDuration, 0.05))
        : 1

      const [dr, dg, db] = hexToRgb01(props.colorDeep)
      const [mr, mg, mb] = hexToRgb01(props.colorMid)
      const [hr, hg, hb] = hexToRgb01(props.colorHighlight)

      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform1f(uTime,       elapsed)
      gl.uniform3f(uColorDeep,      dr, dg, db)
      gl.uniform3f(uColorMid,       mr, mg, mb)
      gl.uniform3f(uColorHighlight, hr, hg, hb)
      gl.uniform1f(uSpeed,         props.speed)
      gl.uniform1f(uFlowStrength,  props.flowStrength)
      gl.uniform1f(uGrain,         props.grain)
      gl.uniform1f(uContrast,      props.contrast)
      gl.uniform1f(uOpacity,       props.opacity)
      gl.uniform1f(uReveal,        revealProgress)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

      rafId = requestAnimationFrame(render)
    }
    rafId = requestAnimationFrame(render)

    // Cleanup closure
    glCleanup = () => {
      cancelAnimationFrame(rafId)
      ro?.disconnect()
      ro = null
      gl.deleteBuffer(buf)
      gl.deleteProgram(prog)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
    }
  } catch {
    glFailed.value = true
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => initGL())

onUnmounted(() => {
  glCleanup?.()
  glCleanup = null
  cancelAnimationFrame(rafId)
})
</script>
