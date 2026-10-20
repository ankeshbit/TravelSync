<template>
  <Transition name="earth-fade">
    <div
      v-if="visible"
      class="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#111210]/95 backdrop-blur-md select-none overflow-hidden"
      role="status"
      aria-live="polite"
      :aria-label="message || 'Loading'"
    >
      <span class="sr-only">{{ message }}</span>

      <!-- Brand Header -->
      <div class="mb-4 flex flex-col items-center pointer-events-none">
        <span class="text-[11px] font-semibold tracking-[0.35em] text-[#A7A99A]/80 uppercase">
          TRAVELSYNC
        </span>
      </div>

      <!-- 3D Earth Canvas or Fallback Container -->
      <div
        ref="containerRef"
        class="relative w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 flex items-center justify-center"
      >
        <!-- WebGL Canvas Mount Target -->
        <canvas
          v-if="hasWebGL"
          ref="canvasRef"
          class="w-full h-full block cursor-default pointer-events-none"
        ></canvas>

        <!-- Graceful CSS Fallback (Rendered if WebGL is unavailable or fails) -->
        <div
          v-else
          class="relative w-44 h-44 sm:w-52 sm:h-52 flex items-center justify-center pointer-events-none"
        >
          <!-- Outer atmospheric pulse halo -->
          <div class="absolute inset-0 rounded-full bg-[#7BAE9E]/15 blur-xl animate-pulse"></div>

          <!-- Stylized globe sphere -->
          <div
            class="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full overflow-hidden border border-[#30312C]/60 earth-fallback-globe"
          >
            <!-- Equatorial tilted ring -->
            <div class="absolute inset-0 rounded-full border border-[#A7A99A]/20 transform -rotate-[23.5deg]"></div>
            <div class="absolute inset-[-15%] rounded-full border border-dashed border-[#A7A99A]/15 earth-fallback-orbit"></div>
          </div>
        </div>
      </div>

      <!-- Loading Message -->
      <p
        class="mt-6 text-sm sm:text-base font-medium text-[#E4E6DC] tracking-wide text-center max-w-sm px-6"
      >
        {{ message }}
      </p>

      <!-- Minimalist Progress Indicator -->
      <div class="w-28 sm:w-36 h-0.5 bg-[#30312C] rounded-full overflow-hidden mt-4 relative">
        <div class="absolute inset-0 bg-gradient-to-r from-transparent via-[#A7A99A] to-transparent earth-progress-shimmer"></div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import * as THREE from 'three';

const props = defineProps({
  visible: {
    type: Boolean,
    default: true,
  },
  message: {
    type: String,
    default: 'Getting your journey ready…',
  },
});

/**
 * Detect WebGL availability safely without throwing unhandled exceptions.
 */
function isWebGLSupported() {
  try {
    if (typeof window === 'undefined' || !window.WebGLRenderingContext) return false;
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return Boolean(gl);
  } catch {
    return false;
  }
}

const containerRef = ref(null);
const canvasRef = ref(null);
const hasWebGL = ref(isWebGLSupported());
const reducedMotion = ref(false);

// Three.js instances
let renderer = null;
let scene = null;
let camera = null;
let earthMesh = null;
let atmosphereMesh = null;
let earthGroup = null;
let earthTexture = null;
let animationFrameId = null;
let resizeObserver = null;
let mediaQuery = null;

/**
 * Generate a procedural 2D canvas texture for Earth if the image asset fails to load.
 */
function generateFallbackTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  // Oceans (deep navy charcoal)
  ctx.fillStyle = '#0f202b';
  ctx.fillRect(0, 0, 1024, 512);

  // Continents (muted sage green / khaki)
  ctx.fillStyle = '#3a5447';

  // North America
  ctx.beginPath();
  ctx.ellipse(260, 150, 110, 75, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // South America
  ctx.beginPath();
  ctx.ellipse(340, 330, 65, 100, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Europe
  ctx.beginPath();
  ctx.ellipse(540, 135, 55, 45, 0, 0, Math.PI * 2);
  ctx.fill();

  // Africa
  ctx.beginPath();
  ctx.ellipse(550, 270, 75, 95, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Asia
  ctx.beginPath();
  ctx.ellipse(730, 165, 140, 85, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Australia
  ctx.beginPath();
  ctx.ellipse(835, 360, 55, 40, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Soft clouds
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.ellipse(90 + i * 150, 90 + (i % 3) * 110, 100, 22, i * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Initialize Three.js Scene, Camera, Lighting, Mesh & Materials.
 */
function initThree() {
  if (!canvasRef.value || !containerRef.value) return;

  try {
    const width = containerRef.value.clientWidth || 320;
    const height = containerRef.value.clientHeight || 320;

    // Scene
    scene = new THREE.Scene();

    // Camera
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 2.85;

    // Renderer
    renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.value,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    // Earth group tilted by 23.5° (Earth's axial obliquity)
    earthGroup = new THREE.Group();
    earthGroup.rotation.z = (23.5 * Math.PI) / 180;
    scene.add(earthGroup);

    // Earth Sphere Geometry
    const earthGeometry = new THREE.SphereGeometry(1, 64, 64);

    // Initial Material with dark placeholder until texture finishes loading
    const earthMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.65,
      metalness: 0.05,
    });

    earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    earthGroup.add(earthMesh);

    // Atmospheric Glow Mesh (outer shell with custom Fresnel shader)
    const atmosphereGeometry = new THREE.SphereGeometry(1.035, 64, 64);
    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.68 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.2);
          gl_FragColor = vec4(0.48, 0.68, 0.62, 1.0) * intensity * 0.8;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });

    atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    earthGroup.add(atmosphereMesh);

    // Ambient light: subtle illumination so the unlit side is dark graphite
    const ambientLight = new THREE.AmbientLight(0x28302c, 1.2);
    scene.add(ambientLight);

    // Directional sunlight illuminating from top-left
    const sunLight = new THREE.DirectionalLight(0xfffef8, 2.4);
    sunLight.position.set(-4, 3, 3);
    scene.add(sunLight);

    // Load Earth Texture with graceful fallback
    const loader = new THREE.TextureLoader();
    loader.load(
      '/textures/earth.jpg',
      (texture) => {
        if (!earthMaterial) return;
        texture.colorSpace = THREE.SRGBColorSpace;
        earthTexture = texture;
        earthMaterial.map = texture;
        earthMaterial.needsUpdate = true;
      },
      undefined,
      () => {
        // Fallback procedural canvas texture if the image fails to load
        if (!earthMaterial) return;
        const fallbackTex = generateFallbackTexture();
        earthTexture = fallbackTex;
        earthMaterial.map = fallbackTex;
        earthMaterial.needsUpdate = true;
      }
    );

    // Setup ResizeObserver
    if (typeof ResizeObserver !== 'undefined' && containerRef.value) {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width: w, height: h } = entry.contentRect;
          if (w > 0 && h > 0 && camera && renderer) {
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
          }
        }
      });
      resizeObserver.observe(containerRef.value);
    }

    // Start render loop if visible
    if (props.visible) {
      startAnimation();
    }
  } catch (err) {
    console.warn('WebGL initialization failed, falling back to CSS animation:', err);
    hasWebGL.value = false;
    cleanupThree();
  }
}

/**
 * Animation loop - pauses automatically when visible is false.
 */
function startAnimation() {
  if (animationFrameId !== null || !props.visible || !renderer || !scene || !camera) return;

  function renderLoop() {
    if (!props.visible || !renderer || !scene || !camera) {
      animationFrameId = null;
      return;
    }

    if (earthMesh && !reducedMotion.value) {
      earthMesh.rotation.y += 0.0035;
    }

    renderer.render(scene, camera);
    animationFrameId = requestAnimationFrame(renderLoop);
  }

  animationFrameId = requestAnimationFrame(renderLoop);
}

function stopAnimation() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

/**
 * Dispose Three.js objects to prevent memory leaks.
 */
function cleanupThree() {
  stopAnimation();

  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  if (earthMesh) {
    if (earthMesh.geometry) earthMesh.geometry.dispose();
    if (earthMesh.material) earthMesh.material.dispose();
    earthMesh = null;
  }

  if (atmosphereMesh) {
    if (atmosphereMesh.geometry) atmosphereMesh.geometry.dispose();
    if (atmosphereMesh.material) atmosphereMesh.material.dispose();
    atmosphereMesh = null;
  }

  if (earthTexture) {
    earthTexture.dispose();
    earthTexture = null;
  }

  if (renderer) {
    renderer.dispose();
    renderer = null;
  }

  scene = null;
  camera = null;
  earthGroup = null;
}

// Watch visibility to pause/resume animation loop and prevent background GPU/CPU burn
watch(
  () => props.visible,
  async (newVal) => {
    if (newVal) {
      await nextTick();
      if (!renderer && hasWebGL.value) {
        initThree();
      } else {
        startAnimation();
      }
    } else {
      stopAnimation();
    }
  }
);

onMounted(() => {
  // Check prefers-reduced-motion
  if (typeof window !== 'undefined' && window.matchMedia) {
    mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion.value = mediaQuery.matches;
    const motionHandler = (e) => {
      reducedMotion.value = e.matches;
    };
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', motionHandler);
    }
  }

  // Check WebGL support
  hasWebGL.value = isWebGLSupported();

  if (hasWebGL.value && props.visible) {
    nextTick(() => {
      initThree();
    });
  }
});

onBeforeUnmount(() => {
  cleanupThree();
});
</script>

<style scoped>
.earth-fade-enter-active,
.earth-fade-leave-active {
  transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.earth-fade-enter-from,
.earth-fade-leave-to {
  opacity: 0;
}

.earth-fallback-globe {
  background: radial-gradient(circle at 35% 35%, #2a473a 0%, #152920 45%, #0b1510 85%, #050806 100%);
  box-shadow: inset -14px -14px 28px rgba(0, 0, 0, 0.85), 0 0 35px rgba(123, 174, 158, 0.22);
}

.earth-fallback-orbit {
  animation: fallbackSpin 18s linear infinite;
}

@keyframes fallbackSpin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.earth-progress-shimmer {
  animation: progressShimmer 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes progressShimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}
</style>
