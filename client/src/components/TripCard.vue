<template>
  <!-- Fix: Applied card bg (slate-900) and default border (white/10) -->
  <article class="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-white/10 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col cursor-pointer group" @click="$emit('click', trip._id)">
    <div class="h-48 w-full relative bg-surface-variant dark:bg-slate-800">
      <!-- Fix: Added dark:brightness-90 to image -->
      <img :alt="trip.destination" class="w-full h-full object-cover dark:brightness-90" src="https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&q=80&w=600&h=400" />
      <div class="absolute top-4 right-4">
        <span class="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm text-primary dark:text-blue-400 font-bold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider">Upcoming</span>
      </div>
    </div>
    <div class="p-6 flex flex-col flex-grow">
      <!-- Fix: Added dark:text-slate-100 for primary text contrast -->
      <h3 class="font-h3 text-h3 text-on-background dark:text-slate-100 mb-1 group-hover:text-primary dark:group-hover:text-blue-400 transition-colors">{{ trip.name }}</h3>
      <!-- Fix: Added dark:text-slate-400 for secondary text contrast -->
      <div class="flex items-center gap-2 text-on-surface-variant dark:text-slate-400 mb-4">
        <span class="material-symbols-outlined text-[18px]">location_on</span>
        <span class="font-body-md text-body-md">{{ trip.destination }}</span>
      </div>
      <!-- Fix: Added dark:text-slate-400 for secondary text contrast -->
      <div class="flex items-center gap-2 text-on-surface-variant dark:text-slate-400 mb-6">
        <span class="material-symbols-outlined text-[18px]">calendar_today</span>
        <span class="font-body-md text-body-md">{{ formatDate(trip.startDate) }} - {{ formatDate(trip.endDate) }}</span>
      </div>
      <div class="flex items-center justify-between mt-auto">
        <div class="flex -space-x-3">
          <!-- Fix: Updated border for avatar -->
          <div class="w-8 h-8 rounded-full border-2 border-white dark:border-white/10 bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center font-bold text-blue-900 dark:text-blue-300 text-xs shadow-sm">
            {{ trip.ownerId && trip.ownerId.name ? trip.ownerId.name.substring(0,2).toUpperCase() : 'U' }}
          </div>
        </div>
        <button class="text-primary dark:text-blue-400 font-semibold text-sm hover:underline">View Details</button>
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
