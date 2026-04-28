<template>
  <article class="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col cursor-pointer" @click="$emit('click', trip._id)">
    <div class="h-48 w-full relative bg-surface-variant">
      <img :alt="trip.destination" class="w-full h-full object-cover" src="https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&q=80&w=600&h=400" />
      <div class="absolute top-4 right-4">
        <span class="bg-white/90 backdrop-blur-sm text-primary font-bold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider">Upcoming</span>
      </div>
    </div>
    <div class="p-6 flex flex-col flex-grow">
      <h3 class="font-h3 text-h3 text-on-background mb-1">{{ trip.name }}</h3>
      <div class="flex items-center gap-2 text-on-surface-variant mb-4">
        <span class="material-symbols-outlined text-[18px]">location_on</span>
        <span class="font-body-md text-body-md">{{ trip.destination }}</span>
      </div>
      <div class="flex items-center gap-2 text-on-surface-variant mb-6">
        <span class="material-symbols-outlined text-[18px]">calendar_today</span>
        <span class="font-body-md text-body-md">{{ formatDate(trip.startDate) }} - {{ formatDate(trip.endDate) }}</span>
      </div>
      <div class="flex items-center justify-between mt-auto">
        <div class="flex -space-x-3">
          <div class="w-8 h-8 rounded-full border-2 border-white bg-blue-100 flex items-center justify-center font-bold text-blue-900 text-xs shadow-sm">
            {{ trip.ownerId && trip.ownerId.name ? trip.ownerId.name.substring(0,2).toUpperCase() : 'U' }}
          </div>
        </div>
        <button class="text-primary-container font-semibold text-sm hover:underline">View Details</button>
      </div>
    </div>
  </article>
</template>

<script setup>
defineProps({
  trip: {
    type: Object,
    required: true
  }
});

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
</script>
