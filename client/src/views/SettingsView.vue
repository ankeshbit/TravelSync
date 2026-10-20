<template>
  <AppLayout>
      <!-- Header -->
      <header class="mb-8">
        <h1 class="text-2xl sm:text-3xl font-extrabold text-[#1C1D1A] dark:text-[#D5D3CA] tracking-tight">Settings</h1>
        <p class="text-xs sm:text-sm text-[#575851] dark:text-[#A5A69B] mt-1">Manage your profile and account preferences.</p>
      </header>

      <!-- Settings Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        
        <!-- Left Sub-Tabs Navigation -->
        <nav class="lg:col-span-3 min-w-0 flex flex-row overflow-x-auto pb-2 lg:pb-0 lg:flex-col gap-1.5 scrollbar-thin">
          <button
            v-for="tab in settingsTabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            :class="activeTab === tab.id 
              ? 'bg-[#FFFFFF] dark:bg-[#292A25] text-[#1C1D1A] dark:text-[#D5D3CA] border border-[#D1CEC4] dark:border-[#414239] shadow-sm font-semibold' 
              : 'text-[#575851] dark:text-[#A5A69B] hover:text-[#1C1D1A] dark:hover:text-[#D5D3CA] hover:bg-[#F0EEE9] dark:hover:bg-[#22231F] font-medium border border-transparent'"
            class="px-4 py-2.5 rounded-xl flex items-center gap-3 text-sm transition-all duration-200 text-left whitespace-nowrap flex-shrink-0"
          >
            <span class="material-symbols-outlined text-[20px]">{{ tab.icon }}</span>
            <span>{{ tab.label }}</span>
          </button>
        </nav>

        <!-- Right Content Card -->
        <section class="lg:col-span-9 min-w-0 bg-[#FFFFFF] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-3xl p-6 sm:p-8 md:p-10 shadow-sm">
          
          <!-- TAB 1: PROFILE INFORMATION -->
          <div v-if="activeTab === 'profile'">
            <div class="mb-6">
              <h2 class="text-lg font-bold text-[#1C1D1A] dark:text-[#D5D3CA] tracking-tight">Profile Information</h2>
              <p class="text-xs text-[#575851] dark:text-[#A5A69B] mt-1">Update your personal information</p>
            </div>

            <!-- Profile Photo Upload -->
            <div class="flex flex-col sm:flex-row sm:items-center gap-6 p-6 rounded-2xl bg-[#F7F6F2] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] mb-8">
              <div class="relative w-16 h-16 rounded-full bg-[#4A4D40] dark:bg-[#292A25] text-[#D5D3CA] border border-[#414239] flex items-center justify-center font-bold text-xl flex-shrink-0 shadow-sm">
                <img 
                  v-if="profilePicture" 
                  :src="profilePicture" 
                  alt="Profile" 
                  class="w-full h-full object-cover rounded-full" 
                />
                <span v-else>{{ userInitials }}</span>
                
                <button 
                  @click="triggerPhotoSelect" 
                  class="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#141512] border border-[#30312C] text-[#D5D3CA] hover:text-white flex items-center justify-center shadow"
                  title="Change photo"
                >
                  <span class="material-symbols-outlined text-[13px]">photo_camera</span>
                </button>
                <input ref="photoInput" type="file" accept="image/*" class="hidden" @change="handlePhotoUpload" />
              </div>

              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-semibold text-[#1C1D1A] dark:text-[#D5D3CA]">Profile Photo</h4>
                <p class="text-xs text-[#575851] dark:text-[#A5A69B] mt-1">Upload a profile picture (PNG or JPEG, max 5MB)</p>
              </div>

              <button 
                @click="triggerPhotoSelect" 
                type="button" 
                :disabled="loadingPhoto"
                class="px-4 py-2.5 border border-[#E3E0D8] dark:border-[#30312C] hover:border-[#D1CEC4] dark:hover:border-[#414239] bg-[#FFFFFF] dark:bg-[#292A25] hover:bg-[#F0EEE9] dark:hover:bg-[#30312C] text-xs font-semibold text-[#1C1D1A] dark:text-[#D5D3CA] rounded-xl transition-all flex items-center gap-2 self-start sm:self-auto shadow-sm"
              >
                <span v-if="loadingPhoto" class="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                <span v-else class="material-symbols-outlined text-[16px]">upload</span>
                <span>Upload Photo</span>
              </button>
            </div>

            <!-- Profile Inputs Form -->
            <form @submit.prevent="handleProfileUpdate" class="space-y-6">
              <!-- Full Name -->
              <div>
                <label class="block text-xs font-semibold text-[#1C1D1A] dark:text-[#D5D3CA] mb-2.5">Full Name</label>
                <input 
                  v-model="profileForm.name"
                  type="text" 
                  required
                  placeholder="e.g. Rajnish Srivastava"
                  class="w-full bg-[#F7F6F2] dark:bg-[#141512] border border-[#E3E0D8] dark:border-[#30312C] text-sm text-[#1C1D1A] dark:text-[#D5D3CA] placeholder-[#7E8075] dark:placeholder-[#85867C] px-4 py-3 rounded-xl focus:outline-none focus:border-[#A7A99A] focus:ring-1 focus:ring-[#A7A99A]/30 transition-all shadow-sm"
                />
              </div>

              <!-- Email -->
              <div>
                <label class="block text-xs font-semibold text-[#1C1D1A] dark:text-[#D5D3CA] mb-2.5">Email Address</label>
                <div class="relative">
                  <input 
                    v-model="profileForm.email"
                    type="email" 
                    disabled
                    class="w-full bg-[#EFECE6] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] text-sm text-[#7E8075] dark:text-[#85867C] px-4 py-3 rounded-xl cursor-not-allowed opacity-90 shadow-sm"
                  />
                  <span class="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-[#86A98B] font-medium">Verified (Firebase)</span>
                </div>
                <p class="text-[11px] text-[#7E8075] dark:text-[#85867C] mt-1.5">Primary email is managed by your authentication provider.</p>
              </div>

              <!-- Member Since -->
              <div v-if="memberSince">
                <label class="block text-xs font-semibold text-[#1C1D1A] dark:text-[#D5D3CA] mb-2.5">Member Since</label>
                <div class="flex items-center gap-2.5 text-sm text-[#1C1D1A] dark:text-[#D5D3CA] bg-[#F7F6F2] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] px-4 py-3 rounded-xl shadow-sm">
                  <span class="material-symbols-outlined text-[18px] text-[#A7A99A]">calendar_month</span>
                  <span>{{ memberSinceFormatted }}</span>
                </div>
              </div>

              <!-- Save Changes Button -->
              <div class="pt-3">
                <button 
                  type="submit" 
                  :disabled="loadingProfile"
                  class="bg-[#A7A99A] hover:bg-[#B9BBAA] disabled:opacity-50 text-[#171813] text-sm font-semibold px-6 py-3 rounded-xl shadow-sm border border-[#A7A99A]/40 active:scale-95 transition-all flex items-center gap-2"
                >
                  <span v-if="loadingProfile" class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                  <span v-else class="material-symbols-outlined text-[18px]">save</span>
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>

          <!-- TAB 2: SECURITY -->
          <div v-else-if="activeTab === 'security'" class="space-y-6">
            <div>
              <h2 class="text-lg font-bold text-[#1C1D1A] dark:text-[#D5D3CA] tracking-tight">Security & Authentication</h2>
              <p class="text-xs text-[#575851] dark:text-[#A5A69B] mt-0.5">Manage password and account protection</p>
            </div>

            <!-- Google OAuth Status -->
            <div class="p-6 rounded-2xl bg-[#F7F6F2] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow flex-shrink-0">
                  <svg class="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                </div>
                <div>
                  <h4 class="text-sm font-semibold text-[#1C1D1A] dark:text-[#D5D3CA]">Google Account Sign-In</h4>
                  <p class="text-xs text-[#575851] dark:text-[#A5A69B] mt-0.5">Connected for fast, secure authentication</p>
                </div>
              </div>
              <span class="text-xs font-semibold px-3 py-1 rounded-full bg-[#86A98B]/20 text-[#86A98B] border border-[#86A98B]/30">
                Active
              </span>
            </div>

            <!-- Password Reset -->
            <div class="p-6 rounded-2xl bg-[#F7F6F2] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-xl bg-[#EFECE6] dark:bg-[#292A25] border border-[#E3E0D8] dark:border-[#30312C] flex items-center justify-center text-[#575851] dark:text-[#D5D3CA] flex-shrink-0">
                  <span class="material-symbols-outlined text-[20px]">lock_reset</span>
                </div>
                <div>
                  <h4 class="text-sm font-semibold text-[#1C1D1A] dark:text-[#D5D3CA]">Password Recovery</h4>
                  <p class="text-xs text-[#575851] dark:text-[#A5A69B] mt-0.5">Send a password reset email to {{ profileForm.email }}</p>
                </div>
              </div>
              <button 
                @click="sendPasswordReset"
                type="button" 
                class="px-4 py-2.5 border border-[#E3E0D8] dark:border-[#30312C] hover:border-[#D1CEC4] dark:hover:border-[#414239] bg-[#FFFFFF] dark:bg-[#292A25] hover:bg-[#F0EEE9] dark:hover:bg-[#30312C] text-xs font-semibold text-[#1C1D1A] dark:text-[#D5D3CA] rounded-xl transition-all shadow-sm"
              >
                Send Reset Link
              </button>
            </div>
          </div>

          <!-- TAB 3: PREFERENCES -->
          <div v-else-if="activeTab === 'preferences'" class="space-y-6">
            <div>
              <h2 class="text-lg font-bold text-[#1C1D1A] dark:text-[#D5D3CA] tracking-tight">Preferences</h2>
              <p class="text-xs text-[#575851] dark:text-[#A5A69B] mt-1">Customize your travel and interface appearance</p>
            </div>

            <div class="space-y-4">
              <!-- Theme -->
              <div class="p-6 rounded-2xl bg-[#F7F6F2] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                <div class="flex items-center gap-4">
                  <div class="w-10 h-10 rounded-xl bg-[#EFECE6] dark:bg-[#292A25] text-[#575851] dark:text-[#D5D3CA] flex items-center justify-center flex-shrink-0">
                    <span class="material-symbols-outlined text-[20px]">palette</span>
                  </div>
                  <div>
                    <h4 class="text-sm font-semibold text-[#1C1D1A] dark:text-[#D5D3CA]">Theme Preference</h4>
                    <p class="text-xs text-[#575851] dark:text-[#A5A69B] mt-0.5">Switch between light and dark visual modes</p>
                  </div>
                </div>
                <ThemeToggle />
              </div>

              <!-- Default Currency -->
              <div class="p-6 rounded-2xl bg-[#F7F6F2] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                <div class="flex items-center gap-4">
                  <div class="w-10 h-10 rounded-xl bg-[#EFECE6] dark:bg-[#292A25] text-[#575851] dark:text-[#D5D3CA] flex items-center justify-center flex-shrink-0">
                    <span class="material-symbols-outlined text-[20px]">attach_money</span>
                  </div>
                  <div>
                    <h4 class="text-sm font-semibold text-[#1C1D1A] dark:text-[#D5D3CA]">Default Currencies</h4>
                    <p class="text-xs text-[#575851] dark:text-[#A5A69B] mt-0.5">Standard currencies supported across trips</p>
                  </div>
                </div>
                <span class="text-xs font-semibold px-3.5 py-2 rounded-xl bg-[#FFFFFF] dark:bg-[#292A25] border border-[#E3E0D8] dark:border-[#30312C] text-[#1C1D1A] dark:text-[#D5D3CA] self-start sm:self-auto shadow-sm">
                  USD ($) · EUR (€) · INR (₹)
                </span>
              </div>
            </div>
          </div>

          <!-- TAB 4: NOTIFICATIONS -->
          <div v-else-if="activeTab === 'notifications'" class="space-y-6">
            <div>
              <h2 class="text-lg font-bold text-[#1C1D1A] dark:text-[#D5D3CA] tracking-tight">Notification Settings</h2>
              <p class="text-xs text-[#575851] dark:text-[#A5A69B] mt-1">Control how and when you receive updates about your trips</p>
            </div>

            <div class="space-y-4">
              <!-- Trip Invites & Updates -->
              <div class="p-6 rounded-2xl bg-[#F7F6F2] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] flex items-center justify-between gap-5">
                <div class="flex items-center gap-4">
                  <div class="w-10 h-10 rounded-xl bg-[#EFECE6] dark:bg-[#292A25] text-[#575851] dark:text-[#D5D3CA] flex items-center justify-center flex-shrink-0">
                    <span class="material-symbols-outlined text-[20px]">mark_email_unread</span>
                  </div>
                  <div>
                    <h4 class="text-sm font-semibold text-[#1C1D1A] dark:text-[#D5D3CA]">Trip Invitations & Changes</h4>
                    <p class="text-xs text-[#575851] dark:text-[#A5A69B] mt-0.5">Receive notifications when you are invited to trips or itinerary is modified</p>
                  </div>
                </div>
                <label class="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input type="checkbox" v-model="notificationsForm.tripUpdates" class="sr-only peer">
                  <div class="w-11 h-6 bg-[#E3E0D8] peer-focus:outline-none rounded-full peer dark:bg-[#30312C] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#A7A99A]"></div>
                </label>
              </div>

              <!-- Expenses & Settlements -->
              <div class="p-6 rounded-2xl bg-[#F7F6F2] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] flex items-center justify-between gap-5">
                <div class="flex items-center gap-4">
                  <div class="w-10 h-10 rounded-xl bg-[#EFECE6] dark:bg-[#292A25] text-[#575851] dark:text-[#D5D3CA] flex items-center justify-center flex-shrink-0">
                    <span class="material-symbols-outlined text-[20px]">payments</span>
                  </div>
                  <div>
                    <h4 class="text-sm font-semibold text-[#1C1D1A] dark:text-[#D5D3CA]">Expense & Settlement Alerts</h4>
                    <p class="text-xs text-[#575851] dark:text-[#A5A69B] mt-0.5">Get notified when new shared expenses or settlements are added</p>
                  </div>
                </div>
                <label class="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input type="checkbox" v-model="notificationsForm.expenseAlerts" class="sr-only peer">
                  <div class="w-11 h-6 bg-[#E3E0D8] peer-focus:outline-none rounded-full peer dark:bg-[#30312C] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#A7A99A]"></div>
                </label>
              </div>

              <!-- Real-Time Activity -->
              <div class="p-6 rounded-2xl bg-[#F7F6F2] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] flex items-center justify-between gap-5">
                <div class="flex items-center gap-4">
                  <div class="w-10 h-10 rounded-xl bg-[#EFECE6] dark:bg-[#292A25] text-[#575851] dark:text-[#D5D3CA] flex items-center justify-center flex-shrink-0">
                    <span class="material-symbols-outlined text-[20px]">group</span>
                  </div>
                  <div>
                    <h4 class="text-sm font-semibold text-[#1C1D1A] dark:text-[#D5D3CA]">Live Member Activity</h4>
                    <p class="text-xs text-[#575851] dark:text-[#A5A69B] mt-0.5">Show online presence badges when collaborating in trips</p>
                  </div>
                </div>
                <label class="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input type="checkbox" v-model="notificationsForm.liveActivity" class="sr-only peer">
                  <div class="w-11 h-6 bg-[#E3E0D8] peer-focus:outline-none rounded-full peer dark:bg-[#30312C] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#A7A99A]"></div>
                </label>
              </div>
            </div>
          </div>

          <!-- TAB 5: ACCOUNT -->
          <div v-else-if="activeTab === 'account'" class="space-y-6">
            <div>
              <h2 class="text-lg font-bold text-[#1C1D1A] dark:text-[#D5D3CA] tracking-tight">Account Overview</h2>
              <p class="text-xs text-[#575851] dark:text-[#A5A69B] mt-1">Manage your account credentials, sessions, and data</p>
            </div>

            <!-- Account Summary Card -->
            <div class="p-6 rounded-2xl bg-[#F7F6F2] dark:bg-[#22231F] border border-[#E3E0D8] dark:border-[#30312C] flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div>
                <h4 class="text-sm font-semibold text-[#1C1D1A] dark:text-[#D5D3CA]">{{ profileForm.name || 'TravelSync User' }}</h4>
                <p class="text-xs text-[#575851] dark:text-[#A5A69B] mt-1">{{ profileForm.email }}</p>
                <div class="flex items-center gap-2 mt-2.5 text-[11px] text-[#86A98B] font-medium">
                  <span class="w-2 h-2 rounded-full bg-[#86A98B]"></span>
                  <span>Active & Verified</span>
                </div>
              </div>
              <button 
                @click="handleLogout"
                class="px-4 py-2.5 bg-[#FFFFFF] hover:bg-[#F0EEE9] dark:bg-[#292A25] dark:hover:bg-[#30312C] border border-[#E3E0D8] dark:border-[#30312C] text-[#1C1D1A] dark:text-[#D5D3CA] text-xs font-semibold rounded-xl transition-all self-start sm:self-auto flex items-center gap-2 shadow-sm"
              >
                <span class="material-symbols-outlined text-[16px]">logout</span>
                <span>Sign Out</span>
              </button>
            </div>

            <!-- Danger Zone: Delete Account -->
            <div class="p-6 rounded-2xl bg-[#C77F78]/10 border border-[#C77F78]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div>
                <h4 class="text-sm font-semibold text-[#C77F78]">Delete Account</h4>
                <p class="text-xs text-[#575851] dark:text-[#A5A69B] mt-1">Permanently delete your account, trips, and data. Requires OTP verification.</p>
              </div>
              <button 
                @click="initiateDeleteAccount"
                :disabled="sendingDeleteOtp"
                class="px-4 py-2.5 bg-[#C77F78] hover:bg-[#B36E67] text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50 self-start sm:self-auto flex items-center gap-2 flex-shrink-0 shadow-sm border border-[#C77F78]/40"
              >
                <span class="material-symbols-outlined text-[16px]">delete_forever</span>
                <span>{{ sendingDeleteOtp ? 'Sending OTP...' : 'Delete Account' }}</span>
              </button>
            </div>
          </div>

        </section>
      </div>

    <OtpModal
      :visible="showDeleteModal"
      :email="profileForm.email || authStore.currentUser?.email || ''"
      purpose="delete"
      :devOtp="deleteDevOtp"
      :customVerify="handleDeleteAccount"
      @update:devOtp="deleteDevOtp = $event"
      @cancel="showDeleteModal = false"
    />
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppLayout from '../components/AppLayout.vue';
import ThemeToggle from '../components/ThemeToggle.vue';
import OtpModal from '../components/OtpModal.vue';
import api from '../api';
import { useAuthStore } from '../stores/auth';
import { useToastStore } from '../stores/toast';
import { getBaseUrl } from '../utils/url';

const router = useRouter();
const authStore = useAuthStore();
const toastStore = useToastStore();

const activeTab = ref('profile');
const photoInput = ref(null);
const loadingProfile = ref(false);
const loadingPhoto = ref(false);

const settingsTabs = [
  { id: 'profile', label: 'Profile', icon: 'person' },
  { id: 'security', label: 'Security', icon: 'shield' },
  { id: 'preferences', label: 'Preferences', icon: 'tune' },
  { id: 'notifications', label: 'Notifications', icon: 'notifications' },
  { id: 'account', label: 'Account', icon: 'manage_accounts' },
];

const profileForm = ref({
  name: authStore.currentUser?.name || '',
  email: authStore.currentUser?.email || ''
});

const notificationsForm = ref({
  tripUpdates: true,
  expenseAlerts: true,
  liveActivity: true
});

const profilePicture = ref(authStore.currentUser?.picture || '');
const joinDate = ref(authStore.currentUser?.createdAt ? new Date(authStore.currentUser.createdAt) : null);
const memberSince = joinDate;

const memberSinceFormatted = computed(() => {
  if (!joinDate.value) return '';
  const d = new Date(joinDate.value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
});

const userInitials = computed(() => {
  const name = profileForm.value.name.trim();
  if (!name) return 'U';
  const parts = name.split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
});

const triggerPhotoSelect = () => {
  photoInput.value?.click();
};

const showDeleteModal = ref(false);
const deleteDevOtp = ref('');
const sendingDeleteOtp = ref(false);

const initiateDeleteAccount = async () => {
  const email = profileForm.value.email || authStore.currentUser?.email;
  if (!email) {
    toastStore.showToast('No email address found for this account', 'error');
    return;
  }
  sendingDeleteOtp.value = true;
  try {
    const res = await api.post('/auth/send-otp', { email, purpose: 'delete' });
    deleteDevOtp.value = res.data?.devOtp || '';
    showDeleteModal.value = true;
    toastStore.showToast('Verification code sent to your email', 'info');
  } catch (err) {
    toastStore.showToast(err.response?.data?.message || 'Failed to send verification code', 'error');
  } finally {
    sendingDeleteOtp.value = false;
  }
};

const handleDeleteAccount = async (otp) => {
  await api.delete('/auth/me', { data: { otp }, skipErrorToast: true });
  showDeleteModal.value = false;
  const { signOut } = await import('firebase/auth');
  const { auth } = await import('../firebase');
  try {
    await signOut(auth);
  } catch {}
  authStore.clearAuth();
  if (typeof window !== 'undefined') {
    localStorage.clear();
  }
  await router.push('/login');
  toastStore.showToast('Account deleted successfully.', 'success');
};

const fetchUserProfile = async () => {
  try {
    const res = await api.get('/auth/me');
    if (res.data) {
      if (res.data.name) profileForm.value.name = res.data.name;
      if (res.data.email) profileForm.value.email = res.data.email;
      if (res.data.picture) {
        const base = getBaseUrl();
        profilePicture.value = res.data.picture.startsWith('http') ? res.data.picture : `${base}${res.data.picture}`;
      }
      if (res.data.createdAt) {
        joinDate.value = new Date(res.data.createdAt);
      }
    }
  } catch (err) {
    // If not authenticated or error, use fallback values
    if (authStore.currentUser) {
      profileForm.value.name = authStore.currentUser.name || profileForm.value.name;
      profileForm.value.email = authStore.currentUser.email || profileForm.value.email;
      if (authStore.currentUser.createdAt) {
        joinDate.value = new Date(authStore.currentUser.createdAt);
      }
    }
  }
};

const handleProfileUpdate = async () => {
  loadingProfile.value = true;
  try {
    await api.put('/auth/me', { name: profileForm.value.name });
    authStore.updateUser({ name: profileForm.value.name });
    toastStore.showToast('Profile updated successfully!', 'success');
  } catch (err) {
    toastStore.showToast(err.response?.data?.message || 'Failed to update profile', 'error');
  } finally {
    loadingProfile.value = false;
  }
};

const handlePhotoUpload = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  loadingPhoto.value = true;
  try {
    const formData = new FormData();
    formData.append('photo', file);

    const res = await api.post('/auth/upload-photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    const pictureUrl = res.data.pictureUrl;
    const base = getBaseUrl();
    profilePicture.value = `${base}${pictureUrl}`;
    authStore.updateUser({ picture: pictureUrl });
    toastStore.showToast('Profile photo updated!', 'success');
  } catch (err) {
    toastStore.showToast('Failed to upload photo', 'error');
  } finally {
    loadingPhoto.value = false;
  }
};

const sendPasswordReset = async () => {
  try {
    const { sendResetEmail } = await import('../services/authService');
    await sendResetEmail(profileForm.value.email);
    toastStore.showToast(`Password reset email sent to ${profileForm.value.email}`, 'success');
  } catch (err) {
    toastStore.showToast(err.message || 'Failed to send reset email', 'error');
  }
};

const handleLogout = async () => {
  await authStore.logout();
  router.push('/login');
};

onMounted(() => {
  fetchUserProfile();
});
</script>
