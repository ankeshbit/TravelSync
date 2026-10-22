import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { safeRedirect } from '../utils/url'

const LandingView = () => import('../views/LandingView.vue')
const LoginView = () => import('../views/LoginView.vue')
const RegisterView = () => import('../views/RegisterView.vue')
const ForgotPasswordView = () => import('../views/ForgotPasswordView.vue')
const DashboardView = () => import('../views/DashboardView.vue')
const TripDetailView = () => import('../views/TripDetailView.vue')
const EditTripView = () => import('../views/EditTripView.vue')
const ExploreView = () => import('../views/ExploreView.vue')
const SettingsView = () => import('../views/SettingsView.vue')
const NotFoundView = () => import('../views/NotFoundView.vue')

const VerifyEmailView = () => import('../views/VerifyEmailView.vue')

const routes = [
  { path: '/', component: LandingView, meta: { requiresAuth: false } },
  { path: '/login', component: LoginView },
  { path: '/register', component: RegisterView },
  { path: '/forgot-password', component: ForgotPasswordView },
  { path: '/verify-email', component: VerifyEmailView, meta: { requiresAuth: false } },
  {
    path: '/dashboard',
    component: DashboardView,
    meta: { requiresAuth: true }
  },
  {
    path: '/explore',
    component: ExploreView,
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    component: SettingsView,
    meta: { requiresAuth: true }
  },
  {
    path: '/trips/:id',
    component: TripDetailView,
    meta: { requiresAuth: true }
  },
  {
    path: '/trips/:id/edit',
    component: EditTripView,
    meta: { requiresAuth: true }
  },
  {
    path: '/trips/:tripId/map',
    component: () => import('../views/MapView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/trips/:tripId/expenses',
    component: () => import('../views/ExpensesView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/offline-trips',
    component: () => import('../views/OfflineDashboardView.vue'),
    meta: { requiresAuth: true, isOfflineAllowed: true }
  },
  {
    path: '/offline-trips/:tripId',
    component: () => import('../views/OfflineTripDetailView.vue'),
    meta: { requiresAuth: true, isOfflineAllowed: true }
  },
  {
    path: '/:pathMatch(.*)*',
    component: NotFoundView
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

// Navigation guard — wait for Firebase auth to initialise before deciding
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  // If navigating to an offline-allowed route while offline, permit navigation to local storage
  if (to.meta.isOfflineAllowed && (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return next()
  }

  // waitForAuth() resolves immediately after the first onAuthStateChanged call
  // so there is no redirect loop even when already initialized
  if (!authStore.initialized) {
    await authStore.waitForAuth()
  }

  const isUnverified = Boolean(authStore.firebaseUser && !authStore.firebaseUser.emailVerified)

  if (isUnverified) {
    if (to.path !== '/verify-email' && to.path !== '/login') {
      return next('/verify-email')
    }
    return next()
  }

  if (to.path === '/verify-email') {
    if (!authStore.isAuthenticated) {
      return next('/login')
    }
    return next('/dashboard')
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    if (to.meta.isOfflineAllowed) {
      return next()
    }
    next({ path: '/login', query: { redirect: to.fullPath } })
  } else if (
    (to.path === '/login' || to.path === '/register' || to.path === '/forgot-password') &&
    authStore.isAuthenticated
  ) {
    const redirectPath = safeRedirect(to.query.redirect, '/dashboard')
    next(redirectPath)
  } else {
    next()
  }
})

export default router
