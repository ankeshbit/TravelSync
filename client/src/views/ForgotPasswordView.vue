<template>
  <div class="page relative">
    <div class="absolute top-4 right-4 z-10">
      <ThemeToggle />
    </div>
    <div class="card">
      <div class="brand">
        <img src="/logo.png" alt="TravelSync" class="brand-logo" />
        <span class="brand-name">Travel Sync</span>
      </div>

      <div class="header">
        <h1 class="title">Reset Your Password</h1>
        <p class="subtitle">
          Enter the email address associated with your account, and we'll send you a password reset link.
        </p>
      </div>

      <!-- Success State -->
      <div v-if="submitted" class="success-box">
        <span class="material-symbols-outlined success-icon">mark_email_read</span>
        <div>
          <h3 class="success-title">Check your email</h3>
          <p class="success-text">
            If an account exists for <strong>{{ email }}</strong>, you will receive a password reset link shortly.
          </p>
        </div>
      </div>

      <!-- Form State -->
      <form v-else @submit.prevent="handleSubmit" class="form">
        <div class="field">
          <label class="label" for="email">Email Address</label>
          <div class="input-wrap">
            <span class="material-symbols-outlined input-icon">mail</span>
            <input
              v-model="email"
              id="email"
              type="email"
              required
              placeholder="e.g. explorer@travelsync.com"
              class="input"
              autocomplete="email"
            />
          </div>
        </div>

        <transition name="fade">
          <div v-if="error" class="error-msg">
            <span class="material-symbols-outlined" style="font-size: 18px">error</span>
            <span>{{ error }}</span>
          </div>
        </transition>

        <button type="submit" :disabled="loading" class="btn-submit">
          <span v-if="loading" class="spinner"></span>
          <span v-else>Send Reset Link</span>
        </button>
      </form>

      <div class="footer">
        <router-link to="/login" class="back-link">
          <span class="material-symbols-outlined text-sm">arrow_back</span>
          <span>Back to Sign In</span>
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { sendResetEmail, getFirebaseErrorMessage } from '../services/authService'
import ThemeToggle from '../components/ThemeToggle.vue'

const email = ref('')
const loading = ref(false)
const error = ref('')
const submitted = ref(false)

const handleSubmit = async () => {
  error.value = ''
  if (!email.value) {
    error.value = 'Please enter your email address.'
    return
  }

  loading.value = true
  try {
    await sendResetEmail(email.value.trim())
    submitted.value = true
  } catch (err) {
    error.value = getFirebaseErrorMessage(err)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');

* { box-sizing: border-box; }

.material-symbols-outlined {
  font-family: 'Material Symbols Outlined';
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  font-style: normal;
  line-height: 1;
  display: inline-block;
}

.page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  background: #F7F6F2;
  font-family: 'Manrope', 'Inter', sans-serif;
  transition: background-color 0.2s, color 0.2s;
}

:global(.dark) .page {
  background: #111210;
  color: #D5D3CA;
}

.card {
  width: 100%;
  max-width: 440px;
  background: #FAF9F5;
  border: 1px solid #E3E0D8;
  border-radius: 1.25rem;
  padding: 2.5rem 2rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
  transition: background-color 0.2s, border-color 0.2s;
}

:global(.dark) .card {
  background: #1B1C19;
  border-color: #30312C;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.brand-logo {
  height: 34px;
  width: auto;
  object-fit: contain;
}

.brand-name {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 1.25rem;
  font-weight: 700;
  color: #1C1D1A;
}

:global(.dark) .brand-name {
  color: #D5D3CA;
}

.header { margin-bottom: 2rem; }

.title {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 1.75rem;
  font-weight: 700;
  color: #1C1D1A;
  margin-bottom: 0.5rem;
  letter-spacing: -0.02em;
}

:global(.dark) .title { color: #D5D3CA; }

.subtitle {
  font-size: 0.95rem;
  color: #575851;
  line-height: 1.5;
}

:global(.dark) .subtitle { color: #85867C; }

.form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1C1D1A;
}

:global(.dark) .label { color: #D5D3CA; }

.input-wrap { position: relative; }

.input-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: #85867C;
  font-size: 20px;
  pointer-events: none;
}

.input {
  width: 100%;
  padding: 0.85rem 1rem 0.85rem 3rem;
  font-size: 0.95rem;
  font-family: inherit;
  background: #FAF9F5 !important;
  border: 1.5px solid #D1CEC7;
  border-radius: 0.75rem;
  color: #1C1D1A !important;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}

:global(.dark) .input {
  background: #141512 !important;
  border-color: #30312C;
  color: #D5D3CA !important;
}

.input::placeholder { color: #85867C !important; }
:global(.dark) .input::placeholder { color: #85867C !important; }

.input:focus {
  background: #FFFFFF !important;
  border-color: #A7A99A;
  box-shadow: 0 0 0 3px rgba(167, 169, 154, 0.15);
}

:global(.dark) .input:focus {
  background: #141512 !important;
  border-color: #A7A99A;
  box-shadow: 0 0 0 3px rgba(167, 169, 154, 0.15);
}

.btn-submit {
  width: 100%;
  padding: 0.85rem 1rem;
  background: #A7A99A;
  color: #171813;
  font-size: 0.95rem;
  font-weight: 600;
  border: none;
  border-radius: 0.75rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: background-color 0.2s, transform 0.15s;
}

:global(.dark) .btn-submit {
  background: #A7A99A;
  color: #171813;
}

.btn-submit:hover:not(:disabled) {
  background: #B9BBAA;
  transform: translateY(-1px);
}

.btn-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner {
  display: inline-block;
  width: 18px;
  height: 18px;
  border: 2.5px solid rgba(23, 24, 19, 0.3);
  border-top-color: #171813;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.success-box {
  display: flex;
  gap: 1rem;
  padding: 1.25rem;
  background: rgba(134, 169, 139, 0.12);
  border: 1px solid rgba(134, 169, 139, 0.3);
  border-radius: 0.85rem;
  color: #86A98B;
  margin-bottom: 1.5rem;
}

:global(.dark) .success-box {
  background: rgba(134, 169, 139, 0.12);
  border-color: rgba(134, 169, 139, 0.3);
  color: #86A98B;
}

.success-icon {
  font-size: 28px;
  color: #86A98B;
  flex-shrink: 0;
}

.success-title {
  font-weight: 700;
  font-size: 1rem;
  margin-bottom: 0.25rem;
}

.success-text {
  font-size: 0.875rem;
  line-height: 1.5;
}

.error-msg {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(199, 127, 120, 0.12);
  border: 1px solid rgba(199, 127, 120, 0.3);
  color: #C77F78;
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
}

:global(.dark) .error-msg {
  background: rgba(199, 127, 120, 0.12);
  border-color: rgba(199, 127, 120, 0.3);
  color: #C77F78;
}

.footer {
  margin-top: 2rem;
  text-align: center;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: #575851;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.875rem;
  transition: color 0.2s;
}

:global(.dark) .back-link { color: #A7A99A; }
.back-link:hover { text-decoration: underline; color: #1C1D1A; }
:global(.dark) .back-link:hover { color: #B9BBAA; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
