<template>
  <div
    :class="[
      'relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl',
      className
    ]"
  >
    <!-- Album art area -->
    <div class="relative h-48 overflow-hidden">
      <img
        v-if="currentTrack?.cover"
        :src="currentTrack.cover"
        :alt="currentTrack.title"
        class="absolute inset-0 h-full w-full object-cover transition-transform duration-700"
        :style="{ transform: isPlaying ? 'scale(1.05)' : 'scale(1)' }"
      />
      <div v-else class="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900" />
      <div class="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />

      <!-- Visualizer bars -->
      <div
        v-if="isPlaying"
        class="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-end gap-0.5"
      >
        <div
          v-for="i in 20"
          :key="i"
          class="w-1 rounded-full bg-white/60 origin-bottom"
          :style="{
            height: `${8 + Math.abs(Math.sin((Date.now() / 300) + i * 0.7)) * 24}px`,
            animation: `musicBar ${0.4 + (i % 5) * 0.1}s ease-in-out infinite alternate`,
            animationDelay: `${(i % 7) * 50}ms`,
          }"
        />
      </div>
    </div>

    <!-- Track info -->
    <div class="px-5 py-4">
      <div class="flex items-center justify-between">
        <div class="min-w-0">
          <p class="truncate font-semibold text-white">{{ currentTrack?.title || 'No Track' }}</p>
          <p class="truncate text-sm text-white/50">{{ currentTrack?.artist || '—' }}</p>
        </div>
        <button
          class="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 transition-colors hover:bg-white/20 hover:text-white"
          @click="toggleLike"
        >
          <svg class="h-4 w-4" :fill="liked ? 'currentColor' : 'none'" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </button>
      </div>

      <!-- Progress bar -->
      <div class="mt-3 group relative cursor-pointer" @click="seekTo">
        <div class="relative h-1 rounded-full bg-white/10">
          <div
            class="h-full rounded-full bg-white/70 transition-none"
            :style="{ width: `${progress}%` }"
          />
        </div>
        <div class="mt-1 flex justify-between text-[10px] text-white/30">
          <span>{{ formatTime(currentTime) }}</span>
          <span>{{ formatTime(duration) }}</span>
        </div>
      </div>

      <!-- Controls -->
      <div class="mt-3 flex items-center justify-between">
        <button
          class="flex h-8 w-8 items-center justify-center rounded-full text-white/50 transition-colors hover:text-white"
          @click="prevTrack"
        >
          <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
          </svg>
        </button>

        <!-- Play/Pause -->
        <button
          class="flex h-12 w-12 items-center justify-center rounded-full bg-white text-zinc-950 shadow-lg transition-transform active:scale-95 hover:scale-105"
          @click="togglePlay"
        >
          <svg v-if="!isPlaying" class="h-5 w-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
          <svg v-else class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        </button>

        <button
          class="flex h-8 w-8 items-center justify-center rounded-full text-white/50 transition-colors hover:text-white"
          @click="nextTrack"
        >
          <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
          </svg>
        </button>
      </div>

      <!-- Volume -->
      <div class="mt-3 flex items-center gap-2">
        <svg class="h-3.5 w-3.5 shrink-0 text-white/30" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
        </svg>
        <input
          type="range"
          min="0"
          max="100"
          :value="volume"
          class="h-1 w-full cursor-pointer accent-white"
          @input="onVolumeChange"
        />
        <svg class="h-3.5 w-3.5 shrink-0 text-white/30" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
        </svg>
      </div>
    </div>

    <audio ref="audioRef" @timeupdate="onTimeUpdate" @ended="nextTrack" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'

interface Track {
  title: string
  artist?: string
  src?: string
  cover?: string
}

interface Props {
  tracks?: Track[]
  initialVolume?: number
  className?: string
}

const props = withDefaults(defineProps<Props>(), {
  initialVolume: 75,
  tracks: () => [
    { title: 'Ocean Breeze', artist: 'Ambient Sounds', cover: '' },
    { title: 'Mountain Air', artist: 'Nature Vibes', cover: '' },
    { title: 'City Pulse', artist: 'Urban Beats', cover: '' },
  ],
})

const audioRef = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const currentTrackIndex = ref(0)
const currentTime = ref(0)
const duration = ref(180)
const volume = ref(props.initialVolume)
const liked = ref(false)
let mockTimer: ReturnType<typeof setInterval> | null = null

const currentTrack = computed(() => props.tracks[currentTrackIndex.value])
const progress = computed(() => duration.value > 0 ? (currentTime.value / duration.value) * 100 : 0)

function togglePlay() {
  isPlaying.value = !isPlaying.value
  if (isPlaying.value) {
    mockTimer = setInterval(() => {
      currentTime.value = Math.min(currentTime.value + 1, duration.value)
      if (currentTime.value >= duration.value) nextTrack()
    }, 1000)
  } else {
    if (mockTimer) clearInterval(mockTimer)
  }
}

function prevTrack() {
  currentTrackIndex.value = (currentTrackIndex.value - 1 + props.tracks.length) % props.tracks.length
  currentTime.value = 0
}

function nextTrack() {
  currentTrackIndex.value = (currentTrackIndex.value + 1) % props.tracks.length
  currentTime.value = 0
}

function toggleLike() { liked.value = !liked.value }

function onTimeUpdate() {
  const a = audioRef.value
  if (!a) return
  currentTime.value = a.currentTime
  duration.value = a.duration || 180
}

function onVolumeChange(e: Event) {
  volume.value = Number((e.target as HTMLInputElement).value)
  if (audioRef.value) audioRef.value.volume = volume.value / 100
}

function seekTo(e: MouseEvent) {
  const bar = (e.currentTarget as HTMLElement)
  const rect = bar.getBoundingClientRect()
  const ratio = (e.clientX - rect.left) / rect.width
  currentTime.value = ratio * duration.value
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

onUnmounted(() => {
  if (mockTimer) clearInterval(mockTimer)
})
</script>

<style scoped>
@keyframes musicBar {
  from { transform: scaleY(0.3); }
  to { transform: scaleY(1); }
}
</style>
