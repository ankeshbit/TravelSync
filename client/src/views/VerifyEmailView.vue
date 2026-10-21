<template>
  <div class="min-h-screen bg-[#F7F6F2] dark:bg-[#111210] flex items-center justify-center p-4 transition-colors duration-200">
    <div class="w-full max-w-md bg-[#FAF9F5] dark:bg-[#1B1C19] border border-[#E3E0D8] dark:border-[#30312C] rounded-2xl p-8 shadow-xl flex flex-col items-center text-center">
      
      <!-- Brand Logo -->
      <div class="mb-5 flex items-center justify-center gap-2.5">
        <img :src="logoUrl" alt="TravelSync" class="w-9 h-9 object-contain rounded-lg" />
        <span class="text-xl font-bold text-[#1C1D1A] dark:text-[#D5D3CA] tracking-tight">TravelSync</span>
      </div>

      <!-- Icon -->
      <div class="w-16 h-16 rounded-full bg-[#A7A99A]/10 border border-[#A7A99A]/30 flex items-center justify-center mb-6">
        <span class="material-symbols-outlined text-[#A7A99A] text-3xl">mark_email_unread</span>
      </div>

      <!-- Title & Description -->
      <h1 class="text-2xl font-bold text-[#1C1D1A] dark:text-[#D5D3CA] mb-2">Check your inbox</h1>
      <p class="text-sm text-[#575851] dark:text-[#85867C] mb-2">
        We sent a verification link to
      </p>
      <p class="text-sm font-semibold text-[#A7A99A] mb-6 break-all">
        {{ userEmail }}
      </p>
      <p class="text-xs text-[#85867C] leading-relaxed mb-8">
        Please click the link in the email to activate your account. If you don't see it, be sure to check your spam or junk folder.
      </p>

      <!-- Actions -->
      <div class="w-full space-y-3">
        <!-- I've Verified Button -->
        <button
          @click="checkVerification"
          :disabled="checking"
          class="w-full py-3 px-4 bg-[#A7A99A] hover:bg-[#B9BBAA] text-[#171813] font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <span v-if="checking" class="w-4 h-4 border-2 border-[#171813]/30 border-t-[#171813] rounded-full animate-spin"></span>
          <span v-else class="material-symbols-outlined text-[18px]">verified</span>
          <span>{{ checking ? 'Checking...' : "I've verified my email" }}</span>
        </button>

        <!-- Resend Email Button -->
        <button
          @click="handleResend"
          :disabled="resendCooldown > 0 || sending"
          class="w-full py-3 px-4 bg-[#EFECE6] hover:bg-[#E8E6DF] dark:bg-[#22231F] dark:hover:bg-[#292A25] border border-[#D1CEC7] dark:border-[#30312C] text-[#1C1D1A] dark:text-[#D5D3CA] font-medium rounded-xl text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <span v-if="sending" class="w-4 h-4 border-2 border-[#575851]/30 border-t-[#575851] rounded-full animate-spin"></span>
          <span v-else class="material-symbols-outlined text-[18px]">send</span>
          <span>
            {{ resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend verification email' }}
          </span>
        </button>
      </div>

      <!-- Log Out / Switch Account -->
      <div class="mt-8 pt-6 border-t border-[#E3E0D8] dark:border-[#30312C] w-full flex justify-center">
        <button
          @click="handleLogout"
          class="text-xs text-[#575851] hover:text-[#1C1D1A] dark:text-[#85867C] dark:hover:text-[#D5D3CA] transition-colors flex items-center gap-1.5"
        >
          <span class="material-symbols-outlined text-[16px]">logout</span>
          <span>Sign in with another account</span>
        </button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuthStore } from '../stores/auth';
import { useToastStore } from '../stores/toast';
import { getFirebaseErrorMessage } from '../services/authService';
import logoUrl from '../assets/logo.png';

const router = useRouter();
const authStore = useAuthStore();
const toastStore = useToastStore();

const checking = ref(false);
const sending = ref(false);
const resendCooldown = ref(0);
let cooldownTimer = null;

const COOLDOWN_KEY = 'verify_email_cooldown_end';

const getStoredRemainingCooldown = () => {
  if (typeof window === 'undefined' || !window.sessionStorage) return 0;
  const storedEnd = sessionStorage.getItem(COOLDOWN_KEY);
  if (!storedEnd) return 0;
  const remaining = Math.ceil((Number(storedEnd) - Date.now()) / 1000);
  if (remaining > 0) return remaining;
  sessionStorage.removeItem(COOLDOWN_KEY);
  return 0;
};

const userEmail = computed(() => {
  return authStore.firebaseUser?.email || auth.currentUser?.email || '';
});

const startCooldown = (seconds = 60) => {
  const endTime = Date.now() + seconds * 1000;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    sessionStorage.setItem(COOLDOWN_KEY, String(endTime));
  }
  resendCooldown.value = seconds;
  clearInterval(cooldownTimer);
  cooldownTimer = setInterval(() => {
    const remaining = getStoredRemainingCooldown();
    resendCooldown.value = remaining;
    if (remaining <= 0) {
      clearInterval(cooldownTimer);
    }
  }, 1000);
};

const checkVerification = async () => {
  if (!auth.currentUser) {
    router.push('/login');
    return;
  }

  checking.value = true;
  try {
    await auth.currentUser.reload();
    if (auth.currentUser.emailVerified) {
      await auth.currentUser.getIdToken(true);
      authStore.firebaseUser = auth.currentUser;
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.removeItem(COOLDOWN_KEY);
      }
      await authStore.syncUser();
      toastStore.showToast('Email verified successfully! Welcome to TravelSync.', 'success');
      router.push('/dashboard');
    } else {
      toastStore.showToast('Your email is not verified yet. Please check your inbox and click the verification link.', 'warning');
    }
  } catch (err) {
    toastStore.showToast(getFirebaseErrorMessage(err), 'error');
  } finally {
    checking.value = false;
  }
};

const handleResend = async () => {
  if (!auth.currentUser || resendCooldown.value > 0) return;

  sending.value = true;
  try {
    await sendEmailVerification(auth.currentUser);
    startCooldown(60);
    toastStore.showToast('Verification email resent! Please check your inbox.', 'success');
  } catch (err) {
    if (err?.code === 'auth/too-many-requests') {
      startCooldown(60);
    }
    toastStore.showToast(getFirebaseErrorMessage(err), 'error');
  } finally {
    sending.value = false;
  }
};

const handleLogout = async () => {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    sessionStorage.removeItem(COOLDOWN_KEY);
  }
  try {
    await authStore.logout();
  } catch {}
  router.push('/login');
};

onMounted(() => {
  // If user is already verified or unauthenticated, redirect appropriately
  if (!authStore.firebaseUser) {
    router.push('/login');
    return;
  } else if (authStore.firebaseUser.emailVerified) {
    router.push('/dashboard');
    return;
  }

  // Resume active cooldown or start initial signup cooldown
  const remaining = getStoredRemainingCooldown();
  if (remaining > 0) {
    resendCooldown.value = remaining;
    clearInterval(cooldownTimer);
    cooldownTimer = setInterval(() => {
      const rem = getStoredRemainingCooldown();
      resendCooldown.value = rem;
      if (rem <= 0) {
        clearInterval(cooldownTimer);
      }
    }, 1000);
  } else {
    startCooldown(60);
  }
});

onUnmounted(() => {
  clearInterval(cooldownTimer);
});
</script>
