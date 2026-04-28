<template>
  <div class="page">
    <header class="header">
      <div class="header-inner">
        <div class="brand">
          <img src="/logo.png" alt="TravelSync" class="brand-logo object-contain" />
          <span class="brand-text">Travel Sync</span>
        </div>
        <nav class="header-nav">
          <router-link class="nav-link" to="/login">Login</router-link>
          <router-link class="nav-link nav-cta" to="/register">Sign Up</router-link>
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

            <form @submit.prevent="handleRegister" class="form">
              <div class="field">
                <label class="field-label">Full Name</label>
                <div class="input-wrap">
                  <span class="input-icon material-symbols-outlined">person</span>
                  <input v-model="form.name" type="text" placeholder="John Doe" class="input" />
                </div>
              </div>

              <div class="field">
                <label class="field-label">Email Address</label>
                <div class="input-wrap">
                  <span class="input-icon material-symbols-outlined">mail</span>
                  <input v-model="form.email" type="email" placeholder="name@example.com" class="input" />
                </div>
              </div>

              <div class="field-row">
                <div class="field">
                  <label class="field-label">Password</label>
                  <div class="input-wrap">
                    <span class="input-icon material-symbols-outlined">lock</span>
                    <input v-model="form.password" type="password" placeholder="••••••••" class="input" />
                  </div>
                </div>
                <div class="field">
                  <label class="field-label">Confirm</label>
                  <div class="input-wrap">
                    <span class="input-icon material-symbols-outlined">lock_reset</span>
                    <input v-model="form.confirmPassword" type="password" placeholder="••••••••" class="input" />
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
                  {{ error }}
                </div>
              </transition>

              <button :disabled="loading" type="submit" class="btn-submit">
                <span v-if="loading" class="spinner"></span>
                <span v-else>Create Account</span>
              </button>
            </form>

            <div class="divider">
              <div class="divider-line"></div>
              <span class="divider-text">Or sign up with</span>
              <div class="divider-line"></div>
            </div>

            <div class="social-btns">
              <button class="social-btn" type="button">
                <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuD5K6mUPvyXcaiScO-k9s7dFqxwt3ikbub99pZ8dNcoACRhSaCvbmXHqhv52MuBG0DaDlQjhs4PS5-YUWCxpoefsFkXI-1z4hvpsW1LuUHa5BVSY8yoBkn_vdRjVBY-47FEGxP6D2_y4Z_l8iuCRQJkPTX1FqcHQPHTGrugAJHrGiyZlFnrqqDvES14OUWSZoFDAiR9fqQKgIC78kONE5MO5zWpJhH_G3kxk4pi_6khmcpBWVTSlgeCkT41bJ_d6VTs3cEXLBPb1Q" alt="Google" class="social-logo" />
                Google
              </button>
              <button class="social-btn" type="button">
                <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuB08uDN5YBeII1uRCPnP3P26WplYkOnx2PAgzen5PLN_VVp46KgjKYoUwMVXdU32td59anV7Bl118r_LC6jDwu9sJ3Y7JDlKrw3YB5QhpEfuEO9oiiURpK38e-rvqi7oAPft0Dhymf2BLx-OcIhcQErH9INpQw-FWpp6W3RN-Yr04iM5xoHETRicXxpYscCNUKtmdadp282SbppVDR2tWsuWInAyZPWf2Hig5a4la0XbrrTko4JVbcLsLbqSXM9eTsM_nmT12pHaQ" alt="Apple" class="social-logo" />
                Apple
              </button>
            </div>

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
        <span>© 2024 Travel Sync. All travel rights reserved.</span>
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
import api from '../api.js'

const router = useRouter()
const form = ref({ name: '', email: '', password: '', confirmPassword: '', terms: false })
const loading = ref(false)
const error = ref('')

const handleRegister = async () => {
  error.value = ''
  if (!form.value.name || !form.value.email || !form.value.password || !form.value.confirmPassword) {
    error.value = 'Please fill in all fields.'; return
  }
  if (form.value.password.length < 6) {
    error.value = 'Password must be at least 6 characters.'; return
  }
  if (form.value.password !== form.value.confirmPassword) {
    error.value = 'Passwords do not match.'; return
  }
  if (!form.value.terms) {
    error.value = 'Please accept the Terms & Conditions.'; return
  }
  loading.value = true
  try {
    const res = await api.post('/auth/register', {
      name: form.value.name, email: form.value.email, password: form.value.password,
    })
    localStorage.setItem('token', res.data.token)
    localStorage.setItem('user', JSON.stringify(res.data.user))
    router.push('/dashboard')
  } catch (err) {
    error.value = err.response?.data?.message || 'Registration failed. Please try again.'
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
  background: #f9f9ff;
  font-family: 'Manrope', 'Inter', sans-serif;
  color: #161c27;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
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
.header-nav { display: flex; gap: 1rem; align-items: center; }
.nav-link {
  font-size: 0.875rem;
  font-weight: 600;
  color: #475569;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  text-decoration: none;
  transition: background 0.2s ease;
}
.nav-link:hover { background: rgba(219, 234, 254, 0.5); }
.nav-cta { background: #00355f; color: #fff; }
.nav-cta:hover { opacity: 0.9; }

/* ── Main ── */
.main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6rem 1rem 2rem;
  background: #f9f9ff;
}

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
  .panel-left { display: block; width: 50%; min-height: 600px; }
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
  font-size: 2.25rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
  margin-bottom: 1rem;
}
.panel-sub {
  font-size: 1.125rem;
  line-height: 1.6;
  opacity: 0.9;
  max-width: 320px;
}
.features { margin-top: 3rem; display: flex; flex-direction: column; gap: 1.5rem; }
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
}
@media (min-width: 768px) { .panel-right { width: 50%; padding: 3.5rem; } }
@media (min-width: 1024px) { .panel-right { padding: 4rem; } }

.form-wrapper { max-width: 420px; margin: 0 auto; }
.form-header { margin-bottom: 2.5rem; text-align: center; }
@media (min-width: 768px) { .form-header { text-align: left; } }

.form-title {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 2rem;
  font-weight: 700;
  color: #00355f;
  letter-spacing: -0.02em;
  margin-bottom: 0.5rem;
}
.form-sub { font-size: 1rem; color: #42474f; }

/* ── Form ── */
.form { display: flex; flex-direction: column; gap: 1.25rem; }
.field { display: flex; flex-direction: column; gap: 0.5rem; }
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
@media (max-width: 480px) { .field-row { grid-template-columns: 1fr; } }

.field-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #42474f;
  letter-spacing: 0.01em;
}

.input-wrap { position: relative; }
.input-icon {
  position: absolute;
  left: 12px; top: 50%;
  transform: translateY(-50%);
  color: #727780;
  font-size: 20px;
  pointer-events: none;
  transition: color 0.2s;
}
.input-wrap:focus-within .input-icon { color: #00355f; }

.input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 2.75rem;
  font-size: 1rem;
  font-family: inherit;
  background: #F7FAFC;
  border: 2px solid transparent;
  border-radius: 0.75rem;
  color: #161c27;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}
.input::placeholder { color: #b0b8bc; }
.input:focus {
  background: #fff;
  border-color: #a0c9ff;
  box-shadow: 0 0 0 4px rgba(160, 201, 255, 0.2);
}

/* ── Terms ── */
.terms { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.5rem 0; }
.checkbox {
  width: 18px; height: 18px;
  margin-top: 2px;
  accent-color: #00355f;
  cursor: pointer;
  flex-shrink: 0;
}
.terms label { font-size: 0.875rem; color: #42474f; line-height: 1.5; cursor: pointer; }
.terms a { color: #00355f; font-weight: 600; text-decoration: none; }
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

/* ── Submit Button ── */
.btn-submit {
  width: 100%;
  background: linear-gradient(135deg, #00355f 0%, #006970 100%);
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  font-family: inherit;
  padding: 1rem;
  border: none;
  border-radius: 0.75rem;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(0, 53, 95, 0.25);
  display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  transition: opacity 0.2s, transform 0.15s;
}
.btn-submit:hover:not(:disabled) { opacity: 0.95; transform: translateY(-1px); }
.btn-submit:active:not(:disabled) { transform: scale(0.98); }
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

/* ── Divider ── */
.divider {
  display: flex; align-items: center; gap: 1rem;
  margin: 2rem 0;
}
.divider-line { flex: 1; height: 1px; background: rgba(194, 199, 209, 0.4); }
.divider-text {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #42474f;
  white-space: nowrap;
}

/* ── Social ── */
.social-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.social-btn {
  display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: #fff;
  border: 1.5px solid rgba(194, 199, 209, 0.6);
  border-radius: 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  font-family: inherit;
  color: #161c27;
  cursor: pointer;
  transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
}
.social-btn:hover { background: #f1f3ff; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
.social-logo { width: 20px; height: 20px; object-fit: contain; }

/* ── Sign In Link ── */
.signin-link {
  margin-top: 2.5rem;
  text-align: center;
  font-size: 1rem;
  color: #42474f;
}
.signin-link a {
  color: #00355f;
  font-weight: 700;
  text-decoration: none;
  margin-left: 4px;
}
.signin-link a:hover { text-decoration: underline; }

/* ── Footer ── */
.footer {
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(8px);
}
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
@media (min-width: 768px) {
  .footer-inner { flex-direction: row; justify-content: space-between; }
}
.footer-links { display: flex; gap: 1.5rem; }
.footer-links a { color: #42474f; text-decoration: none; font-weight: 600; font-size: 0.875rem; transition: color 0.2s; }
.footer-links a:hover { color: #00355f; }

/* ── Transitions ── */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
