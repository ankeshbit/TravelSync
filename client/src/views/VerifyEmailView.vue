<template>
  <div class="min-h-screen bg-[#070D18] flex items-center justify-center p-4">
    <div class="w-full max-w-md bg-[#0F172A] border border-[#1E2E4E] rounded-2xl p-8 shadow-2xl flex flex-col items-center text-center">
      
      <!-- Icon -->
      <div class="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mb-6">
        <span class="material-symbols-outlined text-blue-400 text-3xl">mark_email_unread</span>
      </div>

      <!-- Title & Description -->
      <h1 class="text-2xl font-bold text-white mb-2">Check your inbox</h1>
      <p class="text-sm text-slate-300 mb-2">
        We sent a verification link to
      </p>
      <p class="text-sm font-semibold text-blue-400 mb-6 break-all">
        {{ userEmail }}
      </p>
      <p class="text-xs text-slate-400 leading-relaxed mb-8">
        Please click the link in the email to activate your account. If you don't see it, be sure to check your spam or junk folder.
      </p>

      <!-- Actions -->
      <div class="w-full space-y-3">
        <!-- I've Verified Button -->
        <button
          @click="checkVerification"
          :disabled="checking"
          class="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <span v-if="checking" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          <span v-else class="material-symbols-outlined text-[18px]">verified</span>
          <span>{{ checking ? 'Checking...' : "I've verified my email" }}</span>
        </button>

        <!-- Resend Email Button -->
        <button
          @click="handleResend"
          :disabled="resendCooldown > 0 || sending"
          class="w-full py-3 px-4 bg-[#162036] hover:bg-[#1E2E4E] border border-[#24355A] text-slate-200 font-medium rounded-xl text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <span v-if="sending" class="w-4 h-4 border-2 border-slate-300/30 border-t-slate-300 rounded-full animate-spin"></span>
          <span v-else class="material-symbols-outlined text-[18px]">send</span>
          <span>
            {{ resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend verification email' }}
          </span>
        </button>
      </div>

      <!-- Log Out / Switch Account -->
      <div class="mt-8 pt-6 border-t border-[#1E2E4E] w-full flex justify-center">
        <button
          @click="handleLogout"
          class="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
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

const router = useRouter();
const authStore = useAuthStore();
const toastStore = useToastStore();

const checking = ref(false);
const sending = ref(false);
const resendCooldown = ref(0);
let cooldownTimer = null;

const userEmail = computed(() => {
  return authStore.firebaseUser?.email || auth.currentUser?.email || '';
});

const startCooldown = (seconds = 60) => {
  resendCooldown.value = seconds;
  clearInterval(cooldownTimer);
  cooldownTimer = setInterval(() => {
    resendCooldown.value--;
    if (resendCooldown.value <= 0) {
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
      await authStore.syncUser();
      toastStore.showToast('Email verified successfully! Welcome to TravelSync.', 'success');
      router.push('/dashboard');
    } else {
      toastStore.showToast('Your email is not verified yet. Please check your inbox and click the verification link.', 'warning');
    }
  } catch (err) {
    toastStore.showToast(err.message || 'Failed to check verification status.', 'error');
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
    toastStore.showToast(err.message || 'Failed to resend verification email.', 'error');
  } finally {
    sending.value = false;
  }
};

const handleLogout = async () => {
  try {
    await authStore.logout();
  } catch {}
  router.push('/login');
};

onMounted(() => {
  // If user is already verified or unauthenticated, redirect appropriately
  if (!authStore.firebaseUser) {
    router.push('/login');
  } else if (authStore.firebaseUser.emailVerified) {
    router.push('/dashboard');
  }
});

onUnmounted(() => {
  clearInterval(cooldownTimer);
});
</script>
