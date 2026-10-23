<template>
  <div v-if="!isAuthPage">
    <!-- Floating Action Toggle Button -->
    <button
      v-if="!isOpen"
      @click="toggleChat"
      id="travel-chatbot-toggle-btn"
      class="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 bg-[#1C1D1A] dark:bg-[#FAF9F5] text-[#FAF9F5] dark:text-[#1C1D1A] rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 border border-black/10 dark:border-white/20 group"
      aria-label="Open Travel Recommendation Assistant"
    >
      <span class="relative flex h-3 w-3">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
      </span>
      <span class="material-symbols-outlined text-xl group-hover:rotate-12 transition-transform">travel_explore</span>
      <span class="text-xs font-semibold tracking-wide">AI Travel Guide</span>
    </button>

    <!-- Floating Chat Window -->
    <div
      v-if="isOpen"
      id="travel-chatbot-window"
      class="fixed bottom-6 right-6 z-40 w-[420px] max-w-[calc(100vw-2rem)] h-[620px] max-h-[85vh] bg-[#FAF9F5] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-up"
      role="dialog"
      aria-modal="true"
    >
      <!-- Chat Header -->
      <div class="h-16 px-4 bg-[#F0EEE9] dark:bg-[#141512] border-b border-[#E3E0D8] dark:border-[#30312C] flex items-center justify-between flex-shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-[#1C1D1A] dark:bg-[#FAF9F5] text-[#FAF9F5] dark:text-[#1C1D1A] flex items-center justify-center shadow-sm">
            <span class="material-symbols-outlined text-lg">auto_awesome</span>
          </div>
          <div>
            <h3 class="text-sm font-bold text-[#1C1D1A] dark:text-[#D5D3CA] flex items-center gap-1.5">
              TravelSync AI Guide
              <span class="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 rounded">
                ML Recommender
              </span>
            </h3>
            <p class="text-[11px] text-[#7E8075] dark:text-[#85867C]">Grounded destination recommendations</p>
          </div>
        </div>

        <div class="flex items-center gap-1">
          <button
            @click="resetChat"
            id="travel-chatbot-reset-btn"
            title="Reset conversation"
            aria-label="Reset conversation"
            class="p-1.5 text-[#7E8075] dark:text-[#85867C] hover:text-[#1C1D1A] dark:hover:text-[#D5D3CA] hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
          >
            <span class="material-symbols-outlined text-[18px]">refresh</span>
          </button>
          <button
            @click="toggleChat"
            id="travel-chatbot-close-btn"
            title="Minimize"
            aria-label="Close"
            class="p-1.5 text-[#7E8075] dark:text-[#85867C] hover:text-[#1C1D1A] dark:hover:text-[#D5D3CA] hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
          >
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
      </div>

      <!-- Messages Body -->
      <div ref="chatContainer" class="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FAF9F5] dark:bg-[#111210]">
        <!-- Welcome Prompt -->
        <div class="flex gap-2.5 items-start">
          <div class="w-7 h-7 rounded-lg bg-[#E3E0D8] dark:bg-[#30312C] text-[#1C1D1A] dark:text-[#D5D3CA] flex items-center justify-center flex-shrink-0 mt-0.5">
            <span class="material-symbols-outlined text-sm">smart_toy</span>
          </div>
          <div class="flex-1 space-y-2">
            <div class="p-3 bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-2xl rounded-tl-sm text-xs text-[#1C1D1A] dark:text-[#D5D3CA] leading-relaxed shadow-sm">
              <p class="font-medium mb-1">Welcome to TravelSync!</p>
              <p>Tell me what kind of journey you have in mind (e.g. <em>"Relaxing beach vacation for a couple in India on a moderate budget for 5 days"</em>), and I'll find the best matching destinations with grounded explanations.</p>
            </div>

            <!-- Quick Suggestions -->
            <div v-if="messages.length === 0" class="space-y-1.5 pt-1">
              <p class="text-[10px] font-semibold uppercase tracking-wider text-[#7E8075] dark:text-[#85867C]">Quick Prompts</p>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="(prompt, idx) in samplePrompts"
                  :key="idx"
                  @click="sendQuickPrompt(prompt)"
                  class="text-[11px] px-2.5 py-1 bg-[#FFFFFF] dark:bg-[#1B1C19] hover:bg-[#EAE7DF] dark:hover:bg-[#252622] border border-[#E3E0D8] dark:border-[#30312C] text-[#1C1D1A] dark:text-[#D5D3CA] rounded-full transition-colors text-left"
                >
                  {{ prompt }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Render Conversation Messages -->
        <template v-for="(msg, index) in messages" :key="index">
          <!-- User Message -->
          <div v-if="msg.sender === 'user'" class="flex justify-end">
            <div class="max-w-[85%] p-3 bg-[#1C1D1A] dark:bg-[#FAF9F5] text-[#FAF9F5] dark:text-[#1C1D1A] rounded-2xl rounded-tr-sm text-xs leading-relaxed shadow-sm">
              {{ msg.text }}
            </div>
          </div>

          <!-- Bot Message -->
          <div v-else class="flex gap-2.5 items-start">
            <div class="w-7 h-7 rounded-lg bg-[#E3E0D8] dark:bg-[#30312C] text-[#1C1D1A] dark:text-[#D5D3CA] flex items-center justify-center flex-shrink-0 mt-0.5">
              <span class="material-symbols-outlined text-sm">auto_awesome</span>
            </div>
            <div class="flex-1 space-y-2.5 max-w-[90%]">
              <!-- Text content -->
              <div class="p-3 bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-2xl rounded-tl-sm text-xs text-[#1C1D1A] dark:text-[#D5D3CA] leading-relaxed shadow-sm">
                {{ msg.text }}
              </div>

              <!-- Follow-up Questions / Options -->
              <div v-if="msg.structuredFollowUps && msg.structuredFollowUps.length > 0" class="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2">
                <div class="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-semibold text-[11px]">
                  <span class="material-symbols-outlined text-sm">tune</span>
                  <span>Refine your preferences:</span>
                </div>
                <div v-for="(q, qIdx) in msg.structuredFollowUps" :key="qIdx" class="space-y-1.5">
                  <p class="text-[11px] text-amber-900 dark:text-amber-200 font-medium">{{ decodeHtml(q.question) }}</p>
                  <div class="flex flex-wrap gap-1.5">
                    <button
                      v-for="(opt, optIdx) in q.options"
                      :key="optIdx"
                      @click="selectOption(q.field, opt)"
                      class="follow-up-option-btn text-[11px] px-2.5 py-1 bg-[#FFFFFF] dark:bg-[#1B1C19] hover:bg-amber-100 dark:hover:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-200 rounded-full transition-all font-medium shadow-xs hover:scale-105 active:scale-95"
                    >
                      {{ decodeHtml(opt.label) }}
                    </button>
                  </div>
                </div>
              </div>

              <!-- Fallback plain text follow-ups if structured not provided -->
              <div v-else-if="msg.followUps && msg.followUps.length > 0" class="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1.5">
                <div class="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-semibold text-[11px]">
                  <span class="material-symbols-outlined text-sm">help_outline</span>
                  <span>Help me narrow this down:</span>
                </div>
                <div class="flex flex-col gap-1">
                  <button
                    v-for="(q, qIdx) in msg.followUps"
                    :key="qIdx"
                    @click="answerFollowUp(q)"
                    class="text-left text-[11px] text-amber-800 dark:text-amber-200 hover:underline cursor-pointer"
                  >
                    • {{ decodeHtml(q) }}
                  </button>
                </div>
              </div>

              <!-- Recommendation Cards -->
              <div v-if="msg.recommendations && msg.recommendations.length > 0" class="space-y-3 pt-1">
                <div
                  v-for="rec in msg.recommendations"
                  :key="rec.destination_id"
                  class="bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-xl p-3 shadow-sm hover:border-[#A7A99A] transition-all space-y-2.5"
                >
                  <!-- Card Header -->
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="text-xs font-bold text-[#1C1D1A] dark:text-[#D5D3CA]">
                          #{{ rec.rank }} {{ decodeHtml(rec.destination) }}
                        </span>
                        <span class="text-[10px] px-1.5 py-0.2 bg-[#EAE7DF] dark:bg-[#252622] text-[#575851] dark:text-[#85867C] rounded">
                          {{ decodeHtml(rec.country) }}
                        </span>
                        <span v-if="rec.is_alternative" class="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-semibold rounded border border-amber-300 dark:border-amber-700">
                          Higher-Budget Alternative
                        </span>
                      </div>
                      <p class="text-[10px] text-[#7E8075] dark:text-[#85867C] mt-0.5">
                        {{ decodeHtml(rec.subregion) }} • {{ decodeHtml(rec.suggested_duration) }}
                      </p>
                    </div>

                    <div class="text-right flex-shrink-0">
                      <span class="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-extrabold text-[11px] rounded-full">
                        {{ rec.match_score }}% match
                      </span>
                    </div>
                  </div>

                  <!-- Badges / Budget -->
                  <div class="flex flex-wrap gap-1.5 text-[10px]">
                    <span class="px-2 py-0.5 bg-[#F5F4EE] dark:bg-[#141512] border border-[#E3E0D8] dark:border-[#30312C] rounded text-[#1C1D1A] dark:text-[#D5D3CA] font-medium">
                      💰 {{ rec.currency || 'USD' }} {{ rec.estimated_daily_cost != null ? Number(rec.estimated_daily_cost).toLocaleString() : 'N/A' }}/day (~${{ rec.estimated_daily_cost_usd != null ? rec.estimated_daily_cost_usd : 'N/A' }} USD)
                    </span>
                    <span v-if="Array.isArray(rec.best_seasons) && rec.best_seasons.length > 0" class="px-2 py-0.5 bg-[#F5F4EE] dark:bg-[#141512] border border-[#E3E0D8] dark:border-[#30312C] rounded text-[#1C1D1A] dark:text-[#D5D3CA]">
                      ☀️ Best: {{ rec.best_seasons.join(', ') }}
                    </span>
                    <span v-if="Array.isArray(rec.suitable_companions) && rec.suitable_companions.length > 0" class="px-2 py-0.5 bg-[#F5F4EE] dark:bg-[#141512] border border-[#E3E0D8] dark:border-[#30312C] rounded text-[#1C1D1A] dark:text-[#D5D3CA]">
                      👥 {{ rec.suitable_companions.join(', ') }}
                    </span>
                  </div>

                  <!-- Grounded Explanation -->
                  <div class="bg-[#F7F6F2] dark:bg-[#141512] rounded-lg p-2.5 text-[11px] space-y-1.5 border border-[#EAE7DF] dark:border-[#22231F]">
                    <div>
                      <span class="font-semibold text-emerald-700 dark:text-emerald-400">Why it fits: </span>
                      <span class="text-[#3C3D37] dark:text-[#D5D3CA]">{{ decodeHtml(rec.explanation) }}</span>
                    </div>
                    <div v-if="rec.trade_offs && rec.trade_offs !== 'None notable.'">
                      <span class="font-semibold text-amber-700 dark:text-amber-400">Trade-offs: </span>
                      <span class="text-[#7E8075] dark:text-[#85867C]">{{ decodeHtml(rec.trade_offs) }}</span>
                    </div>
                  </div>

                  <!-- Action Buttons -->
                  <div class="flex items-center justify-between pt-1">
                    <span class="text-[10px] text-[#7E8075] dark:text-[#85867C] truncate max-w-[210px]" :title="decodeHtml(rec.suitable_activities)">
                      🎯 {{ decodeHtml(rec.suitable_activities) }}
                    </span>
                    <button
                      @click="planTripToDestination(rec.destination)"
                      class="text-[11px] px-2.5 py-1 bg-[#1C1D1A] dark:bg-[#FAF9F5] text-[#FAF9F5] dark:text-[#1C1D1A] hover:opacity-90 rounded-lg font-medium transition-opacity flex items-center gap-1 shadow-sm"
                    >
                      <span>Plan Trip</span>
                      <span class="material-symbols-outlined text-[12px]">arrow_forward</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- Loading Indicator -->
        <div v-if="loading" class="flex gap-2.5 items-center text-xs text-[#7E8075] dark:text-[#85867C] pl-9">
          <span class="material-symbols-outlined animate-spin text-sm">progress_activity</span>
          <span>Analyzing notebook recommendation model...</span>
        </div>
      </div>

      <!-- Chat Input Area -->
      <div class="p-3 bg-[#F0EEE9] dark:bg-[#141512] border-t border-[#E3E0D8] dark:border-[#30312C] flex-shrink-0">
        <form @submit.prevent="sendMessage" class="flex items-center gap-2">
          <input
            v-model="inputQuery"
            type="text"
            id="travel-chatbot-input"
            placeholder="E.g. 5 days beach trip in India on moderate budget..."
            :disabled="loading"
            class="flex-1 px-3.5 py-2.5 bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#D1CEC7] dark:border-[#30312C] rounded-xl text-xs text-[#1C1D1A] dark:text-[#D5D3CA] placeholder-[#7E8075] dark:placeholder-[#85867C] outline-none focus:border-[#A7A99A] transition-colors"
          />
          <button
            type="submit"
            :disabled="loading || !inputQuery.trim()"
            id="travel-chatbot-send-btn"
            class="p-2.5 bg-[#1C1D1A] dark:bg-[#FAF9F5] text-[#FAF9F5] dark:text-[#1C1D1A] disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all flex items-center justify-center shadow-sm"
            title="Send Message"
          >
            <span class="material-symbols-outlined text-sm">send</span>
          </button>
        </form>
      </div>
    </div>

    <!-- Create Trip Modal triggered from Chatbot Recommendation -->
    <CreateTripModal
      v-model:isOpen="showCreateTripModal"
      :initialDestination="selectedDestination"
      @trip-created="onTripCreated"
    />
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import api from '../api';
import { useAuthStore } from '../stores/auth';
import { useToastStore } from '../stores/toast';
import { decodeHtml } from '../utils/format';
import CreateTripModal from './CreateTripModal.vue';

const router = useRouter();
let route = null;
try {
  route = useRoute();
} catch {}

const authStore = useAuthStore();
const toastStore = useToastStore();

const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/verify-email'];
const isAuthPage = computed(() => {
  if (!route || !route.path) return false;
  return AUTH_PAGES.includes(route.path);
});

const isOpen = ref(false);
const loading = ref(false);
const inputQuery = ref('');
const messages = ref([]);
const previousPreferences = ref(null);
const chatContainer = ref(null);
const showCreateTripModal = ref(false);
const selectedDestination = ref('');

const samplePrompts = [
  '🏖️ Relaxing beach in India for a couple',
  '🏔️ Mountain adventure in Europe for 7 days',
  '🏰 Cultural heritage trip with family on budget',
  '🐘 Wildlife safari with friends in autumn'
];

const toggleChat = () => {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    scrollToBottom();
  }
};

const scrollToBottom = async () => {
  await nextTick();
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
};

const resetChat = () => {
  messages.value = [];
  previousPreferences.value = null;
  inputQuery.value = '';
};

const sendQuickPrompt = (prompt) => {
  inputQuery.value = prompt;
  sendMessage();
};

const answerFollowUp = (question) => {
  // Clean question prompt without poisoning user's query
  const cleanPrompt = question.replace(/^Are you looking for\s+/i, '').replace(/\?+$/, '');
  inputQuery.value = cleanPrompt;
};

let activeRequestId = 0;

const selectOption = async (field, opt) => {
  if (loading.value) return;

  const currentReqId = ++activeRequestId;
  const userLabel = opt.label;
  messages.value.push({
    sender: 'user',
    text: userLabel
  });
  loading.value = true;
  scrollToBottom();

  try {
    const directUpdate = { [field]: opt.value };
    const res = await api.post('/recommendations/chat', {
      message: userLabel,
      previous_preferences: previousPreferences.value,
      direct_preference_update: directUpdate
    }, {
      skipAuthRedirect: true,
      skipErrorToast: true
    });

    if (currentReqId !== activeRequestId) return; // Stale response discarded

    const data = res.data;
    if (data.extracted_preferences) {
      previousPreferences.value = data.extracted_preferences;
    }

    messages.value.push({
      sender: 'bot',
      text: decodeHtml(data.message),
      followUps: data.follow_up_questions || [],
      structuredFollowUps: data.structured_follow_ups || [],
      recommendations: data.recommendations || []
    });
  } catch (err) {
    if (currentReqId === activeRequestId) {
      handleChatError(err);
    }
  } finally {
    if (currentReqId === activeRequestId) {
      loading.value = false;
      scrollToBottom();
    }
  }
};

const planTripToDestination = (destinationName) => {
  if (!authStore.isAuthenticated) {
    toastStore.showToast('Please sign in to plan and save your trip.', 'info');
    router.push({ path: '/login', query: { redirect: `/dashboard?create=1&dest=${encodeURIComponent(destinationName)}` } });
    return;
  }
  selectedDestination.value = destinationName;
  showCreateTripModal.value = true;
  isOpen.value = false;
};

const onTripCreated = (trip) => {
  const tripId = trip?.id || trip?._id;
  toastStore.showToast(`Trip to ${trip?.destination || selectedDestination.value} created! Let's build your itinerary.`, 'success');
  if (tripId) {
    router.push(`/trips/${tripId}`);
  } else {
    router.push('/dashboard');
  }
};

const handleChatError = (err) => {
  console.error('Failed to get recommendation:', err);
  const status = err.response?.status;
  let errorMsg = 'Failed to fetch recommendations. Please try again.';

  if (status === 401) {
    errorMsg = 'Please sign in to your TravelSync account to receive personalized AI recommendations!';
  } else if (status === 429) {
    errorMsg = 'You are sending requests too quickly. Please wait a moment before asking again.';
  } else if (status === 504) {
    errorMsg = 'The recommendation request timed out. Please try again.';
  } else if (status === 502) {
    errorMsg = 'The recommendation engine is currently starting up or offline. Please ensure the ML service is running.';
  } else if (err.response?.data?.message) {
    errorMsg = err.response.data.message;
  }

  messages.value.push({
    sender: 'bot',
    text: errorMsg,
    recommendations: []
  });
};

const sendMessage = async () => {
  const query = inputQuery.value.trim();
  if (!query || loading.value) return;

  const currentReqId = ++activeRequestId;

  // Add user message
  messages.value.push({
    sender: 'user',
    text: query
  });
  inputQuery.value = '';
  loading.value = true;
  scrollToBottom();

  try {
    const res = await api.post('/recommendations/chat', {
      message: query,
      previous_preferences: previousPreferences.value
    }, {
      skipAuthRedirect: true,
      skipErrorToast: true
    });

    if (currentReqId !== activeRequestId) return; // Stale response discarded

    const data = res.data;
    if (data.extracted_preferences) {
      previousPreferences.value = data.extracted_preferences;
    }

    messages.value.push({
      sender: 'bot',
      text: decodeHtml(data.message),
      followUps: data.follow_up_questions || [],
      structuredFollowUps: data.structured_follow_ups || [],
      recommendations: data.recommendations || []
    });
  } catch (err) {
    if (currentReqId === activeRequestId) {
      handleChatError(err);
    }
  } finally {
    if (currentReqId === activeRequestId) {
      loading.value = false;
      scrollToBottom();
    }
  }
};
</script>

