<template>
  <AppLayout>
    <!-- Top Navigation / Breadcrumb -->
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <router-link 
        to="/offline-trips" 
        class="inline-flex items-center gap-2 text-xs font-semibold text-[#575851] dark:text-[#A5A69B] hover:text-[#1C1D1A] dark:hover:text-[#D5D3CA] transition-colors"
      >
        <span class="material-symbols-outlined text-[16px]">arrow_back</span>
        <span>Back to Saved Offline Trips</span>
      </router-link>

      <div class="flex items-center gap-2">
        <!-- Airplane Mode / Offline Badge -->
        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-semibold">
          <span class="material-symbols-outlined text-[15px]">cloud_off</span>
          <span>Offline Companion Mode</span>
        </div>

        <!-- Sync Button (if online and pending changes exist) -->
        <button
          v-if="isOnline && isServerReachable && offlineStore.pendingSyncCount > 0"
          @click="handleSyncNow"
          :disabled="offlineStore.isSyncing"
          class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#86A98B] hover:bg-[#729777] text-white text-xs font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-50"
        >
          <span class="material-symbols-outlined text-[15px]" :class="{ 'animate-spin': offlineStore.isSyncing }">sync</span>
          <span>Sync {{ offlineStore.pendingSyncCount }} Change(s)</span>
        </button>
      </div>
    </div>

    <!-- Sync Toast Alert if Sync succeeded -->
    <div v-if="offlineStore.syncMessage" class="mb-5 p-3.5 rounded-2xl bg-[#86A98B]/20 border border-[#86A98B]/30 text-[#2B4B30] dark:text-[#A2C2AA] text-xs font-semibold flex items-center gap-2">
      <span class="material-symbols-outlined text-[18px]">check_circle</span>
      <span>{{ offlineStore.syncMessage }}</span>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="space-y-6 animate-pulse">
      <div class="h-64 rounded-3xl bg-[#F0EEE9] dark:bg-[#1B1C19]"></div>
      <div class="h-12 rounded-2xl bg-[#E3E0D8] dark:bg-[#22231F]"></div>
      <div class="h-96 rounded-3xl bg-[#F0EEE9] dark:bg-[#1B1C19]"></div>
    </div>

    <!-- Missing / Not Downloaded State -->
    <div v-else-if="!tripBundle || !tripBundle.trip" class="bg-[#FFFFFF] dark:bg-[#1B1C19] border border-dashed border-[#E3E0D8] dark:border-[#30312C] rounded-3xl p-10 text-center max-w-lg mx-auto my-12">
      <span class="material-symbols-outlined text-4xl text-[#7E8075] mb-2">sentiment_dissatisfied</span>
      <h3 class="text-lg font-bold text-[#1C1D1A] dark:text-[#D5D3CA]">Trip Not Available Offline</h3>
      <p class="text-xs sm:text-sm text-[#575851] dark:text-[#A5A69B] mt-2 leading-relaxed">
        This trip has not been downloaded for offline access on this device, or the storage was cleared. Connect to the internet to download it.
      </p>
      <div class="mt-6 flex justify-center gap-3">
        <router-link
          to="/offline-trips"
          class="bg-[#F0EEE9] dark:bg-[#22231F] text-[#1C1D1A] dark:text-[#D5D3CA] text-xs font-semibold px-4 py-2 rounded-xl border border-[#E3E0D8] dark:border-[#30312C]"
        >
          Saved Trips
        </router-link>
        <router-link
          :to="`/trips/${route.params.tripId}`"
          class="bg-[#86A98B] text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-sm"
        >
          Open Online Trip
        </router-link>
      </div>
    </div>

    <!-- Active Trip Companion Content -->
    <div v-else class="space-y-6">
      <!-- Hero Banner -->
      <section class="relative min-h-[220px] sm:min-h-[260px] w-full rounded-3xl overflow-hidden border border-[#E3E0D8] dark:border-[#30312C] shadow-sm flex flex-col justify-end">
        <img 
          :src="tripBundle.trip.coverImageUrl || DEFAULT_TRIP_COVER_IMAGE" 
          :alt="tripBundle.trip.name"
          class="absolute inset-0 w-full h-full object-cover brightness-[0.70]"
          @error="onImgError"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-[#111210] via-[#111210]/60 to-transparent"></div>

        <div class="relative z-10 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div class="inline-flex items-center gap-1.5 bg-[#86A98B]/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider mb-2.5 shadow-sm">
              <span class="material-symbols-outlined text-[14px]">offline_bolt</span>
              <span>Available Offline</span>
            </div>
            <h1 class="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              {{ tripBundle.trip.name }}
            </h1>
            <div class="flex flex-wrap items-center gap-3 text-xs text-[#D5D3CA] mt-2">
              <span class="flex items-center gap-1">
                <span class="material-symbols-outlined text-[16px] text-[#86A98B]">location_on</span>
                <span>{{ tripBundle.trip.destination }}</span>
              </span>
              <span>•</span>
              <span class="flex items-center gap-1">
                <span class="material-symbols-outlined text-[16px] text-[#A7A99A]">calendar_today</span>
                <span>{{ formatDate(tripBundle.trip.startDate) }} – {{ formatDate(tripBundle.trip.endDate) }}</span>
              </span>
            </div>
          </div>

          <div class="text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-end gap-1 text-[11px] text-[#A5A69B] bg-[#111210]/60 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10">
            <span>Last downloaded:</span>
            <span class="text-white font-medium">{{ formatRelative(tripBundle.trip.downloadedAt) }}</span>
          </div>
        </div>
      </section>

      <!-- Navigation Tabs -->
      <div class="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[#E3E0D8] dark:border-[#30312C] text-xs font-semibold">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="px-4 py-2.5 rounded-xl whitespace-nowrap transition-all flex items-center gap-2"
          :class="activeTab === tab.id ? 'bg-[#86A98B] text-white shadow-sm' : 'text-[#575851] dark:text-[#A5A69B] hover:bg-[#F0EEE9] dark:hover:bg-[#22231F]'"
        >
          <span class="material-symbols-outlined text-[18px]">{{ tab.icon }}</span>
          <span>{{ tab.label }}</span>
          <span v-if="tab.badge !== undefined" class="text-[10px] px-1.5 py-0.2 rounded-full" :class="activeTab === tab.id ? 'bg-white/25 text-white' : 'bg-[#E3E0D8] dark:bg-[#30312C] text-[#575851] dark:text-[#D5D3CA]'">
            {{ tab.badge }}
          </span>
        </button>
      </div>

      <!-- TAB 1: ITINERARY -->
      <section v-if="activeTab === 'itinerary'" class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-bold text-[#1C1D1A] dark:text-[#D5D3CA]">Day-by-Day Itinerary</h2>
            <p class="text-xs text-[#575851] dark:text-[#A5A69B] mt-0.5">Explore scheduled sights, activities, and notes with full offline navigation details.</p>
          </div>
          <span class="text-xs text-[#7E8075]">{{ tripBundle.itinerary?.length || 0 }} stop(s)</span>
        </div>

        <div v-if="!tripBundle.itinerary || tripBundle.itinerary.length === 0" class="p-8 text-center bg-[#FFFFFF] dark:bg-[#1B1C19] rounded-3xl border border-[#E3E0D8] dark:border-[#30312C]">
          <span class="material-symbols-outlined text-3xl text-[#7E8075]">map</span>
          <p class="text-sm font-semibold text-[#1C1D1A] dark:text-[#D5D3CA] mt-2">No places added to this trip's itinerary</p>
        </div>

        <div v-else class="space-y-6">
          <div 
            v-for="(dayPlaces, dayNum) in groupedItinerary" 
            :key="dayNum"
            class="bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-3xl p-6 shadow-sm"
          >
            <div class="flex items-center gap-3 mb-4 pb-3 border-b border-[#E3E0D8] dark:border-[#30312C]">
              <div class="w-8 h-8 rounded-xl bg-[#86A98B]/20 text-[#86A98B] flex items-center justify-center font-extrabold text-sm">
                {{ dayNum }}
              </div>
              <h3 class="text-base font-bold text-[#1C1D1A] dark:text-[#D5D3CA]">Day {{ dayNum }}</h3>
              <span class="text-xs text-[#7E8075]">• {{ dayPlaces.length }} activity(ies)</span>
            </div>

            <div class="space-y-4">
              <div 
                v-for="(place, idx) in dayPlaces" 
                :key="place.id || idx"
                class="p-4 rounded-2xl bg-[#F7F6F2] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div class="flex items-start gap-3 min-w-0 flex-1">
                  <div class="w-9 h-9 rounded-xl bg-[#EFECE6] dark:bg-[#292A25] text-[#575851] dark:text-[#D5D3CA] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span class="material-symbols-outlined text-[20px]">{{ getCategoryIcon(place.category) }}</span>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <h4 class="text-sm font-bold text-[#1C1D1A] dark:text-[#D5D3CA] truncate">{{ place.name }}</h4>
                      <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-[#E3E0D8] dark:bg-[#30312C] text-[#575851] dark:text-[#A5A69B]">
                        {{ place.category || 'Spot' }}
                      </span>
                    </div>
                    <p class="text-xs text-[#7E8075] dark:text-[#85867C] mt-1 flex items-center gap-1">
                      <span class="material-symbols-outlined text-[14px]">pin_drop</span>
                      <span>{{ place.address || 'Address not specified' }}</span>
                    </p>
                    <div class="mt-2.5 space-y-1.5">
                      <div v-if="place.note" class="text-xs bg-white dark:bg-[#1B1C19] p-2.5 rounded-xl border border-[#E3E0D8] dark:border-[#30312C] text-[#575851] dark:text-[#A5A69B]">
                        <span class="font-semibold text-[#1C1D1A] dark:text-[#D5D3CA]">Note:</span> {{ place.note }}
                      </div>
                      <button
                        @click="openPlaceNoteModal(place)"
                        class="inline-flex items-center gap-1 text-[11px] font-semibold text-[#86A98B] hover:text-[#729777] transition-colors"
                      >
                        <span class="material-symbols-outlined text-[14px]">edit_note</span>
                        <span>{{ place.note ? 'Edit Note' : 'Add Note' }}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-3 text-xs text-[#7E8075] dark:text-[#85867C] flex-shrink-0 self-end md:self-center">
                  <span v-if="place.duration" class="flex items-center gap-1">
                    <span class="material-symbols-outlined text-[15px]">timer</span>
                    <span>{{ place.duration }} mins</span>
                  </span>
                  <span v-if="place.lat && place.lng" class="text-[10px] px-2 py-1 rounded-lg bg-black/5 dark:bg-white/5 font-mono">
                    {{ place.lat.toFixed(3) }}, {{ place.lng.toFixed(3) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- TAB 2: STAYS & TRANSPORT -->
      <section v-if="activeTab === 'stays'" class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-bold text-[#1C1D1A] dark:text-[#D5D3CA]">Accommodations & Transport</h2>
            <p class="text-xs text-[#575851] dark:text-[#A5A69B] mt-0.5">Hotel reservations and transport references verified from your trip places.</p>
          </div>
        </div>

        <div v-if="!tripBundle.staysAndTransport || tripBundle.staysAndTransport.length === 0" class="p-8 text-center bg-[#FFFFFF] dark:bg-[#1B1C19] rounded-3xl border border-[#E3E0D8] dark:border-[#30312C]">
          <span class="material-symbols-outlined text-3xl text-[#7E8075]">hotel</span>
          <p class="text-sm font-semibold text-[#1C1D1A] dark:text-[#D5D3CA] mt-2">No accommodations or transport booked for this trip</p>
          <p class="text-xs text-[#7E8075] dark:text-[#85867C] mt-1">Verified lodging places added to your itinerary will be displayed here.</p>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div 
            v-for="stay in tripBundle.staysAndTransport" 
            :key="stay.id"
            class="bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-3xl p-6 shadow-sm flex flex-col justify-between"
          >
            <div>
              <div class="flex items-center justify-between mb-4">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider" :class="stay.type === 'flight' ? 'bg-sky-500/15 text-sky-700 dark:text-sky-400' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'">
                  <span class="material-symbols-outlined text-[16px]">{{ stay.type === 'flight' ? 'flight' : 'hotel' }}</span>
                  <span>{{ stay.type }}</span>
                </span>
                <span v-if="stay.bookingRef" class="text-xs font-mono font-bold bg-[#F0EEE9] dark:bg-[#22231F] px-2.5 py-1 rounded-lg text-[#1C1D1A] dark:text-[#D5D3CA]">
                  {{ stay.bookingRef }}
                </span>
              </div>

              <h3 class="text-base font-bold text-[#1C1D1A] dark:text-[#D5D3CA]">{{ stay.name }}</h3>
              <p class="text-xs text-[#7E8075] dark:text-[#85867C] mt-1 flex items-center gap-1">
                <span class="material-symbols-outlined text-[15px]">location_on</span>
                <span>{{ stay.address || stay.terminal || 'Address not specified' }}</span>
              </p>

              <div class="mt-4 p-3 rounded-2xl bg-[#F7F6F2] dark:bg-[#22231F] text-xs text-[#575851] dark:text-[#A5A69B] space-y-1.5">
                <p v-if="stay.checkIn || stay.departure"><span class="font-semibold text-[#1C1D1A] dark:text-[#D5D3CA]">Check-In / Departure:</span> {{ formatDate(stay.checkIn || stay.departure) }}</p>
                <p v-if="stay.checkOut || stay.arrival"><span class="font-semibold text-[#1C1D1A] dark:text-[#D5D3CA]">Check-Out / Arrival:</span> {{ formatDate(stay.checkOut || stay.arrival) }}</p>
                <p v-if="stay.notes"><span class="font-semibold text-[#1C1D1A] dark:text-[#D5D3CA]">Details:</span> {{ stay.notes }}</p>
              </div>
            </div>

            <div class="mt-5 pt-3 border-t border-[#E3E0D8] dark:border-[#30312C] flex items-center justify-between text-xs text-[#7E8075]">
              <span class="flex items-center gap-1">
                <span class="material-symbols-outlined text-[15px] text-[#86A98B]">verified</span>
                <span>Saved Place Record</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- TAB 3: TICKETS & DOCUMENTS -->
      <section v-if="activeTab === 'documents'" class="space-y-6">
        <div>
          <h2 class="text-lg font-bold text-[#1C1D1A] dark:text-[#D5D3CA]">Tickets & Travel Documents</h2>
          <p class="text-xs text-[#575851] dark:text-[#A5A69B] mt-0.5">Locally stored travel documents and digital confirmations.</p>
        </div>

        <div v-if="!tripBundle.documents || tripBundle.documents.length === 0" class="p-8 text-center bg-[#FFFFFF] dark:bg-[#1B1C19] rounded-3xl border border-[#E3E0D8] dark:border-[#30312C]">
          <span class="material-symbols-outlined text-3xl text-[#7E8075]">description</span>
          <p class="text-sm font-semibold text-[#1C1D1A] dark:text-[#D5D3CA] mt-2">No travel documents stored for offline use</p>
          <p class="text-xs text-[#7E8075] dark:text-[#85867C] mt-1">Uploaded tickets, boarding passes, and documents will appear here once downloaded.</p>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div 
            v-for="doc in tripBundle.documents" 
            :key="doc.id"
            class="bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-2xl p-5 flex items-center justify-between gap-4 shadow-sm"
          >
            <div class="flex items-center gap-3.5 min-w-0">
              <div class="w-12 h-12 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0">
                <span class="material-symbols-outlined text-2xl">picture_as_pdf</span>
              </div>
              <div class="min-w-0">
                <h4 class="text-sm font-bold text-[#1C1D1A] dark:text-[#D5D3CA] truncate">{{ doc.name }}</h4>
                <p class="text-xs text-[#7E8075] dark:text-[#85867C] mt-0.5 truncate">{{ doc.description }}</p>
                <div class="flex items-center gap-2 mt-1 text-[11px] text-[#86A98B] font-semibold">
                  <span class="material-symbols-outlined text-[13px]">offline_pin</span>
                  <span>Ready Offline • {{ (doc.size / 1024).toFixed(0) }} KB</span>
                </div>
              </div>
            </div>

            <button
              @click="openDocModal(doc)"
              class="px-3 py-2 rounded-xl bg-[#F0EEE9] dark:bg-[#22231F] hover:bg-[#E3E0D8] dark:hover:bg-[#292A25] text-xs font-semibold text-[#1C1D1A] dark:text-[#D5D3CA] flex items-center gap-1.5 transition-all flex-shrink-0"
            >
              <span class="material-symbols-outlined text-[16px]">visibility</span>
              <span>View</span>
            </button>
          </div>
        </div>
      </section>

      <!-- TAB 4: EMERGENCY INFORMATION -->
      <section v-if="activeTab === 'emergency'" class="space-y-6">
        <div>
          <h2 class="text-lg font-bold text-[#1C1D1A] dark:text-[#D5D3CA]">Emergency Contacts & Local Helplines</h2>
          <p class="text-xs text-[#575851] dark:text-[#A5A69B] mt-0.5">Verified emergency services and contacts for your organizers and co-travelers.</p>
        </div>

        <div class="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2.5">
          <span class="material-symbols-outlined text-[20px] flex-shrink-0">info</span>
          <span>Placing emergency phone calls requires standard cellular network coverage on your device.</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div 
            v-for="contact in tripBundle.emergencyContacts" 
            :key="contact.id"
            class="bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-2xl p-5 shadow-sm flex flex-col justify-between"
          >
            <div>
              <div class="flex items-center justify-between mb-3">
                <span class="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#F0EEE9] dark:bg-[#22231F] text-[#575851] dark:text-[#A5A69B]">
                  {{ contact.relationship }}
                </span>
                <span class="material-symbols-outlined text-[18px] text-[#86A98B]">contact_emergency</span>
              </div>
              <h4 class="text-base font-bold text-[#1C1D1A] dark:text-[#D5D3CA]">{{ contact.name }}</h4>
              <p v-if="contact.notes" class="text-xs text-[#7E8075] dark:text-[#85867C] mt-1">{{ contact.notes }}</p>
              <p v-if="contact.source" class="text-[10px] text-[#86A98B] mt-1 flex items-center gap-1">
                <span class="material-symbols-outlined text-[12px]">verified</span>
                <span>Source: {{ contact.source }}</span>
              </p>
            </div>

            <div class="mt-4 pt-3 border-t border-[#E3E0D8] dark:border-[#30312C] flex items-center justify-between">
              <a 
                v-if="contact.phone"
                :href="`tel:${contact.phone}`"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#86A98B] hover:bg-[#729777] text-white text-xs font-bold transition-all shadow-sm"
              >
                <span class="material-symbols-outlined text-[15px]">call</span>
                <span>{{ contact.phone }}</span>
              </a>
              <span v-else class="text-[11px] text-[#7E8075] dark:text-[#85867C] italic">No phone on file</span>

              <a 
                v-if="contact.email" 
                :href="`mailto:${contact.email}`"
                class="text-xs font-medium text-[#7E8075] dark:text-[#85867C] hover:text-[#1C1D1A] dark:hover:text-[#D5D3CA] truncate ml-2"
              >
                {{ contact.email }}
              </a>
            </div>
          </div>
        </div>
      </section>

      <!-- TAB 5: PACKING CHECKLIST (Interactive Offline Storage) -->
      <section v-if="activeTab === 'checklist'" class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-bold text-[#1C1D1A] dark:text-[#D5D3CA]">Packing & Travel Checklist</h2>
            <p class="text-xs text-[#575851] dark:text-[#A5A69B] mt-0.5">Tap any item to mark completed. Edits save to IndexedDB instantly and persist offline.</p>
          </div>
          <span class="text-xs font-semibold text-[#86A98B]">
            {{ completedCount }} / {{ tripBundle.checklists?.length || 0 }} completed
          </span>
        </div>

        <div class="bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-3xl p-6 shadow-sm divide-y divide-[#E3E0D8] dark:divide-[#30312C]">
          <div 
            v-for="item in tripBundle.checklists" 
            :key="item.id"
            @click="toggleItem(item)"
            class="py-3.5 flex items-center justify-between gap-4 cursor-pointer hover:bg-[#F7F6F2] dark:hover:bg-[#22231F]/50 px-3 rounded-xl transition-colors group"
          >
            <div class="flex items-center gap-3.5 min-w-0">
              <div 
                class="w-6 h-6 rounded-lg border flex items-center justify-center transition-colors"
                :class="item.completed ? 'bg-[#86A98B] border-[#86A98B] text-white' : 'border-[#C8C5BC] dark:border-[#4B4C45] bg-transparent group-hover:border-[#86A98B]'"
              >
                <span v-if="item.completed" class="material-symbols-outlined text-[16px]">check</span>
              </div>
              <span 
                class="text-sm font-medium transition-all"
                :class="item.completed ? 'line-through text-[#7E8075] dark:text-[#85867C]' : 'text-[#1C1D1A] dark:text-[#D5D3CA]'"
              >
                {{ item.title }}
              </span>
            </div>

            <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-[#F0EEE9] dark:bg-[#22231F] text-[#575851] dark:text-[#A5A69B]">
              {{ item.category }}
            </span>
          </div>
        </div>
      </section>

      <!-- TAB 6: TRAVEL NOTES (Interactive Offline Editing) -->
      <section v-if="activeTab === 'notes'" class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-bold text-[#1C1D1A] dark:text-[#D5D3CA]">Travel Notes & Tips</h2>
            <p class="text-xs text-[#575851] dark:text-[#A5A69B] mt-0.5">Edit notes without internet access. Local modifications queue automatically for cloud synchronization.</p>
          </div>
        </div>

        <div class="space-y-4">
          <div 
            v-for="note in tripBundle.notes" 
            :key="note.id"
            class="bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-3xl p-6 shadow-sm space-y-3"
          >
            <div class="flex items-center justify-between">
              <h3 class="text-base font-bold text-[#1C1D1A] dark:text-[#D5D3CA]">{{ note.title }}</h3>
              <span class="text-[11px] text-[#7E8075]">Last edited: {{ formatRelative(note.updatedAt) }}</span>
            </div>

            <textarea
              v-model="note.content"
              rows="3"
              class="w-full bg-[#F7F6F2] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] rounded-2xl p-4 text-xs sm:text-sm text-[#1C1D1A] dark:text-[#D5D3CA] focus:outline-none focus:border-[#86A98B] transition-all resize-none"
              placeholder="Add your offline travel notes, gate changes, door codes..."
            ></textarea>

            <div class="flex items-center justify-end">
              <button
                @click="saveNoteChanges(note)"
                class="px-4 py-2 rounded-xl bg-[#86A98B] hover:bg-[#729777] text-white text-xs font-semibold shadow-sm transition-all active:scale-95 flex items-center gap-1.5"
              >
                <span class="material-symbols-outlined text-[16px]">save</span>
                <span>Save Note Locally</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- TAB 7: BUDGET & EXPENSES -->
      <section v-if="activeTab === 'expenses'" class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-bold text-[#1C1D1A] dark:text-[#D5D3CA]">Expenses & Budget Summary</h2>
            <p class="text-xs text-[#575851] dark:text-[#A5A69B] mt-0.5">Offline expense ledger as captured during your last synchronization.</p>
          </div>
          <span class="text-xs font-mono font-bold text-[#86A98B]">
            Budget: {{ tripBundle.trip.currency }} {{ tripBundle.trip.budgetPerPerson || 0 }} / person
          </span>
        </div>

        <div v-if="!tripBundle.expenses || tripBundle.expenses.length === 0" class="p-8 text-center bg-[#FFFFFF] dark:bg-[#1B1C19] rounded-3xl border border-[#E3E0D8] dark:border-[#30312C]">
          <span class="material-symbols-outlined text-3xl text-[#7E8075]">receipt_long</span>
          <p class="text-sm font-semibold text-[#1C1D1A] dark:text-[#D5D3CA] mt-2">No expenses recorded for this trip</p>
        </div>

        <div v-else class="bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-3xl overflow-hidden shadow-sm">
          <div class="p-5 border-b border-[#E3E0D8] dark:border-[#30312C] flex items-center justify-between bg-[#F7F6F2] dark:bg-[#22231F]">
            <span class="text-xs font-bold uppercase tracking-wider text-[#7E8075] dark:text-[#85867C]">Expense Item</span>
            <span class="text-xs font-bold uppercase tracking-wider text-[#7E8075] dark:text-[#85867C]">Amount</span>
          </div>

          <div class="divide-y divide-[#E3E0D8] dark:divide-[#30312C]">
            <div 
              v-for="exp in tripBundle.expenses" 
              :key="exp.id"
              class="p-4 sm:p-5 flex items-center justify-between gap-4 text-xs sm:text-sm"
            >
              <div>
                <h4 class="font-bold text-[#1C1D1A] dark:text-[#D5D3CA]">{{ exp.title }}</h4>
                <p class="text-xs text-[#7E8075] dark:text-[#85867C] mt-0.5 capitalize">
                  Category: {{ exp.category }} • Paid by {{ exp.paidBy?.name || 'Member' }}
                </p>
              </div>
              <span class="font-bold font-mono text-[#1C1D1A] dark:text-[#D5D3CA]">
                {{ exp.currency }} {{ exp.amount }}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Place Note Modal (Offline Place Note Editing) -->
    <div v-if="editingPlace" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div class="bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <span class="material-symbols-outlined text-2xl text-[#86A98B]">edit_note</span>
            <h3 class="text-base font-bold text-[#1C1D1A] dark:text-[#D5D3CA] truncate">{{ editingPlace.name }}</h3>
          </div>
          <button @click="editingPlace = null" class="text-[#7E8075] hover:text-[#1C1D1A] dark:hover:text-[#D5D3CA]">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div>
          <label class="block text-xs font-semibold text-[#575851] dark:text-[#A5A69B] mb-1.5">Offline Place Note</label>
          <textarea
            v-model="placeNoteDraft"
            rows="4"
            class="w-full bg-[#F7F6F2] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] rounded-2xl p-4 text-xs sm:text-sm text-[#1C1D1A] dark:text-[#D5D3CA] focus:outline-none focus:border-[#86A98B] transition-all resize-none"
            placeholder="Add notes, entrance details, photography spots, or tips..."
          ></textarea>
        </div>

        <div class="flex items-center justify-end gap-3 pt-2">
          <button
            @click="editingPlace = null"
            class="px-4 py-2 rounded-xl text-xs font-semibold text-[#575851] dark:text-[#A5A69B] hover:bg-[#F0EEE9] dark:hover:bg-[#22231F] transition-colors"
          >
            Cancel
          </button>
          <button
            @click="savePlaceNote"
            class="px-4 py-2 rounded-xl bg-[#86A98B] hover:bg-[#729777] text-white text-xs font-semibold shadow-sm transition-all"
          >
            Save Note Locally
          </button>
        </div>
      </div>
    </div>

    <!-- Document Preview Modal -->
    <div v-if="selectedDoc" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div class="bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <span class="material-symbols-outlined text-2xl text-red-500">picture_as_pdf</span>
            <h3 class="text-base font-bold text-[#1C1D1A] dark:text-[#D5D3CA] truncate">{{ selectedDoc.name }}</h3>
          </div>
          <button @click="selectedDoc = null" class="text-[#7E8075] hover:text-[#1C1D1A] dark:hover:text-[#D5D3CA]">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div class="p-6 rounded-2xl bg-[#F7F6F2] dark:bg-[#22231F] text-center space-y-3 border border-dashed border-[#E3E0D8] dark:border-[#30312C]">
          <span class="material-symbols-outlined text-4xl text-[#86A98B]">offline_pin</span>
          <h4 class="text-sm font-bold text-[#1C1D1A] dark:text-[#D5D3CA]">Offline Document Available</h4>
          <p class="text-xs text-[#575851] dark:text-[#A5A69B] leading-relaxed">
            {{ selectedDoc.description || 'Verified travel document ready for inspection at transport hubs and check-in desks.' }}
          </p>
          <div class="text-[11px] font-mono text-[#7E8075]">
            Size: {{ (selectedDoc.size / 1024).toFixed(1) }} KB • Verified Offline Copy
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button
            @click="selectedDoc = null"
            class="px-4 py-2 rounded-xl bg-[#86A98B] text-white text-xs font-semibold shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import AppLayout from '../components/AppLayout.vue';
import { useAuthStore } from '../stores/auth';
import { useOfflineStore } from '../stores/offline';
import { useToastStore } from '../stores/toast';
import { useConnectivity } from '../composables/useConnectivity';

const DEFAULT_TRIP_COVER_IMAGE = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80';

const route = useRoute();
const authStore = useAuthStore();
const offlineStore = useOfflineStore();
const toastStore = useToastStore();
const { isOnline, isServerReachable } = useConnectivity();

const loading = ref(true);
const activeTab = ref('itinerary');
const selectedDoc = ref(null);
const editingPlace = ref(null);
const placeNoteDraft = ref('');

const currentUserId = computed(() => {
  if (authStore.currentUser?.id) return authStore.currentUser.id;
  if (authStore.firebaseUser?.uid) return authStore.firebaseUser.uid;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.id) return parsed.id;
        if (parsed?.firebaseUid) return parsed.firebaseUid;
      }
    } catch {}
  }
  return null;
});

const tripBundle = computed(() => offlineStore.activeTripBundle);

const completedCount = computed(() => {
  return (tripBundle.value?.checklists || []).filter(c => c.completed || c.isCompleted).length;
});

const groupedItinerary = computed(() => {
  if (!tripBundle.value?.itinerary) return {};
  const groups = {};
  tripBundle.value.itinerary.forEach(place => {
    const day = place.dayNumber || 1;
    if (!groups[day]) groups[day] = [];
    groups[day].push(place);
  });
  return groups;
});

const tabs = computed(() => [
  { id: 'itinerary', label: 'Itinerary', icon: 'event_note', badge: tripBundle.value?.itinerary?.length || 0 },
  { id: 'stays', label: 'Stays & Transport', icon: 'hotel', badge: tripBundle.value?.staysAndTransport?.length || 0 },
  { id: 'documents', label: 'Documents', icon: 'description', badge: tripBundle.value?.documents?.length || 0 },
  { id: 'emergency', label: 'Emergency Info', icon: 'emergency', badge: tripBundle.value?.emergencyContacts?.length || 0 },
  { id: 'checklist', label: 'Packing Checklist', icon: 'checklist', badge: `${completedCount.value}/${tripBundle.value?.checklists?.length || 0}` },
  { id: 'notes', label: 'Travel Notes', icon: 'edit_note', badge: tripBundle.value?.notes?.length || 0 },
  { id: 'expenses', label: 'Expenses', icon: 'payments', badge: tripBundle.value?.expenses?.length || 0 }
]);

onMounted(async () => {
  loading.value = true;
  try {
    if (currentUserId.value) {
      await offlineStore.loadTripBundle(currentUserId.value, route.params.tripId);
    } else {
      offlineStore.activeTripBundle = null;
    }
  } finally {
    loading.value = false;
  }
});

function formatDate(val) {
  if (!val) return 'TBD';
  const d = new Date(val);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatRelative(val) {
  if (!val) return 'Recently';
  const diff = Date.now() - new Date(val).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getCategoryIcon(cat) {
  const c = (cat || '').toLowerCase();
  if (c === 'lodging' || c === 'hotel') return 'hotel';
  if (c === 'food' || c === 'restaurant') return 'restaurant';
  if (c === 'flight' || c === 'transit') return 'flight';
  return 'location_on';
}

function onImgError(e) {
  e.target.src = DEFAULT_TRIP_COVER_IMAGE;
}

function openDocModal(doc) {
  selectedDoc.value = doc;
}

function openPlaceNoteModal(place) {
  editingPlace.value = place;
  placeNoteDraft.value = place.note || '';
}

async function savePlaceNote() {
  if (!editingPlace.value || !currentUserId.value) return;
  const targetPlaceId = editingPlace.value.originalId || editingPlace.value.placeId || editingPlace.value.id;
  try {
    await offlineStore.updatePlaceNote(currentUserId.value, route.params.tripId, targetPlaceId, placeNoteDraft.value);
    editingPlace.value.note = placeNoteDraft.value;
    toastStore.showToast('Place note saved locally. Queued for cloud sync.', 'success');
    editingPlace.value = null;
  } catch {
    toastStore.showToast('Failed to save place note locally', 'error');
  }
}

async function toggleItem(item) {
  if (!currentUserId.value) return;
  const nextVal = !Boolean(item.completed || item.isCompleted);
  const targetId = item.originalId || item.id;
  try {
    await offlineStore.toggleChecklistItem(currentUserId.value, route.params.tripId, targetId, nextVal);
  } catch {
    toastStore.showToast('Failed to update checklist locally', 'error');
  }
}

async function saveNoteChanges(note) {
  if (!currentUserId.value) return;
  const targetId = note.originalId || note.id;
  try {
    await offlineStore.updateNote(currentUserId.value, route.params.tripId, targetId, note.content);
    toastStore.showToast('Note saved locally. Changes queued for cloud sync.', 'success');
  } catch {
    toastStore.showToast('Failed to save note locally', 'error');
  }
}

async function handleSyncNow() {
  if (!currentUserId.value) return;
  try {
    await offlineStore.syncPendingChanges(currentUserId.value, route.params.tripId);
    toastStore.showToast('Sync completed', 'success');
  } catch {
    toastStore.showToast('Sync failed', 'error');
  }
}
</script>
