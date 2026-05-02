<template>
  <div class="bg-surface text-on-surface min-h-screen flex flex-col">
    <!-- TopAppBar -->
    <header class="fixed top-0 left-0 w-full h-16 flex items-center justify-between px-6 bg-white/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 z-50">
      <div class="flex items-center gap-8">
        <span class="text-xl font-bold tracking-tight text-sky-900 dark:text-sky-100">TravelSync</span>
        <nav class="hidden md:flex items-center gap-6">
          <router-link to="/explore" class="font-['Plus_Jakarta_SANS'] text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-sky-800 dark:hover:text-sky-300 transition-colors">Explore</router-link>
          <router-link to="/dashboard" class="font-['Plus_Jakarta_SANS'] text-sm font-medium text-sky-900 dark:text-sky-400 border-b-2 border-sky-900 dark:border-sky-400 pb-1">My Trips</router-link>
        </nav>
      </div>
      <div class="flex items-center gap-4">
        <!-- Not replacing user profile, keep static for now -->
        <button class="material-symbols-outlined text-outline hover:bg-gray-50 p-2 rounded-full transition-colors">notifications</button>
        <button class="material-symbols-outlined text-outline hover:bg-gray-50 p-2 rounded-full transition-colors">settings</button>
      </div>
    </header>

    <!-- SideNavBar -->
    <aside class="fixed left-0 top-0 h-full w-64 pt-16 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-slate-900 z-40 hidden md:block">
      <div class="flex flex-col gap-1 p-4 h-full">
        <div class="mb-6 px-2 py-4 rounded-xl bg-surface-container-low" v-if="trip">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-primary-container overflow-hidden flex-shrink-0 flex items-center justify-center text-white">
              <span class="material-symbols-outlined">map</span>
            </div>
            <div>
              <h4 class="text-sm font-bold text-sky-900 dark:text-sky-100">{{ trip.name }}</h4>
              <p class="text-[11px] text-gray-500">{{ formatDate(trip.startDate) }} - {{ formatDate(trip.endDate) }}</p>
            </div>
          </div>
        </div>
        <nav class="flex-1 space-y-1">
          <router-link :to="`/trips/${route.params.tripId}`" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200">
            <span class="material-symbols-outlined text-xl">event_note</span>
            <span class="font-['Plus_Jakarta_SANS'] text-sm leading-relaxed">Itinerary</span>
          </router-link>
          <router-link :to="`/trips/${route.params.tripId}/map`" class="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-sky-50 dark:bg-sky-900/20 text-sky-900 dark:text-sky-400 font-semibold border-r-4 border-sky-900 dark:border-sky-400 transition-all duration-200">
            <span class="material-symbols-outlined text-xl">map</span>
            <span class="font-['Plus_Jakarta_SANS'] text-sm leading-relaxed">Map</span>
          </router-link>
        </nav>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="pt-16 md:pl-64 min-h-screen flex flex-col">
      <div class="flex-1 flex flex-col md:flex-row h-[calc(100vh-64px)]">
        <!-- Left Column: Map and Header -->
        <section class="flex-1 p-6 flex flex-col gap-6 overflow-hidden relative">
          <!-- TripHeader -->
          <header class="flex flex-col md:flex-row md:items-end justify-between gap-4" v-if="trip">
            <div>
              <h1 class="font-h1 text-h1 text-primary">{{ trip.name }}</h1>
              <p class="font-body-md text-body-md text-outline">{{ trip.destination }} | {{ formatDate(trip.startDate) }} - {{ formatDate(trip.endDate) }}</p>
            </div>
          </header>

          <!-- Search Bar Above Map -->
          <div class="relative w-full max-w-2xl">
            <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">search</span>
            <input 
              ref="searchInput"
              class="w-full pl-12 pr-4 py-3 bg-white border border-outline-variant rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all font-body-md text-body-md" 
              placeholder="Search places (e.g., cafes, beaches, landmarks)" 
              type="text"
            />
          </div>

          <!-- MapContainer -->
          <div class="flex-1 bg-surface-variant/30 rounded-xl border border-outline-variant overflow-hidden relative shadow-sm min-h-[400px]">
            <div v-if="!apiKey" class="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <span class="material-symbols-outlined text-4xl text-error mb-2">map</span>
              <h3 class="text-lg font-bold text-primary">Map API Key Missing</h3>
              <p class="text-sm text-outline max-w-xs">Please ensure VITE_GOOGLE_MAPS_KEY is set in your .env file and restart the development server.</p>
            </div>
            <div ref="mapContainer" class="w-full h-full"></div>
            
            <div class="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded-full shadow-lg border border-outline-variant flex items-center gap-3">
              <div class="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
              <span class="text-xs font-semibold text-primary uppercase tracking-wider">Viewing {{ placesStore.places.length }} locations</span>
            </div>

            <!-- Slide-in Place Detail Panel -->
            <div 
              v-show="placesStore.isDetailPanelOpen && placesStore.selectedPlace"
              class="absolute bottom-4 left-4 right-4 bg-white rounded-2xl shadow-xl border border-outline-variant p-5 transition-transform duration-300 z-10 flex flex-col md:flex-row gap-6"
            >
              <button @click="placesStore.closeDetailPanel" class="absolute top-4 right-4 text-outline hover:text-primary">
                <span class="material-symbols-outlined">close</span>
              </button>
              <div class="flex-1 space-y-2" v-if="placesStore.selectedPlace">
                <div class="flex items-center gap-2">
                  <h3 class="text-h3 text-primary">{{ placesStore.selectedPlace.name }}</h3>
                  <div class="bg-surface-container px-2 py-0.5 rounded text-[10px] font-bold text-primary uppercase tracking-wider">
                    Day {{ placesStore.selectedPlace.dayNumber }}
                  </div>
                </div>
                <div class="flex items-center gap-1.5 text-outline text-sm">
                  <span class="material-symbols-outlined text-lg">location_on</span>
                  <span>{{ placesStore.selectedPlace.address }}</span>
                </div>
                <div class="mt-4">
                  <label class="block text-[11px] font-bold text-outline-variant uppercase mb-1">Notes</label>
                  <textarea 
                    v-model="noteText"
                    class="w-full p-3 rounded-lg border border-outline-variant bg-surface-container-low text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none h-20 resize-none" 
                    placeholder="Add a note for this place..."
                  ></textarea>
                  <div class="flex justify-end mt-2 gap-2">
                    <button @click="deleteSelectedPlace" class="bg-error-container text-on-error-container text-xs font-semibold px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity">Delete</button>
                    <button @click="saveNote" class="bg-primary text-white text-xs font-semibold px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity">Save note</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Right Column: ItineraryPanel -->
        <aside class="w-full md:w-[360px] bg-white border-l border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden">
          <div class="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 class="font-h2 text-h2 text-primary">Itinerary</h2>
          </div>
          <div class="flex-1 overflow-y-auto p-4 space-y-8 relative">
            <div v-if="placesStore.loading" class="absolute inset-0 bg-white/50 flex justify-center pt-8 z-10">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
            
            <div v-if="Object.keys(placesStore.placesByDay).length === 0" class="text-center text-outline-variant mt-10">
              No places added yet. Search for a place on the map to add it to your itinerary!
            </div>

            <!-- Day Group -->
            <div v-for="(dayPlaces, dayNumber) in placesStore.placesByDay" :key="dayNumber" class="space-y-3">
              <div class="flex items-center gap-2 px-2">
                <span class="text-xs font-bold text-outline-variant uppercase tracking-widest">Day {{ dayNumber }}</span>
                <div class="flex-1 h-[1px] bg-gray-100"></div>
              </div>

              <!-- Draggable List -->
              <draggable 
                :list="placesStore.placesByDay[dayNumber]" 
                group="places" 
                item-key="_id"
                handle=".drag-handle"
                @end="(evt) => onDragEnd(evt, dayNumber)"
              >
                <template #item="{ element, index }">
                  <div 
                    @click="placesStore.selectPlace(element)"
                    class="group flex items-center gap-2 p-3 mb-3 bg-white border border-outline-variant rounded-xl hover:shadow-md hover:border-primary-container transition-all cursor-pointer relative"
                    :class="{ 'border-primary shadow-md': placesStore.selectedPlace?._id === element._id }"
                  >
                    <div class="drag-handle p-1 text-outline-variant hover:text-primary">
                      <span class="material-symbols-outlined text-xl">drag_indicator</span>
                    </div>
                    <div class="relative flex-shrink-0">
                      <div class="w-12 h-12 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
                        <span class="material-symbols-outlined">location_on</span>
                      </div>
                      <div class="absolute -top-1.5 -left-1.5 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white">{{ index + 1 }}</div>
                    </div>
                    <div class="flex-1 min-w-0">
                      <h4 class="font-body-md font-bold text-on-surface truncate">{{ element.name }}</h4>
                      <div class="flex items-center gap-1 text-outline">
                        <span class="material-symbols-outlined text-xs">location_on</span>
                        <span class="text-[12px] truncate max-w-[120px]">{{ element.address }}</span>
                      </div>
                      <p class="text-[11px] text-outline-variant mt-0.5 italic truncate" v-if="element.note">{{ element.note }}</p>
                      <p class="text-[11px] text-outline-variant/60 mt-0.5 italic" v-else>Add a note...</p>
                    </div>
                    <span class="material-symbols-outlined text-outline group-hover:text-primary transition-colors">chevron_right</span>
                  </div>
                </template>
              </draggable>
            </div>
          </div>
        </aside>
      </div>
    </main>

    <!-- Day Selection Modal -->
    <div v-if="showDayModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div class="bg-white rounded-2xl p-6 shadow-xl w-full max-w-sm">
        <h3 class="text-h3 text-primary mb-4">Add to Itinerary</h3>
        <p class="text-sm text-outline mb-4">Which day do you want to add <strong>{{ pendingPlace?.name }}</strong> to?</p>
        <select v-model="selectedDay" class="w-full p-3 border border-outline-variant rounded-xl mb-6 focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option v-for="d in tripDaysCount" :key="d" :value="d">Day {{ d }}</option>
        </select>
        <div class="flex justify-end gap-3">
          <button @click="showDayModal = false" class="px-4 py-2 text-outline font-semibold hover:bg-gray-50 rounded-lg">Cancel</button>
          <button @click="confirmAddPlace" class="px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:opacity-90">Add Place</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { usePlacesStore } from '../stores/places';
import api from '../api';
import draggable from 'vuedraggable';
import { Loader } from '@googlemaps/js-api-loader';

const route = useRoute();
const tripId = route.params.tripId;
const placesStore = usePlacesStore();

const trip = ref(null);
const searchInput = ref(null);
const mapContainer = ref(null);

// Modal state
const showDayModal = ref(false);
const pendingPlace = ref(null);
const selectedDay = ref(1);

const noteText = ref('');
const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;
let map = null;
let loader = null;
let markers = [];

const tripDaysCount = computed(() => {
  if (!trip.value) return 7; // Default 7 days
  const start = new Date(trip.value.startDate);
  const end = new Date(trip.value.endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays > 0 ? diffDays : 1;
});

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Map & Autocomplete initialization
const initMap = async () => {
  if (!apiKey) {
    console.error("Google Maps API Key is missing. Check your .env file.");
    return;
  }

  try {
    loader = new Loader({
      apiKey: apiKey,
      version: "weekly",
      libraries: ["places"]
    });

    const [{ Map }, { Autocomplete }] = await Promise.all([
      loader.importLibrary("maps"),
      loader.importLibrary("places")
    ]);

    // Default center
    const defaultCenter = { lat: 15.2993, lng: 74.1240 }; // Goa
    
    map = new Map(mapContainer.value, {
      center: defaultCenter,
      zoom: 10,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      mapId: 'TRAVEL_SYNC_MAP' // Optional: needed for advanced markers
    });

    // Init autocomplete
    const autocomplete = new Autocomplete(searchInput.value, {
      fields: ["name", "formatted_address", "geometry"]
    });

    autocomplete.bindTo("bounds", map);

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry || !place.geometry.location) {
        alert("No details available for input: '" + place.name + "'");
        return;
      }

      pendingPlace.value = {
        name: place.name,
        address: place.formatted_address || place.name,
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng()
      };
      
      selectedDay.value = 1;
      showDayModal.value = true;
      searchInput.value.value = ''; // clear input
    });
  } catch (error) {
    console.error("Failed to initialize Google Maps:", error);
  }
};

const updateMarkers = async () => {
  if (!map || !loader) return;
  
  try {
    const { Marker } = await loader.importLibrary("marker");
    
    // Clear old markers
    markers.forEach(m => m.setMap(null));
    markers = [];
    
    const bounds = new window.google.maps.LatLngBounds();
    let hasPlaces = false;

    placesStore.places.forEach((place, index) => {
      const marker = new Marker({
        position: { lat: place.lat, lng: place.lng },
        map,
        title: place.name,
        label: {
          text: String(index + 1),
          color: "white"
        }
      });
      
      marker.addListener("click", () => {
        placesStore.selectPlace(place);
      });

      markers.push(marker);
      bounds.extend({ lat: place.lat, lng: place.lng });
      hasPlaces = true;
    });

    if (hasPlaces) {
      map.fitBounds(bounds);
      // Adjust zoom if too close
      const listener = window.google.maps.event.addListener(map, "idle", function() { 
        if (map.getZoom() > 15) map.setZoom(15); 
        window.google.maps.event.removeListener(listener); 
      });
    }
  } catch (error) {
    console.error("Failed to update markers:", error);
  }
};

watch(() => placesStore.places, () => {
  updateMarkers();
}, { deep: true });

watch(() => placesStore.selectedPlace, (newPlace) => {
  if (newPlace) {
    noteText.value = newPlace.note || '';
    if (map) {
      map.panTo({ lat: newPlace.lat, lng: newPlace.lng });
      map.setZoom(15);
    }
  }
});

const confirmAddPlace = async () => {
  if (!pendingPlace.value) return;
  
  const dayPlaces = placesStore.placesByDay[selectedDay.value] || [];
  const nextOrderIndex = dayPlaces.length;

  try {
    await placesStore.addPlace(tripId, {
      ...pendingPlace.value,
      dayNumber: selectedDay.value,
      orderIndex: nextOrderIndex
    });
    showDayModal.value = false;
    pendingPlace.value = null;
  } catch (err) {
    alert("Failed to add place");
  }
};

const saveNote = async () => {
  if (!placesStore.selectedPlace) return;
  try {
    await placesStore.updateNote(tripId, placesStore.selectedPlace._id, noteText.value);
  } catch (err) {
    alert("Failed to save note");
  }
};

const deleteSelectedPlace = async () => {
  if (!placesStore.selectedPlace) return;
  if(confirm('Are you sure you want to remove this place?')) {
    try {
      await placesStore.deletePlace(tripId, placesStore.selectedPlace._id);
    } catch (err) {
      alert("Failed to delete place");
    }
  }
};

const onDragEnd = async (evt, dayNumber) => {
  // Re-calculate orderIndex for all items in this day
  const dayPlacesList = placesStore.placesByDay[dayNumber];
  
  if (!dayPlacesList) return;

  const updates = dayPlacesList.map((place, index) => ({
    placeId: place._id,
    dayNumber: parseInt(dayNumber),
    orderIndex: index
  }));

  try {
    await placesStore.reorderPlaces(tripId, updates);
  } catch (err) {
    alert("Failed to reorder places");
  }
};

onMounted(async () => {
  // Fetch trip
  try {
    const res = await api.get(`/trips/${tripId}`);
    trip.value = res.data;
  } catch (err) {
    console.error("Failed to fetch trip", err);
  }

  // Fetch places
  await placesStore.fetchPlaces(tripId);

  // Initialize Map
  await initMap();
  
  // Set initial markers
  updateMarkers();
});

</script>

<style scoped>
.drag-handle {
  cursor: grab;
}
.drag-handle:active {
  cursor: grabbing;
}
</style>
