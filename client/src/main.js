import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import router from './router'
import { setupApiInterceptors } from './api'
import { useToastStore } from './stores/toast'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

// Setup API error interceptors with toast store
const toastStore = useToastStore()
setupApiInterceptors(toastStore)

app.mount('#app')
