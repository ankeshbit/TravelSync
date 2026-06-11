<template>
  <section
    ref="sectionRef"
    :class="['relative', className]"
    :style="{ height: `${items.length * 100}vh` }"
  >
    <!-- Sticky viewport -->
    <div class="sticky top-0 h-screen overflow-hidden">
      <div
        v-for="(item, i) in items"
        :key="i"
        class="absolute inset-0 flex items-center justify-center"
        :style="{
          opacity: getOpacity(i),
          transform: `translateY(${getTranslateY(i)}px) scale(${getScale(i)})`,
          transition: 'none',
          willChange: 'opacity, transform',
        }"
      >
        <!-- Card -->
        <div
          :class="[
            'relative max-w-4xl w-full mx-6 overflow-hidden rounded-3xl border border-white/10 shadow-2xl',
            item.className
          ]"
          :style="{ background: item.background || 'linear-gradient(135deg, #1a1a2e, #16213e)' }"
        >
          <div class="flex flex-col md:flex-row min-h-[380px]">
            <!-- Text content -->
            <div class="flex flex-1 flex-col justify-center p-10 md:p-14">
              <span v-if="item.tag" class="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">{{ item.tag }}</span>
              <h2 class="text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight">{{ item.title }}</h2>
              <p class="mt-4 text-base text-white/60 leading-relaxed max-w-sm">{{ item.description }}</p>
              <div v-if="item.action" class="mt-8">
                <button
                  class="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20 border border-white/10"
                  @click="item.action?.onClick"
                >
                  {{ item.action.label }}
                </button>
              </div>
            </div>

            <!-- Image -->
            <div v-if="item.image" class="relative w-full md:w-2/5 overflow-hidden">
              <img
                :src="item.image"
                :alt="item.title"
                class="h-full w-full object-cover"
              />
              <div class="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useScroll } from '@vueuse/core'

interface CardItem {
  title: string
  description?: string
  tag?: string
  image?: string
  background?: string
  className?: string
  action?: { label: string; onClick?: () => void }
}

interface Props {
  items: CardItem[]
  className?: string
}

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
})

const sectionRef = ref<HTMLElement | null>(null)
const { y: scrollY } = useScroll(window)

function getProgress(): number {
  const el = sectionRef.value
  if (!el) return 0
  const rect = el.getBoundingClientRect()
  const totalHeight = el.offsetHeight - window.innerHeight
  const scrolled = -rect.top
  return Math.max(0, Math.min(1, scrolled / totalHeight))
}

function getCardProgress(index: number): number {
  const progress = getProgress()
  const step = 1 / props.items.length
  const start = index * step
  const end = start + step
  return Math.max(0, Math.min(1, (progress - start) / step))
}

function getOpacity(index: number): number {
  const p = getCardProgress(index)
  if (p < 0.1) return p / 0.1
  if (p > 0.9) return 1 - (p - 0.9) / 0.1
  return 1
}

function getTranslateY(index: number): number {
  const p = getCardProgress(index)
  return (1 - p) * 60
}

function getScale(index: number): number {
  const p = getCardProgress(index)
  return 0.9 + 0.1 * p
}
</script>
