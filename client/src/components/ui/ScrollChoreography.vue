<template>
  <div ref="sectionRef" :class="['relative', className]">
    <div
      v-for="(item, i) in items"
      :key="i"
      ref="itemRefs"
      class="group relative mb-6 overflow-hidden rounded-2xl"
      :style="{
        transform: `translateX(${getOffset(i)}px)`,
        opacity: getOpacity(i),
        transition: 'none',
        willChange: 'transform, opacity',
      }"
    >
      <div
        :class="[
          'flex flex-col md:flex-row',
          i % 2 === 0 ? '' : 'md:flex-row-reverse',
        ]"
      >
        <!-- Media -->
        <div
          class="relative md:w-1/2 overflow-hidden"
          :style="{ minHeight: itemHeight + 'px' }"
        >
          <img
            v-if="item.type === 'image' || !item.type"
            :src="item.media"
            :alt="item.caption || item.title"
            class="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <video
            v-else-if="item.type === 'video'"
            :src="item.media"
            autoplay
            muted
            loop
            playsinline
            class="absolute inset-0 h-full w-full object-cover"
          />
          <div v-else :class="['absolute inset-0', item.background || 'bg-zinc-800']" />
        </div>

        <!-- Content -->
        <div
          :class="['flex flex-col justify-center p-8 md:w-1/2', item.background || 'bg-zinc-900']"
        >
          <span v-if="item.date" class="text-xs text-white/40 mb-1 font-mono">{{ item.date }}</span>
          <h3 class="text-xl font-bold text-white">{{ item.title }}</h3>
          <p v-if="item.caption" class="mt-2 text-sm text-white/60 leading-relaxed">{{ item.caption }}</p>
          <div v-if="item.tags?.length" class="mt-4 flex flex-wrap gap-2">
            <span
              v-for="tag in item.tags"
              :key="tag"
              class="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/60"
            >
              {{ tag }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface ChoreographyItem {
  title: string
  caption?: string
  media: string
  type?: 'image' | 'video'
  date?: string
  background?: string
  tags?: string[]
}

interface Props {
  items: ChoreographyItem[]
  itemHeight?: number
  slideAmount?: number
  className?: string
}

const props = withDefaults(defineProps<Props>(), {
  itemHeight: 300,
  slideAmount: 80,
  items: () => [],
})

const sectionRef = ref<HTMLElement | null>(null)
const itemRefs = ref<HTMLElement[]>([])
const itemProgress = ref<number[]>([])

function computeProgress(el: HTMLElement): number {
  const rect = el.getBoundingClientRect()
  const inView = rect.top < window.innerHeight && rect.bottom > 0
  if (!inView) return 0
  return Math.min(1, Math.max(0, (window.innerHeight - rect.top) / (window.innerHeight * 0.7)))
}

function getOffset(i: number): number {
  const p = itemProgress.value[i] ?? 0
  const dir = i % 2 === 0 ? -1 : 1
  return dir * props.slideAmount * (1 - p)
}

function getOpacity(i: number): number {
  return itemProgress.value[i] ?? 0
}

function onScroll() {
  itemRefs.value.forEach((el, i) => {
    if (el) itemProgress.value[i] = computeProgress(el)
  })
}

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})

onUnmounted(() => window.removeEventListener('scroll', onScroll))
</script>
