import { ref } from 'vue';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import ExpensesView from '../views/ExpensesView.vue';
import { useAuthStore } from '../stores/auth';
import { useExpensesStore } from '../stores/expenses';
import api from '../api';

vi.mock('../api');
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { tripId: 'trip-multi' } }),
  useRouter: () => ({ push: vi.fn() }),
  RouterLink: {
    template: '<a><slot /></a>'
  }
}));

vi.mock('../composables/useSocket', () => ({
  useSocket: () => ({
    activeMembers: ref([]),
    isConnected: ref(true)
  })
}));

describe('ExpensesView multi-currency balances', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('renders currency selector and updates computed balances when switching currency', async () => {
    const authStore = useAuthStore();
    authStore.currentUser = { id: 'u1', name: 'Alice', email: 'alice@example.com' };

    const mockTrip = {
      id: 'trip-multi',
      name: 'Europe Tour',
      currency: 'USD',
      members: [
        { id: 'u1', name: 'Alice', email: 'alice@example.com' },
        { id: 'u2', name: 'Bob', email: 'bob@example.com' }
      ]
    };

    const mockExpenses = [
      { id: 'e1', title: 'Museum', amount: 100, currency: 'USD', paidBy: 'u1', splitAmong: ['u1', 'u2'] },
      { id: 'e2', title: 'Dinner', amount: 200, currency: 'EUR', paidBy: 'u2', splitAmong: ['u1', 'u2'] }
    ];

    const mockBalances = {
      totalExpenses: 100,
      balanceMap: { u1: 50, u2: -50 },
      settlements: [{ from: 'u2', fromName: 'Bob', to: 'u1', toName: 'Alice', amount: 50 }],
      membersWithBalance: [
        { id: 'u1', name: 'Alice', email: 'alice@example.com', balance: 50 },
        { id: 'u2', name: 'Bob', email: 'bob@example.com', balance: -50 }
      ],
      byCurrency: {
        USD: {
          totalExpenses: 100,
          balanceMap: { u1: 50, u2: -50 },
          settlements: [{ from: 'u2', fromName: 'Bob', to: 'u1', toName: 'Alice', amount: 50 }],
          membersWithBalance: [
            { id: 'u1', name: 'Alice', email: 'alice@example.com', balance: 50 },
            { id: 'u2', name: 'Bob', email: 'bob@example.com', balance: -50 }
          ]
        },
        EUR: {
          totalExpenses: 200,
          balanceMap: { u1: -100, u2: 100 },
          settlements: [{ from: 'u1', fromName: 'Alice', to: '2', toName: 'Bob', amount: 100 }],
          membersWithBalance: [
            { id: 'u1', name: 'Alice', email: 'alice@example.com', balance: -100 },
            { id: 'u2', name: 'Bob', email: 'bob@example.com', balance: 100 }
          ]
        }
      }
    };

    api.get.mockImplementation((url) => {
      if (url === '/trips/trip-multi') return Promise.resolve({ data: mockTrip });
      if (url.includes('/expenses?')) return Promise.resolve({ data: { expenses: mockExpenses, pagination: { hasNextPage: false } } });
      if (url.includes('/balances')) return Promise.resolve({ data: mockBalances });
      return Promise.resolve({ data: {} });
    });

    const wrapper = mount(ExpensesView, {
      global: {
        stubs: {
          Navbar: true,
          Sidebar: true,
          TripPresence: true,
          AddExpenseModal: true
        }
      }
    });

    // Wait for loadAllData promises to resolve
    await new Promise(resolve => setTimeout(resolve, 50));

    // Currency tabs should be present for USD and EUR
    const usdTab = wrapper.find('[data-test="currency-tab-USD"]');
    const eurTab = wrapper.find('[data-test="currency-tab-EUR"]');
    expect(usdTab.exists()).toBe(true);
    expect(eurTab.exists()).toBe(true);

    // Initial selected currency should be USD (trip currency)
    expect(wrapper.text()).toContain('$100.00'); // Total USD
    expect(wrapper.text()).toContain('$50.00');  // Your share / You are owed

    // Switch to EUR tab
    await eurTab.trigger('click');
    await wrapper.vm.$nextTick();

    // Now EUR amounts should be displayed, not USD
    expect(wrapper.text()).toContain('€200.00'); // Total EUR
    expect(wrapper.text()).toContain('€100.00'); // Your share / You owe in EUR
  });

  it('trip currency INR with all expenses in USD shows empty settlements and zero totals on INR tab, and real values on USD tab', async () => {
    const authStore = useAuthStore();
    authStore.currentUser = { id: 'u1', name: 'Alice', email: 'alice@example.com' };

    const mockTrip = {
      id: 'trip-multi',
      name: 'India & US Trip',
      currency: 'INR',
      members: [
        { id: 'u1', name: 'Alice', email: 'alice@example.com' },
        { id: 'u2', name: 'Bob', email: 'bob@example.com' }
      ]
    };

    const mockExpenses = [
      { id: 'e1', title: 'Museum', amount: 100, currency: 'USD', paidBy: 'u1', splitAmong: ['u1', 'u2'] }
    ];

    const mockBalances = {
      totalExpenses: 100,
      balanceMap: { u1: 50, u2: -50 },
      settlements: [{ from: 'u2', fromName: 'Bob', to: 'u1', toName: 'Alice', amount: 50 }],
      byCurrency: {
        USD: {
          totalExpenses: 100,
          balanceMap: { u1: 50, u2: -50 },
          settlements: [{ from: 'u2', fromName: 'Bob', to: 'u1', toName: 'Alice', amount: 50 }],
          membersWithBalance: [
            { id: 'u1', name: 'Alice', email: 'alice@example.com', balance: 50 },
            { id: 'u2', name: 'Bob', email: 'bob@example.com', balance: -50 }
          ]
        }
      }
    };

    api.get.mockImplementation((url) => {
      if (url === '/trips/trip-multi') return Promise.resolve({ data: mockTrip });
      if (url.includes('/expenses?')) return Promise.resolve({ data: { expenses: mockExpenses, pagination: { hasNextPage: false } } });
      if (url.includes('/balances')) return Promise.resolve({ data: mockBalances });
      return Promise.resolve({ data: {} });
    });

    const wrapper = mount(ExpensesView, {
      global: {
        stubs: {
          Navbar: true,
          Sidebar: true,
          TripPresence: true,
          AddExpenseModal: true
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    // Both INR and USD tabs exist
    const inrTab = wrapper.find('[data-test="currency-tab-INR"]');
    const usdTab = wrapper.find('[data-test="currency-tab-USD"]');
    expect(inrTab.exists()).toBe(true);
    expect(usdTab.exists()).toBe(true);

    // Initial tab is INR (trip currency), which has no expenses
    expect(wrapper.text()).toContain('₹0.00');
    expect(wrapper.text()).toContain('All settled up!');

    // Switch to USD tab
    await usdTab.trigger('click');
    await wrapper.vm.$nextTick();

    // USD tab displays real values
    expect(wrapper.text()).toContain('$100.00');
    expect(wrapper.text()).toContain('$50.00');
    expect(wrapper.text()).not.toContain('All settled up!');
    expect(wrapper.text()).toContain('Bob');
  });
});
