<template>
  <article 
    class="bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] hover:border-[#D1CEC4] dark:hover:border-[#414239] rounded-2xl overflow-hidden shadow-sm transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col group h-full"
    @click="$emit('click', trip.id || trip._id)"
  >
    <!-- Cover Image with Dynamic Status Badge -->
    <div class="h-48 w-full relative bg-[#F0EEE9] dark:bg-[#22231F] overflow-hidden flex-shrink-0">
      <img
        :src="trip.coverImageUrl || DEFAULT_TRIP_COVER_IMAGE"
        :alt="trip.destination || trip.name"
        loading="lazy"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 brightness-95"
        @error="onImgError"
      />
      <div class="absolute inset-0 bg-gradient-to-t from-[#111210]/90 via-[#111210]/30 to-black/20"></div>
      
      <!-- Status Badge -->
      <div class="absolute top-4 right-4">
        <span 
          :class="statusBadgeClass"
          class="inline-flex items-center gap-1.5 border text-[11px] font-medium px-2.5 py-1 rounded-full backdrop-blur-md transition-colors"
        >
          <span 
            v-if="tripStatus === 'Ongoing'" 
            class="w-1.5 h-1.5 rounded-full bg-[#86A98B] animate-pulse"
          ></span>
          {{ tripStatus }}
        </span>
      </div>
    </div>

    <!-- Card Content -->
    <div class="p-5 sm:p-6 flex flex-col flex-1 justify-between gap-4">
      <div>
        <h3 class="text-lg font-bold text-[#1C1D1A] dark:text-[#D5D3CA] group-hover:text-[#4A4D40] dark:group-hover:text-white transition-colors mb-2.5 truncate" :title="trip.name">
          {{ trip.name }}
        </h3>

        <div class="flex flex-col gap-2 text-xs text-[#575851] dark:text-[#A5A69B]">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[16px] text-[#7E8075] dark:text-[#85867C] flex-shrink-0">calendar_today</span>
            <span class="truncate">{{ formatDate(trip.startDate) }} – {{ formatDate(trip.endDate) }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[16px] text-[#7E8075] dark:text-[#85867C] flex-shrink-0">location_on</span>
            <span class="truncate" :title="trip.destination">{{ trip.destination }}</span>
          </div>
        </div>
      </div>

      <!-- Footer: Member Avatars Stack + Options Menu -->
      <div class="flex items-center justify-between pt-4 border-t border-[#E3E0D8] dark:border-[#30312C] mt-auto">
        <!-- Avatar Stack (Up to 3 avatars + "+N" overflow) -->
        <div class="flex items-center -space-x-2">
          <div 
            v-for="(member, idx) in displayMembers" 
            :key="member.id || idx"
            class="w-7 h-7 rounded-full border-2 border-white dark:border-[#1B1C19] overflow-hidden bg-[#EFECE6] dark:bg-[#292A25] flex items-center justify-center text-[10px] font-bold text-[#1C1D1A] dark:text-[#D5D3CA] shadow-sm flex-shrink-0"
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
            class="w-7 h-7 rounded-full border-2 border-white dark:border-[#1B1C19] bg-[#EFECE6] dark:bg-[#292A25] text-[#575851] dark:text-[#A5A69B] flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
            :title="`+${extraCount} more`"
          >
            +{{ extraCount }}
          </div>
        </div>

        <!-- 3-Dots Menu -->
        <button 
          @click.stop="$emit('options', trip)"
          class="text-[#7E8075] dark:text-[#85867C] hover:text-[#1C1D1A] dark:hover:text-[#D5D3CA] w-8 h-8 rounded-lg hover:bg-[#F0EEE9] dark:hover:bg-[#292A25] transition-colors flex items-center justify-center"
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
      return 'bg-[#86A98B]/20 text-[#86A98B] border-[#86A98B]/40';
    case 'Completed':
      return 'bg-[#292A25]/90 text-[#A5A69B] border-[#414239]';
    case 'Cancelled':
      return 'bg-[#C77F78]/20 text-[#C77F78] border-[#C77F78]/40';
    case 'Upcoming':
    default:
      return 'bg-[#A7A99A]/20 text-[#D5D3CA] border-[#A7A99A]/40';
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
