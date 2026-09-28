<template>
  <div class="page">
    <header class="header">
      <div class="header-inner">
        <div class="brand">
          <img src="/logo.png" alt="TravelSync" class="brand-logo object-contain" />
          <span class="brand-text">Travel Sync</span>
        </div>
        <nav class="header-nav">
          <router-link class="nav-link" to="/login">Sign In</router-link>
        </nav>
      </div>
    </header>

    <main class="main">
      <div class="card">
        <!-- Left Panel -->
        <div class="panel-left">
          <div class="panel-overlay"></div>
          <img class="panel-bg" alt="Travel Planning"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDFJ-4auFJTAdNrwz9HV4JiYSDFnQsTf49wTNiXVcAau0QmPky-qZEQ88hUcGoBnRNbRI19bs4szbDh5qlVXfAbQ8iWa4Eu_5OXMb_CWAzz2GgVG6GDGzZET1wkkFom1F0fvTaD5FA2iGrDI4Xl2vyyP-ugfrqhjRYRXLfFz-cY6aODVnGivE1O5uXpx-6MMVhu4CumfkYnulszdf2fgnfpIWqu4brq9vE2quzxuGF0kbp0KYx3pq6eIAQq8sf55aO7nChjeuASvQ" />
          <div class="panel-body">
            <h2 class="panel-title">Start your synchronized journey today.</h2>
            <p class="panel-sub">Every detail of your travel itinerary, perfectly synced across all your devices and fellow travelers.</p>
            <div class="features">
              <div class="feature">
                <div class="feature-icon"><span class="material-symbols-outlined">sync</span></div>
                <span>Real-time team collaboration</span>
              </div>
              <div class="feature">
                <div class="feature-icon"><span class="material-symbols-outlined">cloud_done</span></div>
                <span>Offline access to itineraries</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Panel -->
        <div class="panel-right">
          <div class="form-wrapper">
            <div class="form-header">
              <h1 class="form-title">Create Account</h1>
              <p class="form-sub">Join thousands of travelers planning with Sync.</p>
            </div>

            <!-- Google Sign-Up Button -->
            <button
              class="google-btn"
              type="button"
              @click="handleGoogleRegister"
              :disabled="loading"
            >
              <span v-if="loadingGoogle" class="spinner-google"></span>
              <template v-else>
                <svg viewBox="0 0 24 24" class="google-logo">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span>Sign up with Google</span>
              </template>
            </button>

            <div class="divider">
              <div class="divider-line"></div>
              <span class="divider-text">Or sign up with email</span>
              <div class="divider-line"></div>
            </div>

            <!-- Email Registration Form -->
            <form @submit.prevent="handleRegister" class="form">
              <div class="field">
                <label class="field-label">Full Name</label>
                <div class="input-wrap">
                  <span class="input-icon material-symbols-outlined">person</span>
                  <input v-model="form.name" type="text" required placeholder="John Doe" class="input" />
                </div>
              </div>

              <div class="field">
                <label class="field-label">Email Address</label>
                <div class="input-wrap">
                  <span class="input-icon material-symbols-outlined">mail</span>
                  <input v-model="form.email" type="email" required placeholder="name@example.com" class="input" />
                </div>
              </div>

              <div class="field-row">
                <div class="field">
                  <label class="field-label">Password</label>
                  <div class="input-wrap">
                    <span class="input-icon material-symbols-outlined">lock</span>
                    <input v-model="form.password" type="password" required placeholder="••••••••" class="input" />
                  </div>
                </div>
                <div class="field">
                  <label class="field-label">Confirm</label>
                  <div class="input-wrap">
                    <span class="input-icon material-symbols-outlined">lock_reset</span>
                    <input v-model="form.confirmPassword" type="password" required placeholder="••••••••" class="input" />
                  </div>
                </div>
              </div>

              <div class="terms">
                <input v-model="form.terms" id="terms" type="checkbox" class="checkbox" />
                <label for="terms">
                  I agree to the <a href="#">Terms &amp; Conditions</a> and <a href="#">Privacy Policy</a>
                </label>
              </div>

              <transition name="fade">
                <div v-if="error" class="error-msg">
                  <span class="material-symbols-outlined" style="font-size:18px">error</span>
                  <span>{{ error }}</span>
                </div>
              </transition>

              <button :disabled="loading" type="submit" class="btn-submit">
                <span v-if="loadingEmail" class="spinner"></span>
                <span v-else>Create Account</span>
              </button>
            </form>

            <p class="signin-link">
              Already have an account?
              <router-link to="/login">Sign in</router-link>
            </p>
          </div>
        </div>
      </div>
    </main>

    <footer class="footer">
      <div class="footer-inner">
        <span>© 2024 Travel Sync. All rights reserved.</span>
        <div class="footer-links">
          <a href="#">Help Center</a>
          <a href="#">Security</a>
          <a href="#">Privacy</a>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { getFirebaseErrorMessage } from '../services/authService'

const router = useRouter()
const authStore = useAuthStore()
const form = ref({ name: '', email: '', password: '', confirmPassword: '', terms: false })
const loading = ref(false)
const loadingEmail = ref(false)
const loadingGoogle = ref(false)
const error = ref('')

const handleRegister = async () => {
  error.value = ''
  if (!form.value.name || !form.value.email || !form.value.password || !form.value.confirmPassword) {
    error.value = 'Please fill in all fields.'
    return
  }
  if (form.value.password.length < 6) {
    error.value = 'Password must be at least 6 characters.'
    return
  }
  if (form.value.password !== form.value.confirmPassword) {
    error.value = 'Passwords do not match.'
    return
  }
  if (!form.value.terms) {
    error.value = 'Please accept the Terms & Conditions.'
    return
  }
  loading.value = true
  loadingEmail.value = true
  try {
    await authStore.registerWithEmail(form.value.name.trim(), form.value.email.trim(), form.value.password)
    router.push('/dashboard')
  } catch (err) {
    error.value = getFirebaseErrorMessage(err)
  } finally {
    loading.value = false
    loadingEmail.value = false
  }
}

const handleGoogleRegister = async () => {
  error.value = ''
  loading.value = true
  loadingGoogle.value = true
  try {
    await authStore.loginWithGoogle()
    router.push('/dashboard')
  } catch (err) {
    error.value = getFirebaseErrorMessage(err)
  } finally {
    loading.value = false
    loadingGoogle.value = false
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
  background: #f9f9ff;
  font-family: 'Manrope', 'Inter', sans-serif;
  color: #161c27;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  transition: background-color 0.2s, color 0.2s;
}

:global(.dark) .page {
  background: #020617;
  color: #f1f5f9;
}

/* ── Header ── */
.header {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 1px 4px rgba(0, 53, 95, 0.06);
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 50;
  transition: background-color 0.2s, border-color 0.2s;
}

:global(.dark) .header {
  background: rgba(15, 23, 42, 0.8);
  border-bottom-color: rgba(30, 41, 59, 0.5);
}
.header-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  max-width: 1280px;
  margin: 0 auto;
}
.brand {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.brand-logo {
  height: 36px;
  width: auto;
  object-fit: contain;
  mix-blend-mode: multiply;
}
.brand-text {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 1.25rem;
  font-weight: 800;
  color: #00355f;
  letter-spacing: -0.02em;
}
:global(.dark) .brand-text {
  color: #38bdf8;
}
.header-nav { display: flex; gap: 1rem; align-items: center; }
.nav-link {
  font-size: 0.875rem;
  font-weight: 600;
  color: #00355f;
  padding: 0.5rem 1.25rem;
  border-radius: 0.5rem;
  border: 1.5px solid #00355f;
  text-decoration: none;
  transition: all 0.2s ease;
}
.nav-link:hover { background: #00355f; color: #fff; }
:global(.dark) .nav-link { color: #38bdf8; border-color: #38bdf8; }
:global(.dark) .nav-link:hover { background: #38bdf8; color: #020617; }

/* ── Main ── */
.main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6rem 1rem 2rem;
  background: #f9f9ff;
  transition: background-color 0.2s;
}
:global(.dark) .main { background: #020617; }

/* ── Card ── */
.card {
  width: 100%;
  max-width: 960px;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 1.5rem;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 53, 95, 0.12);
  margin-bottom: 2rem;
  transition: background-color 0.2s, border-color 0.2s;
}
:global(.dark) .card {
  background: rgba(15, 23, 42, 0.8);
  border-color: rgba(30, 41, 59, 0.5);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}
@media (min-width: 768px) {
  .card { flex-direction: row; }
}

/* ── Left Panel ── */
.panel-left {
  display: none;
  position: relative;
  overflow: hidden;
  background: #00355f;
}
@media (min-width: 768px) {
  .panel-left { display: block; width: 50%; min-height: 560px; }
}
.panel-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(135deg, #00355f 0%, #006970 100%);
  opacity: 0.9;
  mix-blend-mode: multiply;
  z-index: 1;
}
.panel-bg {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;
}
.panel-body {
  position: relative; z-index: 2;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 3rem;
  color: #fff;
}
.panel-title {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 2.15rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
  margin-bottom: 1rem;
}
.panel-sub {
  font-size: 1.05rem;
  line-height: 1.6;
  opacity: 0.9;
  max-width: 320px;
}
.features { margin-top: 2.5rem; display: flex; flex-direction: column; gap: 1.25rem; }
.feature { display: flex; align-items: center; gap: 1rem; font-size: 0.875rem; font-weight: 600; }
.feature-icon {
  width: 40px; height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

/* ── Right Panel ── */
.panel-right {
  width: 100%;
  background: rgba(255, 255, 255, 0.4);
  padding: 2.5rem;
  transition: background-color 0.2s;
}
:global(.dark) .panel-right {
  background: transparent;
}
@media (min-width: 768px) { .panel-right { width: 50%; padding: 3rem 2.5rem; } }

.form-wrapper { max-width: 420px; margin: 0 auto; }
.form-header { margin-bottom: 1.5rem; text-align: left; }

.form-title {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 2rem;
  font-weight: 700;
  color: #00355f;
  letter-spacing: -0.02em;
  margin-bottom: 0.35rem;
}
:global(.dark) .form-title { color: #f1f5f9; }
.form-sub { font-size: 0.95rem; color: #42474f; }
:global(.dark) .form-sub { color: #94a3b8; }

/* Google Button */
.google-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.85rem 1.25rem;
  background: #ffffff;
  border: 1.5px solid #e2e8f0;
  border-radius: 0.75rem;
  font-size: 0.95rem;
  font-weight: 600;
  font-family: inherit;
  color: #161c27;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
:global(.dark) .google-btn {
  background: #1e293b;
  border-color: #334155;
  color: #f8fafc;
}
.google-btn:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #cbd5e1;
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
}
:global(.dark) .google-btn:hover:not(:disabled) {
  background: #273549;
  border-color: #475569;
}
.google-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
.google-logo { width: 20px; height: 20px; flex-shrink: 0; }

.spinner-google {
  display: inline-block;
  width: 18px;
  height: 18px;
  border: 2px solid rgba(2, 132, 199, 0.25);
  border-top-color: #0284c7;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

/* Divider */
.divider {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 1.5rem 0;
}
.divider-line { flex: 1; height: 1px; background: rgba(194, 199, 209, 0.4); }
:global(.dark) .divider-line { background: rgba(51, 65, 85, 0.4); }
.divider-text {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #64748b;
  white-space: nowrap;
}
:global(.dark) .divider-text { color: #94a3b8; }

/* ── Form ── */
.form { display: flex; flex-direction: column; gap: 1.15rem; }
.field { display: flex; flex-direction: column; gap: 0.4rem; }
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
@media (max-width: 480px) { .field-row { grid-template-columns: 1fr; } }

.field-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #42474f;
}
:global(.dark) .field-label { color: #e2e8f0; }

.input-wrap { position: relative; }
.input-icon {
  position: absolute;
  left: 12px; top: 50%;
  transform: translateY(-50%);
  color: #727780;
  font-size: 20px;
  pointer-events: none;
}
.input-wrap:focus-within .input-icon { color: #00355f; }
:global(.dark) .input-wrap:focus-within .input-icon { color: #38bdf8; }

.input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 2.75rem;
  font-size: 0.95rem;
  font-family: inherit;
  background: #F7FAFC !important;
  border: 2px solid transparent;
  border-radius: 0.75rem;
  color: #000000 !important;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}
:global(.dark) .input {
  background: #1e293b !important;
  color: #ffffff !important;
}
.input::placeholder { color: #b0b8bc !important; }
:global(.dark) .input::placeholder { color: #94a3b8 !important; }
.input:focus {
  background: #fff !important;
  border-color: #a0c9ff;
  box-shadow: 0 0 0 4px rgba(160, 201, 255, 0.2);
}
:global(.dark) .input:focus {
  background: #0f172a !important;
  border-color: #38bdf8;
  box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.1);
}

/* ── Terms ── */
.terms { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.25rem 0; }
.checkbox {
  width: 18px; height: 18px;
  margin-top: 2px;
  accent-color: #00355f;
  cursor: pointer;
  flex-shrink: 0;
}
.terms label { font-size: 0.85rem; color: #42474f; line-height: 1.4; cursor: pointer; }
:global(.dark) .terms label { color: #94a3b8; }
.terms a { color: #00355f; font-weight: 600; text-decoration: none; }
:global(.dark) .terms a { color: #38bdf8; }
.terms a:hover { text-decoration: underline; }

/* ── Error ── */
.error-msg {
  display: flex; align-items: center; gap: 0.5rem;
  background: #fff0f0;
  border: 1px solid #fecaca;
  color: #b91c1c;
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
}
:global(.dark) .error-msg {
  background: #450a0a;
  border-color: #7f1d1d;
  color: #fca5a5;
}

/* ── Submit Button ── */
.btn-submit {
  width: 100%;
  background: linear-gradient(135deg, #00355f 0%, #006970 100%);
  color: #fff;
  font-size: 0.95rem;
  font-weight: 600;
  font-family: inherit;
  padding: 0.9rem;
  border: none;
  border-radius: 0.75rem;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0, 53, 95, 0.2);
  display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  transition: opacity 0.2s, transform 0.15s;
}
:global(.dark) .btn-submit {
  background: linear-gradient(135deg, #0369a1 0%, #0891b2 100%);
}
.btn-submit:hover:not(:disabled) { opacity: 0.95; transform: translateY(-1px); }
.btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

/* ── Spinner ── */
.spinner {
  display: inline-block;
  width: 18px; height: 18px;
  border: 2.5px solid rgba(255,255,255,0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Sign In Link ── */
.signin-link {
  margin-top: 1.5rem;
  text-align: center;
  font-size: 0.95rem;
  color: #42474f;
}
:global(.dark) .signin-link { color: #94a3b8; }
.signin-link a {
  color: #00355f;
  font-weight: 700;
  text-decoration: none;
  margin-left: 4px;
}
:global(.dark) .signin-link a { color: #38bdf8; }
.signin-link a:hover { text-decoration: underline; }

/* ── Footer ── */
.footer {
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(8px);
  transition: background-color 0.2s;
}
:global(.dark) .footer { background: rgba(15, 23, 42, 0.8); }
.footer-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  font-size: 0.875rem;
  color: #42474f;
}
:global(.dark) .footer-inner { color: #94a3b8; }
@media (min-width: 768px) {
  .footer-inner { flex-direction: row; justify-content: space-between; }
}
.footer-links { display: flex; gap: 1.5rem; }
.footer-links a { color: #42474f; text-decoration: none; font-weight: 600; font-size: 0.875rem; transition: color 0.2s; }
:global(.dark) .footer-links a { color: #94a3b8; }
.footer-links a:hover { color: #00355f; }
:global(.dark) .footer-links a:hover { color: #38bdf8; }

/* ── Transitions ── */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
