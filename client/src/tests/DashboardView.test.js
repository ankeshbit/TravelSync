import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import DashboardView from '../views/DashboardView.vue';
import api from '../api';

vi.mock('../api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn()
  }
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ query: {} })
}));

vi.mock('../components/Navbar.vue', () => ({ default: { template: '<div>Navbar</div>' } }));
vi.mock('../components/Sidebar.vue', () => ({ default: { template: '<div>Sidebar</div>' } }));
vi.mock('../components/TripCard.vue', () => ({ default: { template: '<div>TripCard</div>' } }));
vi.mock('../components/CreateTripModal.vue', () => ({ default: { template: '<div>CreateTripModal</div>' } }));

describe('DashboardView.vue - Currency Aggregation & Display', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('renders single-currency spending correctly', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/trips/summary') {
        return Promise.resolve({
          data: {
            totalTrips: 1,
            upcomingTrips: 1,
            totalMembers: 2,
            totalSpent: 4000,
            currency: 'INR',
            spentByCurrency: { INR: 4000 },
            hasMultipleCurrencies: false
          }
        });
      }
      if (url === '/trips') {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: {} });
    });

    const wrapper = mount(DashboardView);
    await flushPromises();

    expect(wrapper.text()).toContain('Total Spent');
    expect(wrapper.text()).toContain('₹4,000.00');
  });

  it('renders multi-currency spending separately without combining them into one number', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/trips/summary') {
        return Promise.resolve({
          data: {
            totalTrips: 2,
            upcomingTrips: 1,
            totalMembers: 3,
            totalSpent: null,
            currency: 'INR',
            spentByCurrency: {
              INR: 5000,
              USD: 150
            },
            hasMultipleCurrencies: true
          }
        });
      }
      if (url === '/trips') {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: {} });
    });

    const wrapper = mount(DashboardView);
    await flushPromises();

    expect(wrapper.text()).toContain('₹5,000.00 + $150.00');
  });

  it('falls back to INR and displays ₹0.00 for empty dashboard with zero trips', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/trips/summary') {
        return Promise.resolve({
          data: {
            totalTrips: 0,
            upcomingTrips: 0,
            totalMembers: 0,
            totalSpent: 0,
            currency: 'INR',
            spentByCurrency: { INR: 0 },
            hasMultipleCurrencies: false
          }
        });
      }
      if (url === '/trips') {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: {} });
    });

    const wrapper = mount(DashboardView);
    await flushPromises();

    expect(wrapper.text()).toContain('₹0.00');
  });

  it('preserves custom trip currency (e.g. EUR) when zero expenses are recorded', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/trips/summary') {
        return Promise.resolve({
          data: {
            totalTrips: 1,
            upcomingTrips: 1,
            totalMembers: 1,
            totalSpent: 0,
            currency: 'EUR',
            spentByCurrency: { EUR: 0 },
            hasMultipleCurrencies: false
          }
        });
      }
      if (url === '/trips') {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: {} });
    });

    const wrapper = mount(DashboardView);
    await flushPromises();

    expect(wrapper.text()).toContain('€0.00');
  });
});
