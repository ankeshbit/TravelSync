<template>
  <div class="min-h-screen bg-[#080D1A] text-slate-100 font-['Plus_Jakarta_Sans'] flex">
    <Navbar />
    <Sidebar />

    <!-- Main Content Area -->
    <main class="flex-1 md:pl-64 pt-16 md:pt-8 pb-16 px-6 md:px-10 transition-all duration-300 max-w-7xl mx-auto w-full">
      <!-- Header -->
      <header class="mb-8">
        <h1 class="text-3xl font-extrabold text-white tracking-tight">Settings</h1>
        <p class="text-sm text-slate-400 mt-1">Manage your profile and account preferences.</p>
      </header>

      <!-- Settings 2-Column Layout -->
      <div class="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        
        <!-- Left Sub-Tabs Navigation -->
        <nav class="md:col-span-3 flex flex-col gap-1.5">
          <button
            v-for="tab in settingsTabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            :class="activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25 font-semibold' : 'text-slate-400 hover:text-white hover:bg-[#111C33] font-medium'"
            class="px-4 py-2.5 rounded-xl flex items-center gap-3 text-sm transition-all duration-200 text-left"
          >
            <span class="material-symbols-outlined text-[20px]">{{ tab.icon }}</span>
            <span>{{ tab.label }}</span>
          </button>
        </nav>

        <!-- Right Content Card -->
        <section class="md:col-span-9 bg-[#0F172A] border border-[#1E2E4E] rounded-2xl p-6 sm:p-8 shadow-xl">
          
          <!-- TAB 1: PROFILE INFORMATION -->
          <div v-if="activeTab === 'profile'">
            <div class="mb-6">
              <h2 class="text-lg font-bold text-white tracking-tight">Profile Information</h2>
              <p class="text-xs text-slate-400 mt-0.5">Update your personal information</p>
            </div>

            <!-- Profile Photo Upload -->
            <div class="flex flex-col sm:flex-row sm:items-center gap-5 p-4 rounded-xl bg-[#111C33]/60 border border-[#1E2E4E] mb-6">
              <div class="relative w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xl flex-shrink-0 shadow-md">
                <img 
                  v-if="profilePicture" 
                  :src="profilePicture" 
                  alt="Profile" 
                  class="w-full h-full object-cover rounded-full" 
                />
                <span v-else>{{ userInitials }}</span>
                
                <button 
                  @click="triggerPhotoSelect" 
                  class="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-slate-900 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center shadow"
                  title="Change photo"
                >
                  <span class="material-symbols-outlined text-[13px]">photo_camera</span>
                </button>
                <input ref="photoInput" type="file" accept="image/*" class="hidden" @change="handlePhotoUpload" />
              </div>

              <div class="flex-1">
                <h4 class="text-sm font-semibold text-white">Profile Photo</h4>
                <p class="text-xs text-slate-400 mt-0.5">Upload a profile picture (PNG or JPEG, max 5MB)</p>
              </div>

              <button 
                @click="triggerPhotoSelect"
                type="button" 
                :disabled="loadingPhoto"
                class="px-4 py-2 border border-[#1E2E4E] hover:border-slate-600 bg-[#162442] hover:bg-[#1c2e54] text-xs font-semibold text-white rounded-xl transition-all flex items-center gap-2 self-start sm:self-auto"
              >
                <span v-if="loadingPhoto" class="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                <span v-else class="material-symbols-outlined text-[16px]">upload</span>
                <span>Upload Photo</span>
              </button>
            </div>

            <!-- Profile Inputs Form -->
            <form @submit.prevent="handleProfileUpdate" class="space-y-5">
              <!-- Full Name -->
              <div>
                <label class="block text-xs font-semibold text-slate-300 mb-1.5">Full Name</label>
                <input 
                  v-model="profileForm.name"
                  type="text" 
                  required
                  placeholder="e.g. Rajnish Srivastava"
                  class="w-full bg-[#111C33] border border-[#1E2E4E] text-sm text-white placeholder-slate-500 px-4 py-2.5 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <!-- Email -->
              <div>
                <label class="block text-xs font-semibold text-slate-300 mb-1.5">Email</label>
                <input 
                  v-model="profileForm.email"
                  type="email" 
                  disabled
                  class="w-full bg-[#111C33]/50 border border-[#1E2E4E] text-sm text-slate-400 px-4 py-2.5 rounded-xl cursor-not-allowed opacity-90"
                />
                <p class="text-[11px] text-slate-500 mt-1">Email cannot be changed (Firebase)</p>
              </div>

              <!-- Member Since -->
              <div v-if="memberSince">
                <label class="block text-xs font-semibold text-slate-300 mb-1.5">Member Since</label>
                <div class="flex items-center gap-2 text-sm text-slate-300 px-1 py-1">
                  <span class="material-symbols-outlined text-[18px] text-slate-500">calendar_month</span>
                  <span>{{ memberSinceFormatted }}</span>
                </div>
              </div>

              <!-- Save Changes Button -->
              <div class="pt-2">
                <button 
                  type="submit" 
                  :disabled="loadingProfile"
                  class="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-lg shadow-blue-600/30 active:scale-95 transition-all flex items-center gap-2"
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
              <h2 class="text-lg font-bold text-white tracking-tight">Security & Authentication</h2>
              <p class="text-xs text-slate-400 mt-0.5">Manage password and account protection</p>
            </div>

            <!-- Google OAuth Status -->
            <div class="p-5 rounded-2xl bg-[#111C33]/60 border border-[#1E2E4E] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow">
                  <svg class="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                </div>
                <div>
                  <h4 class="text-sm font-semibold text-white">Google Account Sign-In</h4>
                  <p class="text-xs text-slate-400">Connected for fast, secure authentication</p>
                </div>
              </div>
              <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Active
              </span>
            </div>

            <!-- Password Reset -->
            <div class="p-5 rounded-2xl bg-[#111C33]/60 border border-[#1E2E4E] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <span class="material-symbols-outlined text-[20px]">lock_reset</span>
                </div>
                <div>
                  <h4 class="text-sm font-semibold text-white">Password Recovery</h4>
                  <p class="text-xs text-slate-400">Send a password reset email to {{ profileForm.email }}</p>
                </div>
              </div>
              <button 
                @click="sendPasswordReset"
                type="button" 
                class="px-4 py-2 border border-[#1E2E4E] hover:border-slate-600 bg-[#162442] hover:bg-[#1c2e54] text-xs font-semibold text-white rounded-xl transition-all"
              >
                Send Reset Link
              </button>
            </div>
          </div>

          <!-- TAB 3: PREFERENCES -->
          <div v-else-if="activeTab === 'preferences'" class="space-y-6">
            <div>
              <h2 class="text-lg font-bold text-white tracking-tight">Preferences</h2>
              <p class="text-xs text-slate-400 mt-0.5">Customize your travel and notification settings</p>
            </div>

            <div class="p-5 rounded-2xl bg-[#111C33]/60 border border-[#1E2E4E] flex items-center justify-between">
              <div>
                <h4 class="text-sm font-semibold text-white">Dark Theme</h4>
                <p class="text-xs text-slate-400">Immersive dark interface tailored for travel planning</p>
              </div>
              <span class="text-xs font-semibold px-3 py-1 rounded-full bg-blue-600 text-white">Enabled</span>
            </div>
          </div>

          <!-- TAB 4 & 5: NOTIFICATIONS / ACCOUNT -->
          <div v-else class="space-y-6">
            <div>
              <h2 class="text-lg font-bold text-white tracking-tight">{{ activeTab.toUpperCase() }}</h2>
              <p class="text-xs text-slate-400 mt-0.5">Manage your system options</p>
            </div>

            <div class="p-5 rounded-2xl bg-[#111C33]/60 border border-[#1E2E4E] flex items-center justify-between">
              <div>
                <h4 class="text-sm font-semibold text-white">Sign Out</h4>
                <p class="text-xs text-slate-400">End your current session on this device</p>
              </div>
              <button 
                @click="handleLogout"
                class="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 text-xs font-semibold rounded-xl transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>

        </section>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import Navbar from '../components/Navbar.vue';
import Sidebar from '../components/Sidebar.vue';
import api from '../api';
import { useAuthStore } from '../stores/auth';
import { useToastStore } from '../stores/toast';

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

const fetchUserProfile = async () => {
  try {
    const res = await api.get('/auth/me');
    if (res.data) {
      if (res.data.name) profileForm.value.name = res.data.name;
      if (res.data.email) profileForm.value.email = res.data.email;
      if (res.data.picture) {
        const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace('/api', '');
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

    const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace('/api', '');
    profilePicture.value = `${base}${res.data.pictureUrl}`;
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
