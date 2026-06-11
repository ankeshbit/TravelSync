<template>
  <div
    ref="containerRef"
    :class="['relative overflow-hidden', className]"
    :style="{ perspective: '1000px' }"
    @mouseenter="hovering = true"
    @mouseleave="onMouseLeave"
    @mousemove="onMouseMove"
  >
    <!-- Track -->
    <div
      class="flex transition-transform duration-700 ease-out"
      :style="{
        transform: `translateX(-${activeIndex * 100}%)`,
        width: `${cards.length * 100}%`,
      }"
    >
      <div
        v-for="(card, i) in cards"
        :key="i"
        class="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl"
        :style="{
          width: `${100 / cards.length}%`,
          flexShrink: 0,
          height: cardHeight + 'px',
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: hovering ? 'transform 0.1s ease' : 'transform 0.6s ease',
        }"
      >
        <img
          v-if="card.image"
          :src="card.image"
          :alt="card.title"
          class="absolute inset-0 h-full w-full object-cover"
        />
        <div v-else :class="['absolute inset-0', card.background || 'bg-zinc-800']" />

        <!-- Overlay -->
        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        <!-- Orbit ring decoration -->
        <div
          class="pointer-events-none absolute inset-0 flex items-center justify-center opacity-20"
          style="overflow: visible"
        >
          <div class="h-[120%] w-[120%] rounded-full border border-white/40"
            :style="{ transform: `rotateX(75deg)` }"
          />
        </div>

        <div class="absolute bottom-0 left-0 right-0 p-8">
          <span v-if="card.tag" class="mb-2 block text-xs font-bold uppercase tracking-widest text-white/50">{{ card.tag }}</span>
          <h3 class="text-2xl font-extrabold text-white">{{ card.title }}</h3>
          <p v-if="card.subtitle" class="mt-1 text-sm text-white/60">{{ card.subtitle }}</p>
        </div>
      </div>
    </div>

    <!-- Navigation dots -->
    <div class="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
      <button
        v-for="(_, i) in cards"
        :key="i"
        class="h-1.5 rounded-full transition-all duration-300"
        :class="i === activeIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/30'"
        @click="activeIndex = i"
      />
    </div>

    <!-- Prev/Next -->
    <button
      class="absolute left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white backdrop-blur transition-colors hover:bg-black/50"
      @click="prev"
    >
      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
    </button>
    <button
      class="absolute right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white backdrop-blur transition-colors hover:bg-black/50"
      @click="next"
    >
      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface OrbitCard {
  title: string
  subtitle?: string
  image?: string
  background?: string
  tag?: string
}

interface Props {
  cards: OrbitCard[]
  cardHeight?: number
  autoPlay?: boolean
  autoPlayInterval?: number
  className?: string
}

const props = withDefaults(defineProps<Props>(), {
  cardHeight: 480,
  autoPlay: true,
  autoPlayInterval: 4000,
  cards: () => [],
})

const containerRef = ref<HTMLDivElement | null>(null)
const activeIndex = ref(0)
const hovering = ref(false)
const tilt = ref({ x: 0, y: 0 })

let autoPlayTimer: ReturnType<typeof setInterval> | null = null

function next() {
  activeIndex.value = (activeIndex.value + 1) % props.cards.length
}
function prev() {
  activeIndex.value = (activeIndex.value - 1 + props.cards.length) % props.cards.length
}

function onMouseMove(e: MouseEvent) {
  const el = containerRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const cx = rect.width / 2
  const cy = rect.height / 2
  tilt.value = {
    y: ((e.clientX - rect.left - cx) / cx) * 6,
    x: -((e.clientY - rect.top - cy) / cy) * 4,
  }
}

function onMouseLeave() {
  hovering.value = false
  tilt.value = { x: 0, y: 0 }
}

import { onMounted, onUnmounted } from 'vue'
onMounted(() => {
  if (props.autoPlay) {
    autoPlayTimer = setInterval(next, props.autoPlayInterval)
  }
})
onUnmounted(() => {
  if (autoPlayTimer) clearInterval(autoPlayTimer)
})
</script>
