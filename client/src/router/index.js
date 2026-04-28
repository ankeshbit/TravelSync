import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import DashboardView from '../views/DashboardView.vue'
import CreateTripView from '../views/CreateTripView.vue'
import TripDetailView from '../views/TripDetailView.vue'
import EditTripView from '../views/EditTripView.vue'
import ExploreView from '../views/ExploreView.vue'
import SettingsView from '../views/SettingsView.vue'
import NotFoundView from '../views/NotFoundView.vue'

const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: LoginView },
  { path: '/register', component: RegisterView },
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
    path: '/trips/create',
    component: CreateTripView,
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
    path: '/:pathMatch(.*)*',
    component: NotFoundView
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Navigation guard — protect dashboard
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  if (to.meta.requiresAuth && !token) {
    next('/login')
  } else if ((to.path === '/login' || to.path === '/register') && token) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router
