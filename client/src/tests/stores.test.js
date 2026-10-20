import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '../stores/auth';
import { useTripsStore } from '../stores/trips';
import { useExpensesStore } from '../stores/expenses';
import api from '../api';

import { loginWithGoogle as fbLoginWithGoogle } from '../services/authService';

vi.mock('../services/authService', () => ({
  loginWithEmail: vi.fn(),
  registerWithEmail: vi.fn(),
  loginWithGoogle: vi.fn(),
  loginWithGitHub: vi.fn(),
  logout: vi.fn().mockResolvedValue(),
  getIdToken: vi.fn(),
  getFirebaseErrorMessage: vi.fn((err) => err.message)
}));

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

    it('loginWithGoogle sets firebaseUser immediately and syncs mongo user', async () => {
      const auth = useAuthStore();
      const mockFbUser = { uid: 'google-uid-1', email: 'google@example.com', emailVerified: true };
      fbLoginWithGoogle.mockResolvedValueOnce(mockFbUser);
      api.get.mockResolvedValueOnce({ data: { id: 'u-google', name: 'Google User', email: 'google@example.com' } });

      await auth.loginWithGoogle();
      expect(auth.isAuthenticated).toBe(true);
      expect(auth.firebaseUser).toEqual(mockFbUser);
      expect(api.get).toHaveBeenCalledWith('/auth/me');
      expect(auth.currentUser).toEqual({ id: 'u-google', name: 'Google User', email: 'google@example.com' });
    });

    it('deduplicates concurrent _syncMongoUser calls to avoid racing', async () => {
      const auth = useAuthStore();
      auth.firebaseUser = { uid: 'google-uid-1', email: 'google@example.com', emailVerified: true };

      let resolveApi;
      const apiPromise = new Promise((resolve) => { resolveApi = resolve; });
      api.get.mockReturnValueOnce(apiPromise);

      const p1 = auth._syncMongoUser();
      const p2 = auth._syncMongoUser();

      expect(api.get).toHaveBeenCalledTimes(1);

      resolveApi({ data: { id: 'u1', name: 'User 1' } });
      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1).toEqual({ id: 'u1', name: 'User 1' });
      expect(r2).toEqual({ id: 'u1', name: 'User 1' });
      expect(auth.currentUser).toEqual({ id: 'u1', name: 'User 1' });
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
        totalExpenses: 100,
        balanceMap: { '1': 50, '2': -50 },
        settlements: [{ from: '2', fromName: 'Bob', to: '1', toName: 'Alice', amount: 50 }],
        membersWithBalance: [
          { id: '1', _id: '1', name: 'Alice', email: 'alice@example.com', balance: 50 },
          { id: '2', _id: '2', name: 'Bob', email: 'bob@example.com', balance: -50 }
        ],
        byCurrency: {
          USD: {
            totalExpenses: 100,
            balanceMap: { '1': 50, '2': -50 },
            settlements: [{ from: '2', fromName: 'Bob', to: '1', toName: 'Alice', amount: 50 }],
            membersWithBalance: [
              { id: '1', _id: '1', name: 'Alice', email: 'alice@example.com', balance: 50 },
              { id: '2', _id: '2', name: 'Bob', email: 'bob@example.com', balance: -50 }
            ]
          },
          EUR: {
            totalExpenses: 200,
            balanceMap: { '1': -100, '2': 100 },
            settlements: [{ from: '1', fromName: 'Alice', to: '2', toName: 'Bob', amount: 100 }],
            membersWithBalance: [
              { id: '1', _id: '1', name: 'Alice', email: 'alice@example.com', balance: -100 },
              { id: '2', _id: '2', name: 'Bob', email: 'bob@example.com', balance: 100 }
            ]
          }
        }
      };
      api.get.mockResolvedValueOnce({ data: mockBalancesData });

      await expensesStore.fetchBalances('t1');
      expect(api.get).toHaveBeenCalledWith('/trips/t1/expenses/balances');
      expect(expensesStore.balances).toEqual(mockBalancesData.balanceMap);
      expect(expensesStore.settlements).toEqual(mockBalancesData.settlements);
      expect(expensesStore.membersWithBalance).toEqual(mockBalancesData.membersWithBalance);
      expect(expensesStore.byCurrency).toEqual(mockBalancesData.byCurrency);
    });

    it('resets expenses state correctly', () => {
      const expensesStore = useExpensesStore();
      expensesStore.expenses = [{ id: 'e1' }];
      expensesStore.balances = { '1': 50 };
      expensesStore.byCurrency = { USD: { totalExpenses: 100 } };

      expensesStore.resetExpenses();
      expect(expensesStore.expenses).toEqual([]);
      expect(expensesStore.balances).toEqual({});
      expect(expensesStore.byCurrency).toEqual({});
    });

    it('slow stale fetch does not overwrite newer trip data', async () => {
      const expensesStore = useExpensesStore();

      let resolveSlowFetch;
      const slowPromise = new Promise((resolve) => {
        resolveSlowFetch = resolve;
      });

      // First fetch (slow): trip-1 with 1 expense and currency EUR
      api.get.mockImplementationOnce(() => slowPromise);

      const firstCall = expensesStore.fetchExpenses('trip-1');

      // Second fetch (fast): trip-2 with 1 expense and currency USD
      api.get.mockResolvedValueOnce({
        data: {
          expenses: [{ id: 'e-fast', amount: 99, currency: 'USD' }],
          currency: 'USD',
          pagination: { hasNextPage: false }
        }
      });

      await expensesStore.fetchExpenses('trip-2');

      expect(expensesStore.expenses).toEqual([{ id: 'e-fast', amount: 99, currency: 'USD' }]);
      expect(expensesStore.currency).toBe('USD');

      // Now resolve the slow fetch
      resolveSlowFetch({
        data: {
          expenses: [{ id: 'e-slow', amount: 10, currency: 'EUR' }],
          currency: 'EUR',
          pagination: { hasNextPage: false }
        }
      });
      await firstCall;

      // The slow fetch must have been discarded; trip-2's data and currency must remain intact
      expect(expensesStore.expenses).toEqual([{ id: 'e-fast', amount: 99, currency: 'USD' }]);
      expect(expensesStore.currency).toBe('USD');
    });
  });
});
