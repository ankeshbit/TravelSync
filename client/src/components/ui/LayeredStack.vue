<template>
  <div ref="stackRef" :class="['relative mx-auto', className]" :style="{ width: cardWidth + 'px', height: cardHeight + 'px' }">
    <div
      v-for="(card, i) in visibleCards"
      :key="card.id || i"
      class="absolute inset-0 cursor-pointer overflow-hidden rounded-2xl border border-white/10 shadow-2xl transition-all duration-500"
      :style="getCardStyle(i)"
      @click="rotateTop"
    >
      <img
        v-if="card.image"
        :src="card.image"
        :alt="card.title"
        class="h-full w-full object-cover"
      />
      <div v-else :class="['h-full w-full', card.background || 'bg-gradient-to-br from-zinc-800 to-zinc-900']" />

      <!-- Overlay -->
      <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <div class="absolute bottom-0 left-0 p-6">
        <span v-if="card.tag" class="mb-1 block text-xs font-semibold uppercase tracking-widest text-white/50">{{ card.tag }}</span>
        <h3 class="text-xl font-bold text-white leading-tight">{{ card.title }}</h3>
        <p v-if="card.subtitle" class="mt-1 text-sm text-white/60">{{ card.subtitle }}</p>
      </div>
    </div>

    <!-- Click hint -->
    <div class="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-white/30">
      Click to cycle
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface StackCard {
  id?: string | number
  title: string
  subtitle?: string
  image?: string
  background?: string
  tag?: string
}

interface Props {
  cards: StackCard[]
  cardWidth?: number
  cardHeight?: number
  stackOffset?: number
  stackRotation?: number
  maxVisible?: number
  className?: string
}

const props = withDefaults(defineProps<Props>(), {
  cardWidth: 320,
  cardHeight: 420,
  stackOffset: 12,
  stackRotation: 4,
  maxVisible: 4,
  cards: () => [],
})

const stackRef = ref<HTMLDivElement | null>(null)
const topIndex = ref(0)

const visibleCards = computed(() => {
  const result = []
  const len = props.cards.length
  for (let i = 0; i < Math.min(props.maxVisible, len); i++) {
    result.push(props.cards[(topIndex.value + i) % len]!)
  }
  return result.reverse()
})

function getCardStyle(positionFromBottom: number) {
  const isTop = positionFromBottom === visibleCards.value.length - 1
  const fromTop = visibleCards.value.length - 1 - positionFromBottom
  const offset = fromTop * props.stackOffset
  const rotate = fromTop * props.stackRotation * (positionFromBottom % 2 === 0 ? 1 : -1)
  const scale = 1 - fromTop * 0.04

  return {
    transform: `translateY(${-offset}px) rotate(${rotate}deg) scale(${scale})`,
    zIndex: positionFromBottom + 1,
    transformOrigin: 'center bottom',
  }
}

function rotateTop() {
  topIndex.value = (topIndex.value + 1) % props.cards.length
}
</script>
