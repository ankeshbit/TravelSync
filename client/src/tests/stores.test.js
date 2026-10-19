import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '../stores/auth';
import { useTripsStore } from '../stores/trips';
import { useExpensesStore } from '../stores/expenses';
import api from '../api';

vi.mock('../api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} })
  }
}));

describe('Pinia Stores', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('useAuthStore', () => {
    it('initializes with default state', () => {
      const auth = useAuthStore();
      expect(auth.isAuthenticated).toBe(false);
      expect(auth.currentUser).toBeNull();
      expect(auth.firebaseUser).toBeNull();
    });

    it('sets and updates user and syncs with localStorage', () => {
      const auth = useAuthStore();
      auth.firebaseUser = { uid: 'fb1' };
      auth.setUser({ id: 'u1', name: 'John Doe', email: 'john@example.com' });
      expect(auth.isAuthenticated).toBe(true);
      expect(auth.currentUser.name).toBe('John Doe');

      auth.updateUser({ name: 'Jane Doe', picture: '/uploads/pic.jpg' });
      expect(auth.currentUser.name).toBe('Jane Doe');
      expect(auth.currentUser.picture).toBe('/uploads/pic.jpg');

      const stored = JSON.parse(localStorage.getItem('user'));
      expect(stored.name).toBe('Jane Doe');
      expect(stored.picture).toBe('/uploads/pic.jpg');
    });

    it('clears state on logout', async () => {
      const auth = useAuthStore();
      auth.firebaseUser = { uid: 'fb1' };
      auth.setUser({ id: 'u1', name: 'John' });

      await auth.logout();
      expect(auth.isAuthenticated).toBe(false);
      expect(auth.currentUser).toBeNull();
      expect(auth.firebaseUser).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
    });
  });

  describe('useTripsStore', () => {
    it('fetches trips and stores list', async () => {
      const tripsStore = useTripsStore();
      const mockTrips = [
        { id: 't1', name: 'Paris Trip', destination: 'Paris', status: 'planning' },
        { id: 't2', name: 'Tokyo Trip', destination: 'Tokyo', status: 'completed' }
      ];
      api.get.mockResolvedValueOnce({ data: mockTrips });

      await tripsStore.fetchTrips();
      expect(api.get).toHaveBeenCalledWith('/trips');
      expect(tripsStore.trips).toEqual(mockTrips);
      expect(tripsStore.loading).toBe(false);
    });

    it('fetches a single trip and resets currentTrip', async () => {
      const tripsStore = useTripsStore();
      const mockTrip = { id: 't1', name: 'Paris Trip', destination: 'Paris' };
      api.get.mockResolvedValueOnce({ data: mockTrip });

      const res = await tripsStore.fetchTrip('t1');
      expect(api.get).toHaveBeenCalledWith('/trips/t1');
      expect(tripsStore.currentTrip).toEqual(mockTrip);
      expect(res).toEqual(mockTrip);

      tripsStore.resetCurrentTrip();
      expect(tripsStore.currentTrip).toBeNull();
    });

    it('creates and deletes trip in state', async () => {
      const tripsStore = useTripsStore();
      tripsStore.trips = [{ id: 't1', name: 'Old Trip' }];

      api.post.mockResolvedValueOnce({ data: { id: 't2', name: 'New Trip' } });
      const created = await tripsStore.createTrip({ name: 'New Trip' });
      expect(created.id).toBe('t2');
      expect(tripsStore.trips.length).toBe(2);

      api.delete.mockResolvedValueOnce({ data: { success: true } });
      await tripsStore.deleteTrip('t1');
      expect(tripsStore.trips.some(t => t.id === 't1')).toBe(false);
    });
  });

  describe('useExpensesStore', () => {
    it('fetches paginated expenses until hasNextPage is false', async () => {
      const expensesStore = useExpensesStore();
      api.get
        .mockResolvedValueOnce({
          data: {
            expenses: [{ id: 'e1', amount: 50, currency: 'USD' }],
            pagination: { page: 1, totalPages: 2, hasNextPage: true }
          }
        })
        .mockResolvedValueOnce({
          data: {
            expenses: [{ id: 'e2', amount: 100, currency: 'USD' }],
            pagination: { page: 2, totalPages: 2, hasNextPage: false }
          }
        });

      await expensesStore.fetchExpenses('t1');
      expect(api.get).toHaveBeenCalledTimes(2);
      expect(expensesStore.expenses.length).toBe(2);
      expect(expensesStore.expenses[0].id).toBe('e1');
      expect(expensesStore.expenses[1].id).toBe('e2');
    });

    it('fetches balances grouped by currency and stores byCurrency', async () => {
      const expensesStore = useExpensesStore();
      const mockBalancesData = {
        byCurrency: {
          USD: {
            totalSpent: 150,
            userBalance: 50,
            currency: 'USD',
            balances: { u1: 50, u2: -50 },
            settlements: [{ from: 'u2', to: 'u1', amount: 50, currency: 'USD' }]
          },
          EUR: {
            totalSpent: 80,
            userBalance: -20,
            currency: 'EUR',
            balances: { u1: -20, u2: 20 },
            settlements: [{ from: 'u1', to: 'u2', amount: 20, currency: 'EUR' }]
          }
        }
      };
      api.get.mockResolvedValueOnce({ data: mockBalancesData });

      await expensesStore.fetchBalances('t1');
      expect(api.get).toHaveBeenCalledWith('/trips/t1/expenses/balances');
      expect(expensesStore.byCurrency).toEqual(mockBalancesData.byCurrency);
    });

    it('resets expenses state correctly', () => {
      const expensesStore = useExpensesStore();
      expensesStore.expenses = [{ id: 'e1' }];
      expensesStore.balances = { total: 100 };
      expensesStore.byCurrency = { USD: { totalSpent: 100 } };

      expensesStore.resetExpenses();
      expect(expensesStore.expenses).toEqual([]);
      expect(expensesStore.balances).toEqual({});
      expect(expensesStore.byCurrency).toEqual({});
    });
  });
});
