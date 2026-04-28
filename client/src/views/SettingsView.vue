<template>
  <div class="min-h-screen bg-surface">
    <Navbar />
    <Sidebar />

    <main class="md:ml-64 pt-24 pb-20 px-4 md:px-margin min-h-[calc(100vh-64px)]">
      <!-- Header -->
      <section class="mb-lg">
        <div>
          <h1 class="text-3xl font-bold text-on-surface">Settings</h1>
          <p class="text-outline-variant mt-1">Manage your profile and account preferences</p>
        </div>
      </section>

      <!-- Settings Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        <!-- Sidebar Menu -->
        <div class="lg:col-span-1">
          <nav class="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden sticky top-24">
            <button
              v-for="tab in settingsTabs"
              :key="tab.id"
              @click="activeTab = tab.id"
              :class="[
                'w-full text-left px-6 py-4 border-l-4 transition-all duration-200',
                activeTab === tab.id
                  ? 'bg-primary/10 border-l-primary text-primary font-semibold'
                  : 'border-l-transparent text-on-surface-variant hover:bg-surface-container'
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
        <div class="lg:col-span-2">
          <!-- Profile Tab -->
          <section v-if="activeTab === 'profile'" class="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6">
            <h2 class="text-2xl font-bold text-on-surface mb-6">Profile Information</h2>
            
            <!-- Avatar -->
            <div class="flex flex-col md:flex-row gap-6 mb-8 pb-8 border-b border-gray-200 dark:border-slate-800">
              <div>
                <div class="w-24 h-24 rounded-full bg-primary-container flex items-center justify-center text-white text-4xl font-bold">
                  {{ userInitials }}
                </div>
              </div>
              <div class="flex-1">
                <h3 class="font-semibold text-on-surface mb-2">Profile Photo</h3>
                <p class="text-outline-variant text-sm mb-4">Upload a profile picture to personalize your account</p>
                <button class="px-4 py-2 bg-primary text-on-primary rounded-lg font-semibold hover:opacity-90 transition-opacity text-sm disabled:opacity-50" disabled>
                  <span class="material-symbols-outlined text-sm">upload</span>
                  Upload Photo
                </button>
                <p class="text-outline-variant text-xs mt-2">Feature coming soon</p>
              </div>
            </div>

            <!-- Form -->
            <form @submit.prevent="handleProfileUpdate" class="space-y-6">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label class="block text-sm font-medium text-on-surface mb-2">Full Name</label>
                  <input
                    v-model="profileForm.name"
                    type="text"
                    class="w-full px-4 py-2 border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder="Your full name"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-on-surface mb-2">Email</label>
                  <input
                    :value="profileForm.email"
                    type="email"
                    disabled
                    class="w-full px-4 py-2 border border-outline-variant rounded-lg bg-surface-container text-on-surface-variant cursor-not-allowed"
                  />
                  <p class="text-outline-variant text-xs mt-1">Email cannot be changed</p>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-on-surface mb-2">Member Since</label>
                <p class="text-on-surface-variant">{{ formatDate(userJoinDate) }}</p>
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
                  class="px-6 py-2 border border-outline-variant text-on-surface rounded-lg font-semibold hover:bg-surface-container transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>

          <!-- Security Tab -->
          <section v-if="activeTab === 'security'" class="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6">
            <h2 class="text-2xl font-bold text-on-surface mb-6">Security & Password</h2>

            <form @submit.prevent="handlePasswordChange" class="space-y-6">
              <div>
                <label class="block text-sm font-medium text-on-surface mb-2">Current Password</label>
                <input
                  v-model="passwordForm.currentPassword"
                  type="password"
                  class="w-full px-4 py-2 border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="Enter your current password"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-on-surface mb-2">New Password</label>
                <input
                  v-model="passwordForm.newPassword"
                  type="password"
                  class="w-full px-4 py-2 border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="Enter new password (min. 8 characters)"
                />
                <p class="text-outline-variant text-xs mt-2">
                  {{ passwordForm.newPassword.length }} character{{ passwordForm.newPassword.length !== 1 ? 's' : '' }}
                </p>
              </div>

              <div>
                <label class="block text-sm font-medium text-on-surface mb-2">Confirm New Password</label>
                <input
                  v-model="passwordForm.confirmPassword"
                  type="password"
                  class="w-full px-4 py-2 border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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

            <!-- Sessions -->
            <div class="mt-8 pt-8 border-t border-gray-200 dark:border-slate-800">
              <h3 class="font-semibold text-on-surface mb-4">Active Sessions</h3>
              <div class="bg-surface-container rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p class="font-medium text-on-surface">Current Device</p>
                  <p class="text-sm text-on-surface-variant">This browser</p>
                </div>
                <span class="text-xs bg-green-100 text-green-900 px-3 py-1 rounded-full">Active</span>
              </div>
            </div>
          </section>

          <!-- Preferences Tab -->
          <section v-if="activeTab === 'preferences'" class="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6">
            <h2 class="text-2xl font-bold text-on-surface mb-6">Preferences</h2>

            <div class="space-y-6">
              <!-- Dark Mode -->
              <div class="flex items-center justify-between pb-6 border-b border-gray-200 dark:border-slate-800">
                <div>
                  <h3 class="font-medium text-on-surface">Dark Mode</h3>
                  <p class="text-sm text-on-surface-variant">Use dark theme for easier viewing</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" v-model="isDarkMode" class="sr-only peer" />
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer dark:bg-slate-700 peer-checked:bg-primary"></div>
                </label>
              </div>

              <!-- Notifications -->
              <div class="flex items-center justify-between pb-6 border-b border-gray-200 dark:border-slate-800">
                <div>
                  <h3 class="font-medium text-on-surface">Email Notifications</h3>
                  <p class="text-sm text-on-surface-variant">Get updates about your trips and invitations</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" v-model="preferences.emailNotifications" class="sr-only peer" />
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer dark:bg-slate-700 peer-checked:bg-primary"></div>
                </label>
              </div>

              <!-- Trip Reminders -->
              <div class="flex items-center justify-between pb-6 border-b border-gray-200 dark:border-slate-800">
                <div>
                  <h3 class="font-medium text-on-surface">Trip Reminders</h3>
                  <p class="text-sm text-on-surface-variant">Get notified before upcoming trips</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" v-model="preferences.tripReminders" class="sr-only peer" />
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer dark:bg-slate-700 peer-checked:bg-primary"></div>
                </label>
              </div>

              <!-- Privacy -->
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="font-medium text-on-surface">Profile Visibility</h3>
                  <p class="text-sm text-on-surface-variant">Allow others to see your profile</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" v-model="preferences.profileVisible" class="sr-only peer" />
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer dark:bg-slate-700 peer-checked:bg-primary"></div>
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
          <section v-if="activeTab === 'danger'" class="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6">
            <h2 class="text-2xl font-bold text-error mb-6">Danger Zone</h2>

            <!-- Logout -->
            <div class="mb-6 pb-6 border-b border-gray-200 dark:border-slate-800">
              <h3 class="font-semibold text-on-surface mb-2">Sign Out</h3>
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
              <h3 class="font-semibold text-error mb-2">Delete Account</h3>
              <p class="text-outline-variant text-sm mb-4">Permanently delete your account and all associated data. This action cannot be undone.</p>
              <button
                disabled
                class="px-6 py-2 bg-error text-on-error rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Delete Account
              </button>
              <p class="text-outline-variant text-xs mt-2">Feature available in premium tier</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useToastStore } from '../stores/toast';
import { useDarkMode } from '../composables/useDarkMode';
import Navbar from '../components/Navbar.vue';
import Sidebar from '../components/Sidebar.vue';

const router = useRouter();
const toastStore = useToastStore();
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
  name: 'John Doe',
  email: 'john@example.com',
  joinDate: new Date('2024-01-15')
});

const profileForm = ref({
  name: originalProfile.value.name,
  email: originalProfile.value.email
});

const userJoinDate = ref(new Date('2024-01-15'));

const loadingProfile = ref(false);
const loadingPassword = ref(false);
const passwordError = ref('');

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
  return profileForm.value.name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
});

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
const handleProfileUpdate = async () => {
  loadingProfile.value = true;
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000));
  originalProfile.value.name = profileForm.value.name;
  toastStore.showToast('Profile updated successfully', 'success');
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
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  toastStore.showToast('Password changed successfully', 'success');
  passwordForm.value = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };
  loadingPassword.value = false;
};

const savePreferences = () => {
  toastStore.showToast('Preferences saved', 'success');
};

const handleLogout = () => {
  localStorage.removeItem('token');
  router.push('/login');
  toastStore.showToast('You have been logged out', 'info');
};

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};
</script>
