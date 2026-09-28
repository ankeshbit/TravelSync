<template>
  <article 
    class="bg-[#0F172A] border border-[#1E2E4E] hover:border-blue-500/50 rounded-2xl overflow-hidden shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col group"
    @click="$emit('click', trip.id || trip._id)"
  >
    <!-- Cover Image with Dynamic Status Badge -->
    <div class="h-44 w-full relative bg-[#131F38] overflow-hidden">
      <img
        :src="trip.coverImageUrl || DEFAULT_TRIP_COVER_IMAGE"
        :alt="trip.destination || trip.name"
        loading="lazy"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 brightness-95"
        @error="onImgError"
      />
      <div class="absolute inset-0 bg-gradient-to-t from-[#0F172A]/70 via-transparent to-black/20"></div>
      
      <!-- Status Badge -->
      <div class="absolute top-3 right-3">
        <span 
          :class="statusBadgeClass"
          class="inline-flex items-center gap-1.5 border text-[11px] font-semibold px-2.5 py-0.5 rounded-full backdrop-blur-md transition-colors"
        >
          <span 
            v-if="tripStatus === 'Ongoing'" 
            class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"
          ></span>
          {{ tripStatus }}
        </span>
      </div>
    </div>

    <!-- Card Content -->
    <div class="p-5 flex flex-col flex-1 justify-between gap-4">
      <div>
        <h3 class="text-lg font-bold text-white group-hover:text-blue-400 transition-colors mb-2.5 truncate" :title="trip.name">
          {{ trip.name }}
        </h3>

        <div class="flex flex-col gap-1.5 text-xs text-slate-400">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[16px] text-slate-500">calendar_today</span>
            <span>{{ formatDate(trip.startDate) }} - {{ formatDate(trip.endDate) }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[16px] text-slate-500">location_on</span>
            <span class="truncate">{{ trip.destination }}</span>
          </div>
        </div>
      </div>

      <!-- Footer: Member Avatars Stack + Options Menu -->
      <div class="flex items-center justify-between pt-3 border-t border-[#1E2E4E]/60 mt-auto">
        <!-- Avatar Stack (Up to 3 avatars + "+N" overflow) -->
        <div class="flex items-center -space-x-2">
          <div 
            v-for="(member, idx) in displayMembers" 
            :key="member.id || idx"
            class="w-7 h-7 rounded-full border-2 border-[#0F172A] overflow-hidden bg-slate-700 flex items-center justify-center text-[10px] font-bold text-white shadow-sm flex-shrink-0"
            :title="member.name"
          >
            <img 
              v-if="member.picture && !failedAvatarImages[member.id || idx]" 
              :src="member.picture" 
              :alt="member.name" 
              class="w-full h-full object-cover"
              @error="failedAvatarImages[member.id || idx] = true"
            />
            <span v-else>{{ member.initials }}</span>
          </div>
          <div 
            v-if="extraCount > 0" 
            class="w-7 h-7 rounded-full border-2 border-[#0F172A] bg-blue-600/30 text-blue-300 flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
            :title="`+${extraCount} more`"
          >
            +{{ extraCount }}
          </div>
        </div>

        <!-- 3-Dots Menu -->
        <button 
          @click.stop="$emit('options', trip)"
          class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/60 transition-colors"
          title="Trip options"
        >
          <span class="material-symbols-outlined text-[18px]">more_vert</span>
        </button>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed, reactive } from 'vue';
import { DEFAULT_TRIP_COVER_IMAGE } from '../constants';

const props = defineProps({
  trip: {
    type: Object,
    required: true
  }
});

defineEmits(['click', 'options']);

const failedAvatarImages = reactive({});

const onImgError = (e) => {
  e.target.src = DEFAULT_TRIP_COVER_IMAGE;
};

const formatDate = (dateString) => {
  if (!dateString) return 'TBD';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Compute status (Upcoming, Ongoing, Completed)
const tripStatus = computed(() => {
  const statusStr = (props.trip.status || '').toLowerCase();
  if (statusStr === 'completed') return 'Completed';
  if (statusStr === 'cancelled') return 'Cancelled';
  if (statusStr === 'ongoing') return 'Ongoing';

  if (!props.trip.startDate) {
    return props.trip.status || 'Upcoming';
  }

  const start = new Date(props.trip.startDate);
  if (isNaN(start.getTime())) {
    return props.trip.status || 'Upcoming';
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startTime = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();

  if (today < startTime) {
    return 'Upcoming';
  }

  if (props.trip.endDate) {
    const end = new Date(props.trip.endDate);
    if (!isNaN(end.getTime())) {
      const endTime = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
      if (today > endTime) {
        return 'Completed';
      }
      return 'Ongoing';
    }
  }

  return 'Ongoing';
});

// Style badge differently per status
const statusBadgeClass = computed(() => {
  switch (tripStatus.value) {
    case 'Ongoing':
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'Completed':
      return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    case 'Cancelled':
      return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    case 'Upcoming':
    default:
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  }
});

const getInitials = (name) => {
  if (!name || typeof name !== 'string') return '?';
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return trimmed.substring(0, 2).toUpperCase();
};

// Aggregate unique participants (Owner + Members)
const allMembers = computed(() => {
  const list = [];
  const seenIds = new Set();

  // 1. Owner
  const owner = props.trip.owner || (typeof props.trip.ownerId === 'object' ? props.trip.ownerId : null);
  if (owner && (owner.id || owner._id || owner.name)) {
    const id = String(owner.id || owner._id || '');
    if (id) seenIds.add(id);
    list.push({
      id: id || 'owner',
      name: owner.name || 'Owner',
      picture: owner.picture || '',
      initials: getInitials(owner.name || 'Owner')
    });
  }

  // 2. Members
  const rawMembers = Array.isArray(props.trip.members) ? props.trip.members : [];
  for (const m of rawMembers) {
    const userObj = m.user || (typeof m === 'object' ? m : null);
    const id = String(userObj?.id || userObj?._id || (typeof m === 'string' ? m : ''));
    if (id && seenIds.has(id)) {
      continue;
    }
    if (id) seenIds.add(id);

    const name = userObj?.name || userObj?.email?.split('@')[0] || (typeof m === 'string' ? m : 'Member');
    list.push({
      id: id || name,
      name,
      picture: userObj?.picture || '',
      initials: getInitials(name)
    });
  }

  return list;
});

const displayMembers = computed(() => allMembers.value.slice(0, 3));
const extraCount = computed(() => Math.max(0, allMembers.value.length - 3));
</script>
