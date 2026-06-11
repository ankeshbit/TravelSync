<template>
  <section ref="sectionRef" :class="['relative w-full overflow-hidden', className]">
    <div class="relative grid gap-6 md:gap-8">
      <div
        v-for="(item, i) in items"
        :key="i"
        ref="itemRefs"
        class="group relative overflow-hidden rounded-2xl border border-white/10"
        :style="{
          transform: `translateY(${itemOffsets[i] ?? 0}px)`,
          opacity: itemOpacity[i] ?? 0,
          transition: 'none',
          willChange: 'transform, opacity',
        }"
      >
        <!-- Two-column split layout -->
        <div
          :class="[
            'flex flex-col md:flex-row items-center min-h-[320px]',
            i % 2 === 1 ? 'md:flex-row-reverse' : '',
          ]"
        >
          <!-- Image side -->
          <div class="relative w-full md:w-1/2 min-h-[220px] md:min-h-[320px] overflow-hidden">
            <img
              :src="item.image"
              :alt="item.title"
              class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 absolute inset-0"
            />
            <div class="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent" />
          </div>

          <!-- Text side -->
          <div
            :class="[
              'flex flex-col justify-center p-8 md:p-12 md:w-1/2',
              item.background || 'bg-zinc-900',
            ]"
          >
            <span v-if="item.tag" class="mb-2 text-xs font-bold uppercase tracking-widest text-white/40">{{ item.tag }}</span>
            <h3 class="text-2xl md:text-3xl font-extrabold tracking-tight text-white">{{ item.title }}</h3>
            <p class="mt-3 text-sm text-white/60 leading-relaxed">{{ item.description }}</p>
            <ul v-if="item.features?.length" class="mt-5 space-y-2">
              <li
                v-for="f in item.features"
                :key="f"
                class="flex items-center gap-2 text-sm text-white/70"
              >
                <svg class="h-3.5 w-3.5 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {{ f }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface ScrollSplitItem {
  title: string
  description?: string
  image: string
  tag?: string
  background?: string
  features?: string[]
}

interface Props {
  items: ScrollSplitItem[]
  className?: string
  parallaxStrength?: number
}

const props = withDefaults(defineProps<Props>(), {
  parallaxStrength: 40,
  items: () => [],
})

const sectionRef = ref<HTMLElement | null>(null)
const itemRefs = ref<HTMLElement[]>([])
const itemOffsets = ref<number[]>([])
const itemOpacity = ref<number[]>([])

function updateParallax() {
  itemRefs.value.forEach((el, i) => {
    if (!el) return
    const rect = el.getBoundingClientRect()
    const center = rect.top + rect.height / 2
    const vCenter = window.innerHeight / 2
    const progress = (vCenter - center) / window.innerHeight

    itemOffsets.value[i] = progress * props.parallaxStrength

    // Fade in/out
    const inView = rect.top < window.innerHeight * 0.9 && rect.bottom > 0
    itemOpacity.value[i] = inView
      ? Math.min(1, (window.innerHeight * 0.9 - rect.top) / (window.innerHeight * 0.3))
      : 0
  })
}

onMounted(() => {
  updateParallax()
  window.addEventListener('scroll', updateParallax, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', updateParallax)
})
</script>
