<template>
  <div :class="['overflow-auto rounded-xl', className]" v-bind="$attrs">
    <div class="p-4">
      <!-- Month/Year header -->
      <div class="mb-3 flex items-center justify-between">
        <h3 class="text-sm font-semibold text-white/80">{{ currentYear }}</h3>
        <div class="flex gap-1">
          <span
            v-for="lvl in [0, 1, 2, 3, 4]"
            :key="lvl"
            class="h-2.5 w-2.5 rounded-sm"
            :class="levelColor[lvl]"
          />
        </div>
      </div>

      <!-- Month labels -->
      <div class="mb-1 ml-8 grid text-[10px] text-white/30" :style="{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }">
        <span v-for="m in months" :key="m">{{ m }}</span>
      </div>

      <!-- Grid -->
      <div class="flex gap-1">
        <!-- Day labels -->
        <div class="flex flex-col gap-px pt-1 text-[10px] text-white/25 shrink-0">
          <span class="h-2.5" />
          <span class="h-2.5">Mon</span>
          <span class="h-2.5" />
          <span class="h-2.5">Wed</span>
          <span class="h-2.5" />
          <span class="h-2.5">Fri</span>
          <span class="h-2.5" />
        </div>

        <!-- Weeks -->
        <div class="flex gap-px">
          <div
            v-for="(week, wi) in calendarWeeks"
            :key="wi"
            class="flex flex-col gap-px"
          >
            <div
              v-for="(day, di) in week"
              :key="di"
              class="h-2.5 w-2.5 rounded-sm transition-colors duration-150"
              :class="[day ? levelColor[day.level] : 'bg-transparent', day ? 'cursor-pointer hover:ring-1 hover:ring-white/40' : '']"
              :title="day ? `${day.date}: ${day.count} trip${day.count !== 1 ? 's' : ''}` : ''"
            />
          </div>
        </div>
      </div>

      <!-- Stats row -->
      <div class="mt-3 flex items-center gap-4 text-xs text-white/40">
        <span>{{ totalContributions }} trips in {{ currentYear }}</span>
        <span>·</span>
        <span>Longest streak: {{ longestStreak }} days</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface ActivityDay {
  date: string
  count: number
}

interface Props {
  data?: ActivityDay[]
  year?: number
  className?: string
}

const props = withDefaults(defineProps<Props>(), {
  data: () => [],
})

const currentYear = computed(() => props.year || new Date().getFullYear())

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const levelColor: Record<number, string> = {
  0: 'bg-white/5',
  1: 'bg-emerald-900/60',
  2: 'bg-emerald-700/70',
  3: 'bg-emerald-500/80',
  4: 'bg-emerald-400',
}

function getLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0
  if (count === 1) return 1
  if (count <= 3) return 2
  if (count <= 6) return 3
  return 4
}

interface CalendarDay {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
}

const calendarWeeks = computed(() => {
  const year = currentYear.value
  const start = new Date(year, 0, 1)
  const end = new Date(year, 11, 31)

  // Build date -> count map
  const dataMap = new Map<string, number>()
  props.data.forEach(d => dataMap.set(d.date, d.count))

  const weeks: Array<Array<CalendarDay | null>> = []
  let currentDate = new Date(start)

  // Pad to Sunday
  const startDay = currentDate.getDay()
  let week: Array<CalendarDay | null> = new Array(startDay).fill(null)

  while (currentDate <= end) {
    const dateStr = currentDate.toISOString().slice(0, 10)
    const count = dataMap.get(dateStr) || 0
    week.push({ date: dateStr, count, level: getLevel(count) })

    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
    currentDate.setDate(currentDate.getDate() + 1)
  }

  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }

  return weeks
})

const totalContributions = computed(() => props.data.reduce((sum, d) => sum + d.count, 0))

const longestStreak = computed(() => {
  let max = 0, cur = 0
  const dataMap = new Set(props.data.filter(d => d.count > 0).map(d => d.date))
  const year = currentYear.value
  const days = (new Date(year, 11, 31).getTime() - new Date(year, 0, 1).getTime()) / 86400000 + 1

  for (let i = 0; i < days; i++) {
    const d = new Date(year, 0, 1 + i).toISOString().slice(0, 10)
    if (dataMap.has(d)) { cur++; max = Math.max(max, cur) }
    else cur = 0
  }
  return max
})
</script>
