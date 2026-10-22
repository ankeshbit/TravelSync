<template>
  <Transition name="earth-fade" @after-leave="cleanupThree">
    <div
      v-if="visible"
      class="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#111210]/95 backdrop-blur-md select-none overflow-hidden p-6"
      role="status"
      aria-live="polite"
      :aria-label="message || 'Loading'"
    >
      <span class="sr-only">{{ message }}</span>

      <!-- Brand Header with Logo -->
      <div class="mb-4 sm:mb-6 flex flex-col items-center gap-2 pointer-events-none">
        <img
          :src="logoUrl"
          alt="TravelSync"
          class="w-10 h-10 sm:w-12 sm:h-12 object-contain drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]"
        />
        <span class="text-[11px] font-semibold tracking-[0.35em] text-[#A7A99A]/80 uppercase">
          TRAVELSYNC
        </span>
      </div>

      <!-- 3D Earth Canvas or Fallback Container -->
      <div
        ref="containerRef"
        class="relative w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 flex items-center justify-center my-1 sm:my-2"
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
        class="mt-4 sm:mt-6 text-sm sm:text-base font-medium text-[#E4E6DC] tracking-wide text-center max-w-sm px-6"
      >
        {{ message }}
      </p>

      <!-- Minimalist Progress Indicator -->
      <div class="w-32 sm:w-40 h-1 bg-[#30312C] rounded-full overflow-hidden mt-3 sm:mt-4 relative">
        <div class="absolute inset-0 bg-gradient-to-r from-transparent via-[#A7A99A] to-transparent earth-progress-shimmer"></div>
      </div>
    </div>
  </Transition>
</template>

<script>
let cachedWebGLSupport = null;
export function _resetWebGLSupportCache() {
  cachedWebGLSupport = null;
}
</script>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import logoUrl from '../assets/logo.png';

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
 * Releases the test context via WEBGL_lose_context to avoid context leaks.
 */
function isWebGLSupported() {
  if (cachedWebGLSupport !== null) return cachedWebGLSupport;
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      cachedWebGLSupport = false;
      return false;
    }
    const canvas = document.createElement('canvas');
    if (!canvas || typeof canvas.getContext !== 'function') {
      cachedWebGLSupport = false;
      return false;
    }
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    const supported = Boolean(gl && typeof gl.getParameter === 'function');
    if (gl && typeof gl.getExtension === 'function') {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    cachedWebGLSupport = supported;
    return supported;
  } catch {
    cachedWebGLSupport = false;
    return false;
  }
}

const containerRef = ref(null);
const canvasRef = ref(null);
const hasWebGL = ref(isWebGLSupported());
const reducedMotion = ref(false);

// Lazily imported Three.js module
let THREE = null;
let disposed = false;

// Three.js instances
let renderer = null;
let scene = null;
let camera = null;
let earthMesh = null;
let cloudsMesh = null;
let atmosphereMesh = null;
let earthGroup = null;
let earthTexture = null;
let cloudsTexture = null;
let animationFrameId = null;
let resizeObserver = null;
let mediaQuery = null;
let motionHandler = null;

/**
 * Generate a procedural 2D canvas texture for Earth if the image asset is loading or unavailable.
 */
function generateFallbackTexture(threeInstance) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new threeInstance.Texture();

  // Oceans (deep navy graphite)
  ctx.fillStyle = '#0e1a22';
  ctx.fillRect(0, 0, 1024, 512);

  // Subtle ocean depth variations
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, 512);
  oceanGrad.addColorStop(0, 'rgba(20, 36, 48, 0.4)');
  oceanGrad.addColorStop(0.5, 'rgba(10, 20, 28, 0.2)');
  oceanGrad.addColorStop(1, 'rgba(20, 36, 48, 0.4)');
  ctx.fillStyle = oceanGrad;
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

  // Polar Ice Caps
  ctx.fillStyle = '#7a9e92';
  ctx.beginPath();
  ctx.ellipse(512, 18, 480, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(512, 498, 450, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  const texture = new threeInstance.CanvasTexture(canvas);
  texture.colorSpace = threeInstance.SRGBColorSpace;
  return texture;
}

/**
 * Generate a procedural clouds texture for subtle atmospheric realism.
 */
function generateCloudsTexture(threeInstance) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new threeInstance.Texture();

  ctx.clearRect(0, 0, 1024, 512);

  // Soft atmospheric cloud bands
  for (let i = 0; i < 16; i++) {
    const cx = (i * 142) % 1024;
    const cy = 70 + ((i * 71) % 360);
    const rx = 70 + ((i * 29) % 110);
    const ry = 16 + ((i * 13) % 30);
    const rot = (i * 0.18) - 0.4;

    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, rx);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new threeInstance.CanvasTexture(canvas);
  texture.colorSpace = threeInstance.SRGBColorSpace;
  return texture;
}

/**
 * Initialize Three.js Scene, Camera, Lighting, Mesh & Materials lazily.
 */
async function initThree() {
  if (disposed) return;
  if (!canvasRef.value || !containerRef.value) return;

  try {
    if (!THREE) {
      THREE = await import('three');
    }
    if (disposed || !canvasRef.value || !containerRef.value) return;

    // Clean up any stale renderer
    if (renderer) {
      cleanupThree();
    }

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
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    // Earth group tilted by 23.4° (Earth's axial obliquity)
    earthGroup = new THREE.Group();
    earthGroup.rotation.z = (23.4 * Math.PI) / 180;
    earthGroup.rotation.x = (8 * Math.PI) / 180; // Subtle pitch toward camera
    scene.add(earthGroup);

    // Earth Sphere Geometry
    const earthGeometry = new THREE.SphereGeometry(1, 64, 64);

    // Initial Material with procedural texture immediately to prevent any blank frame
    const initialMap = generateFallbackTexture(THREE);
    earthTexture = initialMap;

    const earthMaterial = new THREE.MeshStandardMaterial({
      map: initialMap,
      roughness: 0.68,
      metalness: 0.08,
    });

    earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    earthGroup.add(earthMesh);

    // Semi-transparent procedural clouds layer
    const cloudsGeometry = new THREE.SphereGeometry(1.014, 64, 64);
    cloudsTexture = generateCloudsTexture(THREE);
    const cloudsMaterial = new THREE.MeshStandardMaterial({
      map: cloudsTexture,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    cloudsMesh = new THREE.Mesh(cloudsGeometry, cloudsMaterial);
    earthGroup.add(cloudsMesh);

    // Atmospheric Glow Mesh (outer shell with custom Fresnel shader in sage tone)
    const atmosphereGeometry = new THREE.SphereGeometry(1.036, 64, 64);
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
          float intensity = pow(0.66 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.2);
          gl_FragColor = vec4(0.48, 0.68, 0.62, 1.0) * intensity * 0.9;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });

    atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    earthGroup.add(atmosphereMesh);

    // Ambient light: subtle illumination matching dark graphite and muted sage
    const ambientLight = new THREE.AmbientLight(0x242d28, 1.2);
    scene.add(ambientLight);

    // Directional sunlight illuminating from top-left
    const sunLight = new THREE.DirectionalLight(0xfffef5, 2.6);
    sunLight.position.set(-5, 3.5, 3.5);
    scene.add(sunLight);

    // Upgrade to high-resolution asset /textures/earth.jpg if available
    const loader = new THREE.TextureLoader();
    loader.load(
      '/textures/earth.jpg',
      (texture) => {
        if (disposed || !earthMesh || !earthMesh.material) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        if (earthTexture && earthTexture !== texture) {
          earthTexture.dispose();
        }
        earthTexture = texture;
        earthMesh.material.map = texture;
        earthMesh.material.needsUpdate = true;
      },
      undefined,
      () => {
        // Keep procedural fallback seamlessly
      }
    );

    // Setup ResizeObserver for responsive sizing
    if (typeof ResizeObserver !== 'undefined' && containerRef.value) {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width: w, height: h } = entry.contentRect;
          if (w > 0 && h > 0 && camera && renderer) {
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h, false);
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

    if (!reducedMotion.value) {
      if (earthMesh) {
        earthMesh.rotation.y += 0.003;
      }
      if (cloudsMesh) {
        cloudsMesh.rotation.y += 0.0036;
      }
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
 * Dispose Three.js objects to prevent memory leaks and clean up resources.
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

  if (cloudsMesh) {
    if (cloudsMesh.geometry) cloudsMesh.geometry.dispose();
    if (cloudsMesh.material) cloudsMesh.material.dispose();
    cloudsMesh = null;
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

  if (cloudsTexture) {
    cloudsTexture.dispose();
    cloudsTexture = null;
  }

  if (renderer) {
    renderer.dispose();
    renderer = null;
  }

  scene = null;
  camera = null;
  earthGroup = null;
}

// Watch visibility: clean up Three.js when hidden, initialize when shown
watch(
  () => props.visible,
  async (newVal) => {
    if (newVal) {
      await nextTick();
      if (hasWebGL.value) {
        await initThree();
      }
    } else {
      cleanupThree();
    }
  }
);

onMounted(() => {
  disposed = false;
  // Check prefers-reduced-motion
  if (typeof window !== 'undefined' && window.matchMedia) {
    mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion.value = mediaQuery.matches;
    motionHandler = (e) => {
      reducedMotion.value = e.matches;
    };
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', motionHandler);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(motionHandler);
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
  disposed = true;
  if (mediaQuery && motionHandler) {
    if (mediaQuery.removeEventListener) {
      mediaQuery.removeEventListener('change', motionHandler);
    } else if (mediaQuery.removeListener) {
      mediaQuery.removeListener(motionHandler);
    }
    mediaQuery = null;
    motionHandler = null;
  }
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

@media (prefers-reduced-motion: reduce) {
  .earth-fallback-orbit,
  .earth-fallback-globe,
  .earth-progress-shimmer,
  .animate-pulse {
    animation: none !important;
  }
}
</style>
