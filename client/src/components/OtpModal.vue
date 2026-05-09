<template>
  <!-- Full-screen dark overlay -->
  <Teleport to="body">
    <div
      v-if="visible"
      style="
        position: fixed; inset: 0; z-index: 10000;
        display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.72); padding: 16px;
        backdrop-filter: blur(6px);
      "
    >
      <div class="otp-card">
        <!-- Icon -->
        <div class="otp-icon-wrap">
          <span class="material-symbols-outlined otp-icon">mark_email_read</span>
        </div>

        <h2 class="otp-title">Check your email</h2>
        <p class="otp-sub">
          We sent a 6-digit code to<br />
          <strong class="otp-email">{{ email }}</strong>
        </p>

        <!-- 6 individual digit boxes -->
        <div class="otp-boxes" @paste.prevent="onPaste">
          <input
            v-for="i in 6"
            :key="i"
            :ref="el => { if (el) inputs[i-1] = el }"
            v-model="digits[i-1]"
            type="text"
            inputmode="numeric"
            maxlength="1"
            class="otp-box"
            :class="{ 'otp-box--error': hasError }"
            @keydown="onKeydown($event, i-1)"
            @input="onInput($event, i-1)"
            @focus="$event.target.select()"
          />
        </div>

        <!-- Error message -->
        <transition name="otp-fade">
          <div v-if="errorMsg" class="otp-error">
            <span class="material-symbols-outlined" style="font-size:16px">error</span>
            {{ errorMsg }}
          </div>
        </transition>

        <!-- Verify button -->
        <button
          class="otp-btn-verify"
          :disabled="otpValue.length < 6 || verifying"
          @click="handleVerify"
        >
          <span v-if="verifying" class="otp-spinner"></span>
          <span v-else>Verify &amp; Continue</span>
        </button>

        <!-- Resend -->
        <div class="otp-resend">
          <span v-if="resendCountdown > 0" class="otp-resend-wait">
            Resend code in {{ resendCountdown }}s
          </span>
          <button
            v-else
            class="otp-resend-btn"
            :disabled="sendingResend"
            @click="handleResend"
          >
            <span v-if="sendingResend" class="otp-spinner otp-spinner--sm"></span>
            <span v-else>Resend Code</span>
          </button>
        </div>

        <!-- Cancel -->
        <button class="otp-btn-cancel" @click="$emit('cancel')">Cancel</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue';
import api from '../api';

const props = defineProps({
  visible:  { type: Boolean, default: false },
  email:    { type: String,  required: true },
  purpose:  { type: String,  required: true }, // 'register' | 'delete'
});

const emit = defineEmits(['verified', 'cancel']);

// ── State ──────────────────────────────────────────────────────────────────────
const digits       = ref(Array(6).fill(''));
const inputs       = ref([]);
const errorMsg     = ref('');
const hasError     = ref(false);
const verifying    = ref(false);
const sendingResend = ref(false);
const resendCountdown = ref(0);
let countdownTimer = null;

const otpValue = computed(() => digits.value.join(''));

// ── Countdown timer ────────────────────────────────────────────────────────────
function startCountdown(seconds = 60) {
  resendCountdown.value = seconds;
  clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    resendCountdown.value--;
    if (resendCountdown.value <= 0) clearInterval(countdownTimer);
  }, 1000);
}

// ── Watch visibility ───────────────────────────────────────────────────────────
watch(() => props.visible, (val) => {
  if (val) {
    digits.value = Array(6).fill('');
    errorMsg.value = '';
    hasError.value = false;
    startCountdown(60);
    // Focus first box after DOM update
    setTimeout(() => inputs.value[0]?.focus(), 50);
  }
});

onUnmounted(() => clearInterval(countdownTimer));

// ── Input handlers ─────────────────────────────────────────────────────────────
function onInput(e, idx) {
  const val = e.target.value.replace(/\D/g, '');
  digits.value[idx] = val.slice(-1);
  errorMsg.value = '';
  hasError.value = false;
  if (val && idx < 5) inputs.value[idx + 1]?.focus();
}

function onKeydown(e, idx) {
  if (e.key === 'Backspace' && !digits.value[idx] && idx > 0) {
    digits.value[idx - 1] = '';
    inputs.value[idx - 1]?.focus();
  }
  if (e.key === 'ArrowLeft' && idx > 0)  inputs.value[idx - 1]?.focus();
  if (e.key === 'ArrowRight' && idx < 5) inputs.value[idx + 1]?.focus();
}

function onPaste(e) {
  const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
  for (let i = 0; i < 6; i++) digits.value[i] = text[i] || '';
  const nextEmpty = text.length < 6 ? text.length : 5;
  inputs.value[nextEmpty]?.focus();
}

// ── Verify ─────────────────────────────────────────────────────────────────────
async function handleVerify() {
  if (otpValue.value.length < 6) return;
  verifying.value = true;
  errorMsg.value = '';
  try {
    await api.post('/auth/verify-otp', {
      email: props.email,
      otp: otpValue.value,
      purpose: props.purpose,
    });
    emit('verified'); // tell parent to proceed
  } catch (err) {
    errorMsg.value = err.response?.data?.message || 'Invalid code. Please try again.';
    hasError.value = true;
    digits.value = Array(6).fill('');
    setTimeout(() => inputs.value[0]?.focus(), 50);
  } finally {
    verifying.value = false;
  }
}

// ── Resend ─────────────────────────────────────────────────────────────────────
async function handleResend() {
  sendingResend.value = true;
  errorMsg.value = '';
  try {
    await api.post('/auth/send-otp', { email: props.email, purpose: props.purpose });
    digits.value = Array(6).fill('');
    hasError.value = false;
    startCountdown(60);
    setTimeout(() => inputs.value[0]?.focus(), 50);
  } catch (err) {
    errorMsg.value = err.response?.data?.message || 'Failed to resend code.';
  } finally {
    sendingResend.value = false;
  }
}
</script>

<style scoped>
/* ── Card ── */
.otp-card {
  background: #0f172a;
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 20px;
  padding: 40px 36px 32px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 32px 64px rgba(0,0,0,0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}

/* ── Icon ── */
.otp-icon-wrap {
  width: 64px; height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00355f, #0891b2);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 20px;
  box-shadow: 0 8px 24px rgba(8,145,178,0.35);
}
.otp-icon { color: #fff; font-size: 32px; }

/* ── Text ── */
.otp-title {
  color: #f1f5f9;
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 8px;
  letter-spacing: -0.02em;
}
.otp-sub {
  color: #94a3b8;
  font-size: 0.9rem;
  text-align: center;
  line-height: 1.6;
  margin: 0 0 28px;
}
.otp-email { color: #38bdf8; font-weight: 700; }

/* ── Digit Boxes ── */
.otp-boxes {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}
.otp-box {
  width: 48px; height: 56px;
  border-radius: 12px;
  border: 2px solid rgba(255,255,255,0.12);
  background: #1e293b;
  color: #f1f5f9;
  font-size: 1.5rem;
  font-weight: 700;
  text-align: center;
  caret-color: #38bdf8;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  font-variant-numeric: tabular-nums;
}
.otp-box:focus {
  border-color: #38bdf8;
  box-shadow: 0 0 0 3px rgba(56,189,248,0.18);
}
.otp-box--error {
  border-color: #ef4444 !important;
  box-shadow: 0 0 0 3px rgba(239,68,68,0.18) !important;
  animation: shake 0.35s ease;
}
@keyframes shake {
  0%,100% { transform: translateX(0); }
  20%      { transform: translateX(-5px); }
  60%      { transform: translateX(5px); }
}

/* ── Error ── */
.otp-error {
  display: flex; align-items: center; gap: 6px;
  background: rgba(239,68,68,0.12);
  border: 1px solid rgba(239,68,68,0.30);
  color: #fca5a5;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 0.85rem;
  width: 100%;
  margin-bottom: 12px;
}

/* ── Verify button ── */
.otp-btn-verify {
  width: 100%;
  background: linear-gradient(135deg, #00355f, #0891b2);
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
  font-family: inherit;
  padding: 14px;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  gap: 8px;
  transition: opacity 0.2s, transform 0.15s;
  margin-top: 4px;
  box-shadow: 0 4px 16px rgba(0,53,95,0.4);
}
.otp-btn-verify:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
.otp-btn-verify:disabled { opacity: 0.45; cursor: not-allowed; }

/* ── Resend ── */
.otp-resend {
  margin-top: 16px;
  font-size: 0.875rem;
  color: #64748b;
  text-align: center;
  min-height: 24px;
}
.otp-resend-wait { color: #64748b; }
.otp-resend-btn {
  background: none; border: none;
  color: #38bdf8; font-weight: 700;
  font-size: 0.875rem; font-family: inherit;
  cursor: pointer; padding: 0;
  display: inline-flex; align-items: center; gap: 6px;
  transition: opacity 0.2s;
}
.otp-resend-btn:hover:not(:disabled) { opacity: 0.75; }
.otp-resend-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Cancel ── */
.otp-btn-cancel {
  background: none; border: none;
  color: #64748b; font-size: 0.875rem; font-family: inherit;
  cursor: pointer; padding: 4px;
  margin-top: 8px;
  transition: color 0.2s;
}
.otp-btn-cancel:hover { color: #94a3b8; }

/* ── Spinner ── */
.otp-spinner {
  display: inline-block;
  width: 18px; height: 18px;
  border: 2.5px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
.otp-spinner--sm { width: 14px; height: 14px; border-width: 2px; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Fade transition ── */
.otp-fade-enter-active, .otp-fade-leave-active { transition: opacity 0.2s; }
.otp-fade-enter-from, .otp-fade-leave-to { opacity: 0; }
</style>
