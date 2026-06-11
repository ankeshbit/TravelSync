<template>
  <!-- Dock container — horizontal or vertical, glassmorphism background -->
  <div
    ref="dockRef"
    :class="[
      'relative flex items-end gap-2 rounded-2xl px-3 py-2',
      'border border-white/10 shadow-2xl backdrop-blur-xl',
      variant === 'glass'       && 'bg-white/10 dark:bg-black/20',
      variant === 'solid'       && 'bg-neutral-900/95',
      variant === 'transparent' && 'bg-transparent border-transparent shadow-none',
      position === 'left'  || position === 'right' ? 'flex-col items-center' : 'flex-row items-end',
      className,
    ]"
    @mousemove="onDockMouseMove"
    @mouseleave="onDockMouseLeave"
  >
    <template v-for="(item, idx) in items" :key="item.id">
      <!-- Individual dock item -->
      <div class="relative flex flex-col items-center">
        <!-- Tooltip label above icon -->
        <Transition name="dock-tooltip">
          <div
            v-if="hoveredId === item.id && showLabels"
            :class="[
              'pointer-events-none absolute whitespace-nowrap rounded-lg px-2.5 py-1',
              'text-xs font-semibold text-white',
              'border border-white/10 bg-black/70 backdrop-blur-md',
              isVertical ? 'left-[calc(100%+0.6rem)] top-1/2 -translate-y-1/2' : '-top-9',
            ]"
          >
            {{ item.label }}
          </div>
        </Transition>

        <!-- The button itself — size + y-float are driven by mouse proximity -->
        <button
          :id="`magnetic-dock-item-${item.id}`"
          type="button"
          :aria-label="item.label"
          :class="[
            'relative flex items-center justify-center',
            'rounded-2xl transition-colors duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400',
            'dark:focus-visible:ring-white/50',
            item.isActive && 'bg-neutral-200/50 dark:bg-white/10',
          ]"
          :style="{
            width:     `${sizes[idx] ?? iconSize}px`,
            height:    `${sizes[idx] ?? iconSize}px`,
            transform: `translateY(${isVertical ? 0 : floats[idx] ?? 0}px) translateX(${isVertical ? floats[idx] ?? 0 : 0}px)`,
            transition: 'width 0.2s cubic-bezier(0.34,1.56,0.64,1), height 0.2s cubic-bezier(0.34,1.56,0.64,1), transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
            willChange: 'width, height, transform',
          }"
          @mouseenter="hoveredId = item.id"
          @mouseleave="hoveredId = null"
          @click="item.onClick?.()"
        >
          <!-- Icon container — gradient surface identical to original macOS-style dock -->
          <div
            :class="[
              'relative h-full w-full overflow-hidden rounded-2xl',
              'bg-gradient-to-b from-neutral-100 to-neutral-50',
              'dark:from-neutral-800 dark:to-neutral-900',
              'shadow-[inset_0_1px_0_rgba(255,255,255,0.15),_0_1px_3px_rgba(0,0,0,0.3)]',
            ]"
          >
            <!-- Slot: icon node or image URL -->
            <div class="flex h-full w-full items-center justify-center">
              <component
                :is="item.icon"
                v-if="item.icon && typeof item.icon !== 'string'"
                class="h-[60%] w-[60%]"
              />
              <img
                v-else-if="typeof item.icon === 'string'"
                :src="item.icon"
                :alt="item.label"
                class="h-full w-full object-cover"
                draggable="false"
              />
            </div>

            <!-- Badge -->
            <div
              v-if="item.badge"
              class="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white"
            >
              {{ item.badge > 99 ? '99+' : item.badge }}
            </div>
          </div>
        </button>

        <!-- Active indicator dot (below icon) -->
        <div
          v-if="item.isActive && !isVertical"
          class="mt-1 h-1 w-1 rounded-full bg-white/70"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * MagneticDock — faithful Vue 3 port of Componentry MagneticDock
 * Source: packages/ui/src/components/magnetic-dock.tsx
 *
 * Original uses Framer Motion useMotionValue + useSpring + useTransform.
 * Here we replicate the exact physics in vanilla JS with requestAnimationFrame
 * spring interpolation. All the same props are present.
 *
 * // export from index.ts
 */
import { ref, computed, onUnmounted, type Component } from 'vue'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DockItemData {
  /** Unique identifier */
  id: string
  /** Display label */
  label: string
  /** Icon — Vue component OR an image URL string */
  icon?: Component | string
  /** Click handler */
  onClick?: () => void
  /** Whether the item is currently active */
  isActive?: boolean
  /** Badge count */
  badge?: number
}

interface Props {
  items: DockItemData[]
  /** Base icon size in px */
  iconSize?: number
  /** Maximum scale multiplier on hover */
  maxScale?: number
  /** Radius of the magnetic / magnification effect in px */
  magneticDistance?: number
  /** Show tooltip labels on hover */
  showLabels?: boolean
  /** Dock position — affects layout axis and tooltip direction */
  position?: 'bottom' | 'top' | 'left' | 'right'
  /** Visual surface variant */
  variant?: 'glass' | 'solid' | 'transparent'
  className?: string
}

const props = withDefaults(defineProps<Props>(), {
  iconSize: 52,
  maxScale: 1.7,
  magneticDistance: 120,
  showLabels: true,
  position: 'bottom',
  variant: 'glass',
})

// ─── State ────────────────────────────────────────────────────────────────────

const dockRef  = ref<HTMLDivElement | null>(null)
const hoveredId = ref<string | null>(null)

// Per-item computed sizes and float offsets (replaces Framer Motion springs)
const sizes  = ref<number[]>(props.items.map(() => props.iconSize))
const floats = ref<number[]>(props.items.map(() => 0))

const isVertical = computed(
  () => props.position === 'left' || props.position === 'right',
)

// ─── Spring interpolation ─────────────────────────────────────────────────────
// We maintain target arrays and smoothly lerp toward them each rAF tick,
// mimicking Framer Motion's { damping: 20, stiffness: 300, mass: 0.5 }.

const targetSizes  = ref<number[]>(props.items.map(() => props.iconSize))
const targetFloats = ref<number[]>(props.items.map(() => 0))
const velSizes     = props.items.map(() => 0)
const velFloats    = props.items.map(() => 0)

const STIFFNESS = 300
const DAMPING   = 20
const MASS      = 0.5
const DT        = 1 / 60

let rafId = 0

function springStep() {
  let anyDirty = false

  for (let i = 0; i < props.items.length; i++) {
    // Size spring
    const ds = targetSizes.value[i]! - sizes.value[i]!
    const as = (STIFFNESS * ds - DAMPING * velSizes[i]!) / MASS
    velSizes[i]  = (velSizes[i]! + as * DT)
    sizes.value[i] = (sizes.value[i]! + velSizes[i]! * DT)
    if (Math.abs(ds) > 0.1 || Math.abs(velSizes[i]!) > 0.1) anyDirty = true

    // Float spring (y-lift / x-lift)
    const df = targetFloats.value[i]! - floats.value[i]!
    const af = (STIFFNESS * df - DAMPING * velFloats[i]!) / MASS
    velFloats[i]  = (velFloats[i]! + af * DT)
    floats.value[i] = (floats.value[i]! + velFloats[i]! * DT)
    if (Math.abs(df) > 0.1 || Math.abs(velFloats[i]!) > 0.1) anyDirty = true
  }

  if (anyDirty) rafId = requestAnimationFrame(springStep)
}

function startSpring() {
  cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(springStep)
}

// ─── Mouse tracking ───────────────────────────────────────────────────────────

function onDockMouseMove(e: MouseEvent) {
  const dock = dockRef.value
  if (!dock) return
  const buttons = dock.querySelectorAll<HTMLButtonElement>('button[id^="magnetic-dock-item-"]')

  buttons.forEach((btn, i) => {
    const rect  = btn.getBoundingClientRect()
    const cx    = rect.left + rect.width  / 2
    const cy    = rect.top  + rect.height / 2
    const coord = isVertical.value ? e.clientY : e.clientX
    const center= isVertical.value ? cy        : cx
    const dist  = Math.abs(coord - center)

    if (dist < props.magneticDistance) {
      // Scale: 1 at edge → maxScale at center (matches original useTransform range)
      const t = 1 - dist / props.magneticDistance
      const scale = 1 + (props.maxScale - 1) * t
      targetSizes.value[i]  = props.iconSize * scale
      // Float: lift icon upward (or sideways when vertical) proportional to scale
      targetFloats.value[i] = (scale - 1) * -10
    } else {
      targetSizes.value[i]  = props.iconSize
      targetFloats.value[i] = 0
    }
  })

  startSpring()
}

function onDockMouseLeave() {
  hoveredId.value = null
  for (let i = 0; i < props.items.length; i++) {
    targetSizes.value[i]  = props.iconSize
    targetFloats.value[i] = 0
  }
  startSpring()
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onUnmounted(() => cancelAnimationFrame(rafId))
</script>

<style scoped>
/* Tooltip fade + slide transition */
.dock-tooltip-enter-active,
.dock-tooltip-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}
.dock-tooltip-enter-from,
.dock-tooltip-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
