<template>
  <div
    ref="containerRef"
    :class="['relative overflow-x-auto overflow-y-hidden whitespace-nowrap', className]"
    @mouseenter="hovering = true"
    @mouseleave="hovering = false"
    @mousemove="onMouseMove"
  >
    <!-- Inner track - auto scrolls -->
    <div
      ref="trackRef"
      class="inline-flex gap-5 will-change-transform"
      :style="{ transform: `translateX(${-scrollX}px)` }"
    >
      <div
        v-for="(item, i) in displayItems"
        :key="i"
        class="group relative inline-block shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-white/10 transition-transform duration-300 hover:-translate-y-1 hover:shadow-2xl"
        :style="{ width: itemWidth + 'px', height: itemHeight + 'px' }"
        @click="emit('select', item, i % items.length)"
      >
        <img
          v-if="item.image"
          :src="item.image"
          :alt="item.title"
          class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div v-else :class="['h-full w-full', item.background || 'bg-zinc-800']" />

        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div class="absolute bottom-0 left-0 right-0 translate-y-2 p-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <h4 class="font-bold text-white leading-tight">{{ item.title }}</h4>
          <p v-if="item.subtitle" class="text-xs text-white/60 mt-0.5">{{ item.subtitle }}</p>
        </div>
      </div>
    </div>

    <!-- Drag hint gradient -->
    <div class="pointer-events-none absolute right-0 top-0 h-full w-16 bg-gradient-to-l from-black/40 to-transparent" />
    <div class="pointer-events-none absolute left-0 top-0 h-full w-16 bg-gradient-to-r from-black/40 to-transparent" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface CollectionItem {
  title: string
  subtitle?: string
  image?: string
  background?: string
}

interface Props {
  items: CollectionItem[]
  itemWidth?: number
  itemHeight?: number
  speed?: number
  className?: string
}

const props = withDefaults(defineProps<Props>(), {
  itemWidth: 240,
  itemHeight: 320,
  speed: 1,
  items: () => [],
})

const emit = defineEmits<{
  (e: 'select', item: CollectionItem, index: number): void
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const trackRef = ref<HTMLDivElement | null>(null)
const scrollX = ref(0)
const hovering = ref(false)
let rafId = 0
let mouseVelocity = 0
let lastMouseX = 0

// Duplicate items for infinite scroll
const displayItems = computed(() => [...props.items, ...props.items, ...props.items])

function animate() {
  if (!hovering.value) {
    scrollX.value += props.speed * 0.5
  }

  // Reset for infinite loop
  const singleWidth = props.items.length * (props.itemWidth + 20)
  if (scrollX.value >= singleWidth) {
    scrollX.value -= singleWidth
  }

  rafId = requestAnimationFrame(animate)
}

function onMouseMove(e: MouseEvent) {
  const dx = e.clientX - lastMouseX
  lastMouseX = e.clientX
  mouseVelocity = dx
}

onMounted(() => {
  rafId = requestAnimationFrame(animate)
})

onUnmounted(() => cancelAnimationFrame(rafId))
</script>
