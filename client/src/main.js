import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import router from './router'
import { setupApiInterceptors } from './api'
import { useToastStore } from './stores/toast'
import { useAuthStore } from './stores/auth'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

const authStore = useAuthStore()
const toastStore = useToastStore()

// Setup API error interceptors with toast store
setupApiInterceptors({ toastStore, authStore })

// Start the Firebase auth listener so onAuthStateChanged fires before any routes load
authStore.initializeAuth()

// Wait for Firebase to restore the session before mounting — prevents redirect flicker
await authStore.waitForAuth()

app.use(router)
app.mount('#app')
