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

  // Always wait for auth initialization first so that cached session is resolved
  if (!authStore.initialized) {
    await authStore.waitForAuth()
  }

  // Resolve verified identity: either currently active Firebase/DB user, or verified cached local user
  let verifiedUserId = authStore.currentUser?.id || authStore.firebaseUser?.uid || null;
  if (!verifiedUserId && typeof window !== 'undefined' && window.localStorage) {
    try {
      const cached = JSON.parse(localStorage.getItem('user'));
      if (cached && (cached.id || cached.firebaseUid)) {
        verifiedUserId = cached.id || cached.firebaseUid;
      }
    } catch {}
  }

  // If navigating to an offline-allowed route
  if (to.meta.isOfflineAllowed) {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (isOffline) {
      // Must have a verified previously-authenticated account to access cached trips offline
      if (!verifiedUserId) {
        return next({ path: '/login', query: { redirect: to.fullPath, offlineBlocked: 'true' } });
      }
      return next();
    }
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
    // If user is offline and has a verified cached account, permit offline-allowed routes only
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (isOffline && to.meta.isOfflineAllowed && verifiedUserId) {
      return next();
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
