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

await authStore.hydrateSession()

// Setup API error interceptors with toast store
setupApiInterceptors({ toastStore, authStore })

app.use(router)

app.mount('#app')
