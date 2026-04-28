<template>
  <div class="page">
    <div class="layout">

      <!-- ── Left Panel ── -->
      <section class="panel-left">
        <div class="panel-bg">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAEPqQ85CzDi-jgDSCZi-B2cSYgbM_xJ1NPT4pre3MNG455UWwtKqak476EB62N1Yh1Jiv3IdQoqa6aaBnNOtIE8yT435g4_mAET4EHfH0UbGsOY-CrQt8Fu0mp54w2p3a7VHK370xSKTTQioyuf_O1rIWX-q-npHZbuhClukhCKy13IWAqkPJPMOR7BBFwwKltftR1q-IEyyS06jUKaSZn6EpicYQabYO-taZoCHj7XZXW05Lk_F-CriGNmd91KtLmxsggh3Krxg"
            alt="Travel Adventure"
            class="panel-img"
          />
          <div class="panel-gradient"></div>
        </div>

        <div class="panel-brand">
          <img src="/logo.png" alt="TravelSync" class="panel-brand-logo object-contain" />
          <span class="brand-name">Travel Sync</span>
        </div>

        <div class="panel-hero">
          <h1 class="hero-title">Your journey, perfectly aligned.</h1>
          <p class="hero-sub">Connect with fellow travelers, sync your itineraries, and discover the world's best kept secrets in one unified platform.</p>
          <div class="chips">
            <div class="chip">
              <span class="material-symbols-outlined chip-icon">flight_takeoff</span>
              <span>Smart Sync</span>
            </div>
            <div class="chip">
              <span class="material-symbols-outlined chip-icon">group</span>
              <span>Group Travel</span>
            </div>
            <div class="chip">
              <span class="material-symbols-outlined chip-icon">map</span>
              <span>Offline Maps</span>
            </div>
          </div>
        </div>

        <div class="panel-footer">
          <p class="trusted-text">Trusted by 50k+ Explorers</p>
        </div>
      </section>

      <!-- ── Right Panel ── -->
      <section class="panel-right">
        <div class="form-container">

          <!-- Mobile Branding -->
          <div class="mobile-brand">
            <img src="/logo.png" alt="TravelSync" class="mobile-brand-logo object-contain" />
            <span class="mobile-brand-name">Travel Sync</span>
          </div>

          <div class="form-header">
            <h2 class="form-title">Welcome Back</h2>
            <p class="form-sub">Sign in to continue your global adventure.</p>
          </div>

          <form @submit.prevent="handleLogin" class="form">
            <!-- Email -->
            <div class="field">
              <label class="field-label" for="username">Email or Username</label>
              <div class="input-wrap">
                <span class="input-icon material-symbols-outlined">person</span>
                <input
                  v-model="form.email"
                  id="username"
                  type="text"
                  placeholder="e.g. explorer@travelsync.com"
                  class="input"
                  autocomplete="email"
                />
              </div>
            </div>

            <!-- Password -->
            <div class="field">
              <div class="field-label-row">
                <label class="field-label" for="password">Password</label>
                <a href="#" class="forgot-link">Forgot Password?</a>
              </div>
              <div class="input-wrap">
                <span class="input-icon material-symbols-outlined">lock</span>
                <input
                  v-model="form.password"
                  id="password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="Enter your password"
                  class="input input-password"
                  autocomplete="current-password"
                />
                <button type="button" class="visibility-btn" @click="showPassword = !showPassword">
                  <span class="material-symbols-outlined">{{ showPassword ? 'visibility_off' : 'visibility' }}</span>
                </button>
              </div>
            </div>

            <!-- Remember Me -->
            <div class="remember">
              <input v-model="form.remember" id="remember" type="checkbox" class="checkbox" />
              <label for="remember" class="remember-label">Remember me for 30 days</label>
            </div>

            <!-- Error -->
            <transition name="fade">
              <div v-if="error" class="error-msg">
                <span class="material-symbols-outlined" style="font-size:18px">error</span>
                {{ error }}
              </div>
            </transition>

            <!-- Submit -->
            <button :disabled="loading" type="submit" class="btn-submit">
              <span v-if="loading" class="spinner"></span>
              <template v-else>
                Sign In
                <span class="material-symbols-outlined" style="font-size:18px">arrow_forward</span>
              </template>
            </button>
          </form>

          <!-- Divider -->
          <div class="divider">
            <div class="divider-line"></div>
            <span class="divider-text">Or continue with</span>
            <div class="divider-line"></div>
          </div>

          <!-- Social Buttons -->
          <div class="social-grid">
            <button class="social-btn" type="button">
              <svg class="social-logo" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>
            <button class="social-btn" type="button">
              <svg class="social-logo" viewBox="0 0 24 24" fill="#1877F2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Facebook
            </button>
          </div>

          <p class="signup-link">
            Don't have an account?
            <router-link to="/register">Create Account</router-link>
          </p>
        </div>
      </section>
    </div>

    <!-- Help FAB -->
    <button class="fab" type="button" aria-label="Help Center">
      <span class="material-symbols-outlined">help_center</span>
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api.js'

const router = useRouter()
const form = ref({ email: '', password: '', remember: false })
const loading = ref(false)
const error = ref('')
const showPassword = ref(false)

const handleLogin = async () => {
  error.value = ''
  if (!form.value.email || !form.value.password) {
    error.value = 'Please fill in all fields.'; return
  }
  loading.value = true
  try {
    const res = await api.post('/auth/login', {
      email: form.value.email,
      password: form.value.password,
    })
    localStorage.setItem('token', res.data.token)
    localStorage.setItem('user', JSON.stringify(res.data.user))
    router.push('/dashboard')
  } catch (err) {
    error.value = err.response?.data?.message || 'Login failed. Please check your credentials.'
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
  background: #f9f9ff;
  font-family: 'Manrope', 'Inter', sans-serif;
  color: #161c27;
  overflow-x: hidden;
}

/* ── Layout ── */
.layout {
  display: flex;
  min-height: 100vh;
}

/* ── Left Panel ── */
.panel-left {
  display: none;
  position: relative;
  flex-direction: column;
  justify-content: space-between;
  padding: 2rem;
  overflow: hidden;
}
@media (min-width: 1024px) {
  .panel-left { display: flex; width: 50%; }
}

.panel-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
}
.panel-img {
  width: 100%; height: 100%;
  object-fit: cover;
}
.panel-gradient {
  position: absolute; inset: 0;
  background: linear-gradient(to top right, rgba(0,53,95,0.85) 0%, rgba(0,53,95,0.45) 50%, transparent 100%);
}

.panel-brand {
  position: relative; z-index: 2;
  display: flex; align-items: center; gap: 0.75rem;
}
.panel-brand-logo {
  height: 40px;
  width: auto;
  object-fit: contain;
  mix-blend-mode: multiply;
  filter: brightness(1.1);
}
.brand-name {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 1.25rem;
  font-weight: 700;
  color: white;
  letter-spacing: -0.02em;
}

.panel-hero {
  position: relative; z-index: 2;
  max-width: 480px;
  margin-bottom: 4rem;
}
.hero-title {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 2.5rem;
  font-weight: 700;
  color: white;
  line-height: 1.2;
  letter-spacing: -0.02em;
  margin-bottom: 0.75rem;
}
.hero-sub {
  font-size: 1.125rem;
  color: rgba(255,255,255,0.8);
  line-height: 1.6;
}
.chips {
  display: flex; flex-wrap: wrap; gap: 0.75rem;
  margin-top: 2rem;
}
.chip {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.35rem 1rem;
  background: rgba(255,255,255,0.15);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 9999px;
  color: white;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.chip-icon { font-size: 16px; color: #8df2fc; }

.panel-footer { position: relative; z-index: 2; }
.trusted-text {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.5);
}

/* ── Right Panel ── */
.panel-right {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  padding: 2.5rem 1.5rem;
}
@media (min-width: 1024px) {
  .panel-right { width: 50%; padding: 3rem 2rem; }
}

.form-container { width: 100%; max-width: 440px; }

/* Mobile Branding */
.mobile-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 2.5rem;
  color: #00355f;
}
.mobile-brand-logo {
  height: 40px;
  width: auto;
  object-fit: contain;
  mix-blend-mode: multiply;
}
.mobile-brand-name {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #00355f;
}
@media (min-width: 1024px) { .mobile-brand { display: none; } }

/* Form Header */
.form-header { margin-bottom: 2rem; }
.form-title {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 2rem;
  font-weight: 700;
  color: #161c27;
  letter-spacing: -0.02em;
  margin-bottom: 0.4rem;
}
.form-sub { font-size: 1rem; color: #42474f; }

/* Form */
.form { display: flex; flex-direction: column; gap: 1.25rem; }
.field { display: flex; flex-direction: column; gap: 0.4rem; }
.field-label-row { display: flex; justify-content: space-between; align-items: center; }
.field-label { font-size: 0.875rem; font-weight: 600; color: #161c27; letter-spacing: 0.01em; }
.forgot-link {
  font-size: 0.75rem;
  font-weight: 700;
  color: #00355f;
  text-decoration: none;
  letter-spacing: 0.04em;
}
.forgot-link:hover { text-decoration: underline; }

.input-wrap { position: relative; }
.input-icon {
  position: absolute;
  left: 14px; top: 50%;
  transform: translateY(-50%);
  color: #727780;
  font-size: 20px;
  pointer-events: none;
  transition: color 0.2s;
}
.input-wrap:focus-within .input-icon { color: #00355f; }

.input {
  width: 100%;
  padding: 0.85rem 1rem 0.85rem 3rem;
  font-size: 1rem;
  font-family: inherit;
  background: #f1f3ff;
  border: 2px solid transparent;
  border-radius: 0.75rem;
  color: #161c27;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}
.input::placeholder { color: #727780; }
.input:focus {
  background: #fff;
  border-color: #00355f;
  box-shadow: 0 0 0 4px rgba(0, 53, 95, 0.08);
}
.input-password { padding-right: 3rem; }

.visibility-btn {
  position: absolute;
  right: 12px; top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: #727780;
  display: flex; align-items: center;
  padding: 0;
  transition: color 0.2s;
}
.visibility-btn:hover { color: #42474f; }

/* Remember Me */
.remember { display: flex; align-items: center; gap: 0.75rem; }
.checkbox {
  width: 18px; height: 18px;
  accent-color: #00355f;
  cursor: pointer;
  flex-shrink: 0;
}
.remember-label { font-size: 0.875rem; color: #42474f; cursor: pointer; }

/* Error */
.error-msg {
  display: flex; align-items: center; gap: 0.5rem;
  background: #fff0f0;
  border: 1px solid #fecaca;
  color: #b91c1c;
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
}

/* Submit */
.btn-submit {
  width: 100%;
  padding: 0.9rem 1rem;
  background: linear-gradient(to right, #00355f, #006970);
  color: white;
  font-size: 0.875rem;
  font-weight: 600;
  font-family: inherit;
  letter-spacing: 0.01em;
  border: none;
  border-radius: 0.75rem;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(0, 53, 95, 0.25);
  display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  transition: opacity 0.2s, transform 0.15s;
}
.btn-submit:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
.btn-submit:active:not(:disabled) { transform: scale(0.98); }
.btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

/* Spinner */
.spinner {
  display: inline-block;
  width: 18px; height: 18px;
  border: 2.5px solid rgba(255,255,255,0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Divider */
.divider {
  display: flex; align-items: center; gap: 1rem;
  margin: 2rem 0;
}
.divider-line { flex: 1; height: 1px; background: #c2c7d1; }
.divider-text {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #42474f;
  white-space: nowrap;
}

/* Social */
.social-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.social-btn {
  display: flex; align-items: center; justify-content: center; gap: 0.75rem;
  padding: 0.85rem 1rem;
  background: #fff;
  border: 1.5px solid #c2c7d1;
  border-radius: 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  font-family: inherit;
  color: #161c27;
  cursor: pointer;
  transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
}
.social-btn:hover { background: #f1f3ff; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
.social-logo { width: 20px; height: 20px; flex-shrink: 0; }

/* Sign Up Link */
.signup-link {
  margin-top: 2rem;
  text-align: center;
  font-size: 1rem;
  color: #42474f;
}
.signup-link a {
  color: #00355f;
  font-weight: 700;
  text-decoration: none;
  margin-left: 4px;
}
.signup-link a:hover { text-decoration: underline; }

/* FAB */
.fab {
  position: fixed;
  bottom: 2rem; right: 2rem;
  z-index: 40;
  width: 56px; height: 56px;
  background: white;
  color: #00355f;
  border: 1.5px solid #c2c7d1;
  border-radius: 50%;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, transform 0.15s;
}
.fab:hover { background: #00355f; color: white; }
.fab:active { transform: scale(0.9); }

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
