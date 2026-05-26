<template>
  <div class="min-h-screen bg-surface dark:bg-slate-950 transition-colors duration-200">
    <Navbar />
    <Sidebar />

    <main class="md:ml-16 lg:ml-64 pt-24 pb-20 px-4 md:px-8 min-h-[calc(100vh-64px)] transition-all duration-300">
      <!-- Header -->
      <section class="mb-lg">
        <div>
          <!-- Fix: Added dark:text-slate-100 for settings title -->
          <h1 class="text-3xl font-bold text-on-surface dark:text-slate-100">Settings</h1>
          <p class="text-outline-variant mt-1">Manage your profile and account preferences</p>
        </div>
      </section>

      <!-- Settings Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Sidebar Menu -->
        <div class="lg:col-span-1">
          <nav class="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden sticky top-24">
            <button
              v-for="tab in settingsTabs"
              :key="tab.id"
              @click="activeTab = tab.id"
              :class="[
                'w-full text-left px-6 py-4 border-l-4 transition-all duration-200 cursor-pointer',
                activeTab === tab.id
                  ? 'bg-primary/10 border-l-primary text-primary font-semibold dark:bg-blue-950/40 dark:border-l-blue-400 dark:text-blue-400'
                  : 'border-l-transparent text-on-surface-variant hover:bg-surface-container dark:hover:bg-slate-800 dark:text-slate-400'
              ]"
            >
              <div class="flex items-center gap-3">
                <span class="material-symbols-outlined">{{ tab.icon }}</span>
                {{ tab.label }}
              </div>
            </button>
          </nav>
        </div>

        <!-- Content -->
        <div class="lg:col-span-2 min-w-0">
          <!-- Profile Tab -->
          <section v-if="activeTab === 'profile'" class="w-full bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6">
            <!-- Fix: Added dark:text-slate-100 -->
            <h2 class="text-2xl font-bold text-on-surface dark:text-slate-100 mb-6">Profile Information</h2>
            
            <!-- Avatar (Constrained on md+) -->
            <div class="flex flex-col md:flex-row gap-6 mb-8 pb-8 border-b border-gray-200 dark:border-slate-800">
              <div>
                <!-- Show uploaded photo or initials fallback -->
                <img
                  v-if="profilePicture"
                  :src="profilePicture"
                  alt="Profile photo"
                  class="w-24 h-24 rounded-full object-cover"
                />
                <div v-else class="w-24 h-24 rounded-full bg-primary-container flex items-center justify-center text-white text-4xl font-bold">
                  {{ userInitials }}
                </div>
              </div>
              <div class="flex-1">
                <!-- Fix: Added dark:text-slate-100 -->
                <h3 class="font-semibold text-on-surface dark:text-slate-100 mb-2">Profile Photo</h3>
                <p class="text-outline-variant text-sm mb-4">Upload a profile picture to personalize your account (PNG or JPEG, max 5 MB)</p>

                <!-- Hidden file input —— programmatic click -->
                <input
                  ref="photoInput"
                  type="file"
                  accept="image/png, image/jpeg, image/gif, image/webp"
                  style="opacity:0; position:absolute; pointer-events:none;"
                  @change="handlePhotoUpload"
                />

                <button
                  type="button"
                  :disabled="loadingPhoto"
                  class="px-4 py-2 bg-primary text-on-primary rounded-lg font-semibold hover:opacity-90 transition-opacity text-sm disabled:opacity-50 flex items-center gap-2"
                  @click="photoInput.click()"
                >
                  <span v-if="!loadingPhoto" class="material-symbols-outlined text-sm">upload</span>
                  <span v-else class="material-symbols-outlined text-sm animate-spin">hourglass_bottom</span>
                  {{ loadingPhoto ? 'Uploading...' : 'Upload Photo' }}
                </button>
              </div>
            </div>

            <!-- Profile Form (Constrained and Centered on md+) -->
            <form @submit.prevent="handleProfileUpdate" class="space-y-6">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                <div>
                  <label class="block text-sm font-medium text-on-surface dark:text-slate-200 mb-2">Full Name</label>
                  <input
                    v-model="profileForm.name"
                    type="text"
                    class="w-full px-4 py-2 bg-transparent border border-outline-variant dark:border-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder="Your full name"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-on-surface dark:text-slate-200 mb-2">Email</label>
                  <input
                    :value="profileForm.email"
                    type="email"
                    disabled
                    class="w-full px-4 py-2 border border-outline-variant dark:border-slate-700 rounded-lg bg-surface-container dark:bg-slate-800 text-on-surface-variant dark:text-slate-400 cursor-not-allowed"
                  />
                  <p class="text-outline-variant text-xs mt-1">Email cannot be changed</p>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-on-surface dark:text-slate-200 mb-2">Member Since</label>
                <p class="text-on-surface-variant dark:text-slate-300">{{ formatDate(userJoinDate) }}</p>
              </div>

              <div class="pt-4 flex gap-3">
                <button
                  type="submit"
                  :disabled="!isProfileDirty || loadingProfile"
                  class="px-6 py-2 bg-primary text-on-primary rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                >
                  <span v-if="!loadingProfile" class="material-symbols-outlined text-sm">save</span>
                  <span v-if="loadingProfile" class="material-symbols-outlined text-sm animate-spin">hourglass_bottom</span>
                  {{ loadingProfile ? 'Saving...' : 'Save Changes' }}
                </button>
                <button
                  type="button"
                  @click="resetProfileForm"
                  class="px-6 py-2 border border-outline-variant text-on-surface dark:text-slate-300 dark:border-slate-700 rounded-lg font-semibold hover:bg-surface-container dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>

          <!-- Security Tab -->
          <section v-if="activeTab === 'security'" class="w-full bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6">
            <!-- Fix: Added dark:text-slate-100 -->
            <h2 class="text-2xl font-bold text-on-surface dark:text-slate-100 mb-6">Security & Password</h2>

            <!-- Password Form (Constrained and Centered on md+) -->
            <form @submit.prevent="handlePasswordChange" class="space-y-6">
              <div>
                <label class="block text-sm font-medium text-on-surface dark:text-slate-200 mb-2">Current Password</label>
                <input
                  v-model="passwordForm.currentPassword"
                  type="password"
                  class="w-full px-4 py-2 bg-transparent border border-outline-variant dark:border-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="Enter your current password"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-on-surface dark:text-slate-200 mb-2">New Password</label>
                <input
                  v-model="passwordForm.newPassword"
                  type="password"
                  class="w-full px-4 py-2 bg-transparent border border-outline-variant dark:border-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="Enter new password (min. 8 characters)"
                />
                <p class="text-outline-variant text-xs mt-2 dark:text-slate-400">
                  {{ passwordForm.newPassword.length }} character{{ passwordForm.newPassword.length !== 1 ? 's' : '' }}
                </p>
              </div>

              <div>
                <label class="block text-sm font-medium text-on-surface dark:text-slate-200 mb-2">Confirm New Password</label>
                <input
                  v-model="passwordForm.confirmPassword"
                  type="password"
                  class="w-full px-4 py-2 bg-transparent border border-outline-variant dark:border-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="Confirm your new password"
                />
              </div>

              <div v-if="passwordError" class="p-4 bg-error-container text-on-error-container rounded-lg text-sm">
                {{ passwordError }}
              </div>

              <div class="pt-4 flex gap-3">
                <button
                  type="submit"
                  :disabled="!isPasswordFormValid || loadingPassword"
                  class="px-6 py-2 bg-primary text-on-primary rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                >
                  <span v-if="!loadingPassword" class="material-symbols-outlined text-sm">lock</span>
                  <span v-if="loadingPassword" class="material-symbols-outlined text-sm animate-spin">hourglass_bottom</span>
                  {{ loadingPassword ? 'Updating...' : 'Update Password' }}
                </button>
              </div>
            </form>

            <!-- Sessions (Constrained on md+) -->
            <div class="mt-8 pt-8 border-t border-gray-200 dark:border-slate-800">
              <h3 class="font-semibold text-on-surface dark:text-slate-100 mb-4">Active Sessions</h3>
              <div class="bg-surface-container dark:bg-slate-800 rounded-lg p-4 flex items-center justify-between transition-colors duration-200">
                <div>
                  <p class="font-medium text-on-surface dark:text-slate-100">Current Device</p>
                  <p class="text-sm text-on-surface-variant dark:text-slate-400">This browser</p>
                </div>
                <span class="text-xs bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-300 px-3 py-1 rounded-full">Active</span>
              </div>
            </div>
          </section>

          <!-- Preferences Tab -->
          <section v-if="activeTab === 'preferences'" class="w-full bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6">
            <!-- Fix: Added dark:text-slate-100 -->
            <h2 class="text-2xl font-bold text-on-surface dark:text-slate-100 mb-6">Preferences</h2>

            <div class="space-y-6">
              <!-- Dark Mode -->
              <div class="flex items-center justify-between pb-6 border-b border-gray-200 dark:border-slate-800">
                <div>
                  <h3 class="font-medium text-on-surface dark:text-slate-200">Dark Mode</h3>
                  <p class="text-sm text-on-surface-variant dark:text-slate-400">Use dark theme for easier viewing</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" v-model="isDarkMode" class="sr-only peer" />
                  <div class="w-11 h-6 relative bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer dark:bg-slate-700 peer-checked:bg-primary dark:peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                </label>
              </div>

              <!-- Notifications -->
              <div class="flex items-center justify-between pb-6 border-b border-gray-200 dark:border-slate-800">
                <div>
                  <h3 class="font-medium text-on-surface dark:text-slate-200">Email Notifications</h3>
                  <p class="text-sm text-on-surface-variant dark:text-slate-400">Get updates about your trips and invitations</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" v-model="preferences.emailNotifications" class="sr-only peer" />
                  <div class="w-11 h-6 relative bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer dark:bg-slate-700 peer-checked:bg-primary dark:peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                </label>
              </div>

              <!-- Trip Reminders -->
              <div class="flex items-center justify-between pb-6 border-b border-gray-200 dark:border-slate-800">
                <div>
                  <h3 class="font-medium text-on-surface dark:text-slate-200">Trip Reminders</h3>
                  <p class="text-sm text-on-surface-variant dark:text-slate-400">Get notified before upcoming trips</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" v-model="preferences.tripReminders" class="sr-only peer" />
                  <div class="w-11 h-6 relative bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer dark:bg-slate-700 peer-checked:bg-primary dark:peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                </label>
              </div>

              <!-- Privacy -->
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="font-medium text-on-surface dark:text-slate-200">Profile Visibility</h3>
                  <p class="text-sm text-on-surface-variant dark:text-slate-400">Allow others to see your profile</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" v-model="preferences.profileVisible" class="sr-only peer" />
                  <div class="w-11 h-6 relative bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer dark:bg-slate-700 peer-checked:bg-primary dark:peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                </label>
              </div>

              <div class="pt-4">
                <button @click="savePreferences" class="px-6 py-2 bg-primary text-on-primary rounded-lg font-semibold hover:opacity-90 transition-opacity">
                  Save Preferences
                </button>
              </div>
            </div>
          </section>

          <!-- Danger Zone Tab -->
          <section v-if="activeTab === 'danger'" class="w-full bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6">
            <h2 class="text-2xl font-bold text-error dark:text-red-400 mb-6">Danger Zone</h2>

            <div class="space-y-6">
              <!-- Logout -->
              <div class="mb-6 pb-6 border-b border-gray-200 dark:border-slate-800">
                <h3 class="font-semibold text-on-surface dark:text-slate-100 mb-2">Sign Out</h3>
                <p class="text-outline-variant text-sm mb-4">End your session on this device</p>
                <button
                  @click="handleLogout"
                  class="px-6 py-2 bg-primary text-on-primary rounded-lg font-semibold hover:opacity-90 transition-opacity"
                >
                  Sign Out
                </button>
              </div>

              <!-- Delete Account -->
              <div>
                <h3 class="font-semibold text-error dark:text-red-400 mb-2">Delete Account</h3>
                <p class="text-outline-variant text-sm mb-4">Permanently delete your account and all associated data. This action cannot be undone.</p>
                <button
                  @click="showDeleteConfirm = true"
                  class="px-6 py-2 bg-error dark:bg-red-600 text-on-error dark:text-white rounded-lg font-semibold hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </section>

        </div>
      </div>
    </main>
  </div>

  <!-- Delete Confirmation Modal — Teleported to body, inline styles to guarantee centering -->
  <Teleport to="body">
    <div
      v-if="showDeleteConfirm"
      style="
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,0.65);
        padding: 16px;
      "
      @click.self="showDeleteConfirm = false; deleteError = ''"
    >
      <div
        style="
          background: var(--color-surface-container, #1e293b);
          border-radius: 16px;
          width: 100%;
          max-width: 440px;
          padding: 28px;
          box-shadow: 0 25px 50px rgba(0,0,0,0.5);
          border: 1px solid rgba(255,255,255,0.12);
          color: #f1f5f9;
          position: relative;
        "
      >
        <!-- Title row -->
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
          <span class="material-symbols-outlined" style="color:#ef4444; font-size:32px;">warning</span>
          <h3 style="font-size:1.25rem; font-weight:700; margin:0;">Delete Account?</h3>
        </div>

        <!-- Body text -->
        <p style="font-size:0.875rem; line-height:1.6; margin-bottom:20px; color:#cbd5e1;">
          This will permanently delete your account and
          <strong style="color:#f1f5f9;">all your trips and data</strong>.
          This action <strong style="color:#f1f5f9;">cannot be undone</strong>.
        </p>

        <!-- Error message -->
        <div
          v-if="deleteError"
          style="background:#fee2e2; color:#991b1b; border-radius:8px; padding:12px; font-size:0.875rem; margin-bottom:16px;"
        >
          {{ deleteError }}
        </div>

        <!-- Action buttons -->
        <div style="display:flex; gap:12px; justify-content:flex-end; flex-wrap:wrap;">
          <button
            @click="showDeleteConfirm = false; deleteError = ''"
            style="
              padding: 10px 20px;
              border: 1px solid rgba(255,255,255,0.2);
              border-radius: 8px;
              background: transparent;
              color: #cbd5e1;
              font-weight: 600;
              cursor: pointer;
              font-size: 0.9rem;
            "
          >
            Cancel
          </button>
          <button
            @click="handleDeleteRequest"
            :disabled="loadingDelete"
            style="
              padding: 10px 20px;
              border: none;
              border-radius: 8px;
              background: #dc2626;
              color: #fff;
              font-weight: 600;
              cursor: pointer;
              font-size: 0.9rem;
              display: flex;
              align-items: center;
              gap: 8px;
              opacity: 1;
            "
            :style="loadingDelete ? 'opacity:0.6; cursor:not-allowed;' : ''"
          >
            <span v-if="loadingDelete" class="material-symbols-outlined" style="font-size:16px; animation: spin 1s linear infinite;">hourglass_bottom</span>
            {{ loadingDelete ? 'Sending Code...' : 'Yes, Delete My Account' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- OTP Modal for Account Deletion -->
  <OtpModal
    :visible="showDeleteOtp"
    :email="userEmail"
    purpose="delete"
    @verified="handleOtpVerifiedDelete"
    @cancel="showDeleteOtp = false"
  />

</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useToastStore } from '../stores/toast';
import { useAuthStore } from '../stores/auth';
import { useDarkMode } from '../composables/useDarkMode';
import Navbar from '../components/Navbar.vue';
import Sidebar from '../components/Sidebar.vue';
import OtpModal from '../components/OtpModal.vue';
import api from '../api';

// Template ref for the hidden file input
const photoInput = ref(null);
const loadingPhoto = ref(false);

// Seed profilePicture immediately from localStorage so avatar shows on first render
const _base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace('/api', '');
const _storedPicture = (() => {
  try {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    return u.picture ? `${_base}${u.picture}` : '';
  } catch { return ''; }
})();
const profilePicture = ref(_storedPicture);

const router = useRouter();
const toastStore = useToastStore();
const authStore = useAuthStore();
const { isDarkMode, toggleDarkMode } = useDarkMode();

const activeTab = ref('profile');

const settingsTabs = [
  { id: 'profile', label: 'Profile', icon: 'person' },
  { id: 'security', label: 'Security', icon: 'lock' },
  { id: 'preferences', label: 'Preferences', icon: 'tune' },
  { id: 'danger', label: 'Account', icon: 'warning' }
];

// Profile data
const originalProfile = ref({
  name: '',
  email: '',
  joinDate: new Date()
});

const profileForm = ref({
  name: '',
  email: ''
});

const userJoinDate = ref(new Date());

const loadingProfile = ref(false);
const loadingPassword = ref(false);
const passwordError = ref('');
const showDeleteConfirm = ref(false);
const showDeleteOtp = ref(false);   // NEW: show OTP modal for delete
const loadingDelete = ref(false);
const deleteError = ref('');

// Password form
const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
});

// Preferences
const preferences = ref({
  emailNotifications: true,
  tripReminders: true,
  profileVisible: true
});

// Computed properties
const userInitials = computed(() => {
  if (!profileForm.value.name) return 'U';
  return profileForm.value.name
    .split(' ')
    .filter(word => word.length > 0)
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
});

// Email for OTP — read from form (populated by fetchProfile)
const userEmail = computed(() => profileForm.value.email || '');

const isProfileDirty = computed(() => {
  return profileForm.value.name !== originalProfile.value.name;
});

const isPasswordFormValid = computed(() => {
  return (
    passwordForm.value.currentPassword &&
    passwordForm.value.newPassword &&
    passwordForm.value.confirmPassword &&
    passwordForm.value.newPassword.length >= 8 &&
    passwordForm.value.newPassword === passwordForm.value.confirmPassword
  );
});

// Methods
const fetchProfile = async () => {
  try {
    const res = await api.get('/auth/me');
    originalProfile.value.name = res.data.name;
    originalProfile.value.email = res.data.email;
    profileForm.value.name = res.data.name;
    profileForm.value.email = res.data.email;

    // Load existing profile picture if any — API is the source of truth
    if (res.data.picture) {
      const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace('/api', '');
      profilePicture.value = `${base}${res.data.picture}`;
      // Keep localStorage in sync with DB
      try {
        const u = JSON.parse(localStorage.getItem('user') || '{}');
        u.picture = res.data.picture;
        localStorage.setItem('user', JSON.stringify(u));
      } catch {}
    }

    if (res.data.createdAt) {
      userJoinDate.value = new Date(res.data.createdAt);
    } else if (res.data._id) {
      // Fallback: extract timestamp from MongoDB ObjectId
      const timestamp = new Date(parseInt(res.data._id.substring(0, 8), 16) * 1000);
      userJoinDate.value = timestamp;
    }
  } catch (err) {
    toastStore.showToast('Failed to load profile', 'error');
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

    // Build absolute URL from the relative path returned by the server
    const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace('/api', '');
    profilePicture.value = `${baseUrl}${res.data.pictureUrl}`;

    // Keep localStorage user in sync
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      user.picture = res.data.pictureUrl;
      localStorage.setItem('user', JSON.stringify(user));
    }

    toastStore.showToast('Profile photo updated!', 'success');
  } catch (err) {
    toastStore.showToast(err.response?.data?.message || 'Failed to upload photo', 'error');
  } finally {
    loadingPhoto.value = false;
    // Reset so the same file can be re-selected if needed
    if (photoInput.value) photoInput.value.value = '';
  }
};

const handleProfileUpdate = async () => {
  loadingProfile.value = true;
  try {
    const res = await api.put('/auth/me', { name: profileForm.value.name });
    originalProfile.value.name = res.data.name;
    
    // Update local storage so other components using it stay in sync
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      user.name = res.data.name;
      localStorage.setItem('user', JSON.stringify(user));
    }
    
    toastStore.showToast('Profile updated successfully', 'success');
  } catch (err) {
    toastStore.showToast(err.response?.data?.message || 'Failed to update profile', 'error');
  }
  loadingProfile.value = false;
};

const resetProfileForm = () => {
  profileForm.value.name = originalProfile.value.name;
};

const handlePasswordChange = async () => {
  passwordError.value = '';
  
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    passwordError.value = 'Passwords do not match';
    return;
  }

  loadingPassword.value = true;
  try {
    await api.put('/auth/me/password', {
      currentPassword: passwordForm.value.currentPassword,
      newPassword: passwordForm.value.newPassword
    });
    toastStore.showToast('Password changed successfully', 'success');
    passwordForm.value = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    };
  } catch (err) {
    passwordError.value = err.response?.data?.message || 'Failed to update password';
  }
  loadingPassword.value = false;
};

const savePreferences = () => {
  toastStore.showToast('Preferences saved', 'success');
};

const handleLogout = async () => {
  try {
    await api.post('/auth/logout');
  } catch {}
  authStore.clearAuth();
  router.push('/login');
  toastStore.showToast('You have been logged out', 'info');
};

const handleDeleteAccount = async () => {
  deleteError.value = '';
  loadingDelete.value = true;
  try {
    await api.delete('/auth/me', { data: { otpVerified: true } });
    try {
      await api.post('/auth/logout');
    } catch {}
    authStore.clearAuth();
    toastStore.showToast('Your account has been deleted.', 'info');
    router.push('/login');
  } catch (err) {
    deleteError.value = err.response?.data?.message || 'Failed to delete account. Please try again.';
  } finally {
    loadingDelete.value = false;
  }
};

// Step 1: user clicks "Yes, Delete My Account" → send OTP, show OTP modal
const handleDeleteRequest = async () => {
  deleteError.value = '';
  loadingDelete.value = true;
  try {
    await api.post('/auth/send-otp', { email: userEmail.value, purpose: 'delete' });
    showDeleteConfirm.value = false;
    showDeleteOtp.value = true;
  } catch (err) {
    deleteError.value = err.response?.data?.message || 'Failed to send verification code.';
  } finally {
    loadingDelete.value = false;
  }
};

// Step 2: OTP verified → actually delete account
const handleOtpVerifiedDelete = async () => {
  showDeleteOtp.value = false;
  await handleDeleteAccount();
};

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

onMounted(() => {
  fetchProfile();
});
</script>

<style>
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
</style>
