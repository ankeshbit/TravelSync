import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import OfflineDashboardView from '../views/OfflineDashboardView.vue';
import OfflineTripDetailView from '../views/OfflineTripDetailView.vue';
import OfflineBanner from '../components/OfflineBanner.vue';
import { useOfflineStore } from '../stores/offline';
import { useAuthStore } from '../stores/auth';

const mockPush = vi.fn();
let mockRouteParams = { tripId: 'trip-alpine-1' };

vi.mock('../services/offlineStorage', () => ({
  getOfflineTrips: vi.fn().mockResolvedValue([]),
  getOfflineTripBundle: vi.fn().mockResolvedValue(null),
  saveOfflineTripPack: vi.fn().mockResolvedValue({ success: true }),
  updateChecklistItemLocal: vi.fn().mockResolvedValue(true),
  updateNoteLocal: vi.fn().mockResolvedValue(true),
  updatePlaceNoteLocal: vi.fn().mockResolvedValue(true),
  getPendingSyncQueue: vi.fn().mockResolvedValue([]),
  clearPendingSyncItem: vi.fn().mockResolvedValue(),
  markPendingSyncItemError: vi.fn().mockResolvedValue(),
  deleteOfflineTrip: vi.fn().mockResolvedValue(),
  clearAllUserOfflineData: vi.fn().mockResolvedValue(),
  estimateStorage: vi.fn().mockResolvedValue({ usage: 45000, quota: 100000000, percentage: 1, humanUsage: '45.0 KB' })
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({ params: mockRouteParams })
}));

vi.mock('../components/Navbar.vue', () => ({ default: { template: '<div>Navbar</div>' } }));
vi.mock('../components/Sidebar.vue', () => ({ default: { template: '<div>Sidebar</div>' } }));

const globalMountOptions = {
  global: {
    stubs: {
      'router-link': {
        props: ['to'],
        template: '<a :href="to"><slot /></a>'
      }
    }
  }
};

let mockIsOnline = true;
let mockIsServerReachable = true;

vi.mock('../composables/useConnectivity', () => ({
  useConnectivity: () => ({
    isOnline: { value: mockIsOnline },
    isServerReachable: { value: mockIsServerReachable },
    isOffline: { value: !mockIsOnline || !mockIsServerReachable },
    checkServerReachability: vi.fn().mockResolvedValue(true)
  })
}));

describe('Offline Travel Companion UI Views', () => {
  let offlineStore;
  let authStore;

  beforeEach(() => {
    setActivePinia(createPinia());
    authStore = useAuthStore();
    authStore.currentUser = { id: 'user-1', email: 'traveler@travelsync.local' };
    offlineStore = useOfflineStore();
    vi.clearAllMocks();
    mockIsOnline = true;
    mockIsServerReachable = true;
  });

  const sampleTrip = {
    tripId: 'trip-alpine-1',
    name: 'Swiss Alps Expedition',
    destination: 'Zermatt, Switzerland',
    startDate: '2026-08-01T00:00:00.000Z',
    endDate: '2026-08-08T00:00:00.000Z',
    downloadedAt: '2026-08-01T08:00:00.000Z',
    dataSize: 45000,
    isAvailableOffline: true
  };

  const sampleBundle = {
    trip: {
      id: 'trip-alpine-1',
      name: 'Swiss Alps Expedition',
      destination: 'Zermatt, Switzerland',
      startDate: '2026-08-01T00:00:00.000Z',
      endDate: '2026-08-08T00:00:00.000Z',
      downloadedAt: '2026-08-01T08:00:00.000Z',
      currency: 'CHF',
      budgetPerPerson: 2000
    },
    itinerary: [
      { id: 'p1', dayNumber: 1, orderIndex: 0, name: 'Gornergrat Railway', category: 'attraction', address: 'Bahnhofplatz, Zermatt', note: 'Book window seat on right side' }
    ],
    staysAndTransport: [
      { id: 's1', type: 'hotel', name: 'Matterhorn Peak Lodge', bookingRef: 'MAT-9901', address: 'Oberdorfstrasse 12, Zermatt' },
      { id: 't1', type: 'flight', name: 'Swiss Air LX101', bookingRef: 'LX-4412', departure: '2026-08-01' }
    ],
    documents: [
      { id: 'd1', name: 'Swiss_Travel_Pass.pdf', size: 124000, description: '8-day consecutive mountain rail pass' }
    ],
    emergencyContacts: [
      { id: 'e1', name: 'Swiss Air-Glaciers Rescue', phone: '1414', relationship: 'Mountain Rescue' },
      { id: 'e2', name: 'General Emergency', phone: '112', relationship: 'Police & Ambulance' }
    ],
    checklists: [
      { id: 'c1', title: 'Passport & Travel Visa', category: 'Documents', completed: true },
      { id: 'c2', title: 'Thermal Layer & Hiking Boots', category: 'Gear', completed: false }
    ],
    notes: [
      { id: 'n1', title: 'Arrival Logistics', content: 'Zermatt is car-free. Park at Täsch and take the shuttle train.', updatedAt: '2026-08-01T08:00:00.000Z' }
    ],
    expenses: [
      { id: 'exp1', title: 'Train Transfer', amount: 90, currency: 'CHF', category: 'transport' }
    ]
  };

  describe('OfflineDashboardView.vue', () => {
    it('renders empty state when no trips are downloaded', async () => {
      offlineStore.offlineTrips = [];
      offlineStore.loadOfflineTrips = vi.fn().mockResolvedValue();
      const wrapper = mount(OfflineDashboardView, globalMountOptions);
      await flushPromises();

      expect(wrapper.text()).toContain('Offline Travel Companion');
      expect(wrapper.text()).toContain('No trips downloaded for offline use yet');
    });

    it('renders saved offline trips grid and local storage meter', async () => {
      offlineStore.offlineTrips = [sampleTrip];
      offlineStore.loadOfflineTrips = vi.fn().mockImplementation(async () => {
        offlineStore.offlineTrips = [sampleTrip];
      });
      const wrapper = mount(OfflineDashboardView, globalMountOptions);
      await flushPromises();

      expect(wrapper.text()).toContain('Swiss Alps Expedition');
      expect(wrapper.text()).toContain('Zermatt, Switzerland');
      expect(wrapper.text()).toContain('Offline Ready');
      expect(wrapper.text()).toContain('Open Companion');
    });

    it('confirms and removes offline trip from local storage', async () => {
      offlineStore.offlineTrips = [sampleTrip];
      offlineStore.loadOfflineTrips = vi.fn().mockImplementation(async () => {
        offlineStore.offlineTrips = [sampleTrip];
      });
      offlineStore.removeOfflineTrip = vi.fn().mockImplementation(async () => {
        offlineStore.offlineTrips = [];
      });

      const wrapper = mount(OfflineDashboardView, globalMountOptions);
      await flushPromises();

      // Click delete button
      const deleteBtn = wrapper.find('button[title="Remove local offline copy"]');
      expect(deleteBtn.exists()).toBe(true);
      await deleteBtn.trigger('click');

      // Modal appears
      expect(wrapper.text()).toContain('Remove Offline Trip?');

      // Confirm delete
      const confirmBtn = wrapper.findAll('button').find(b => b.text().includes('Delete Local Copy'));
      expect(confirmBtn).toBeDefined();
      await confirmBtn.trigger('click');
      await flushPromises();

      expect(offlineStore.removeOfflineTrip).toHaveBeenCalled();
    });
  });

  describe('OfflineTripDetailView.vue', () => {
    it('shows missing state if trip is not found locally', async () => {
      offlineStore.activeTripBundle = null;
      offlineStore.loadTripBundle = vi.fn().mockResolvedValue(null);

      const wrapper = mount(OfflineTripDetailView, globalMountOptions);
      await flushPromises();

      expect(wrapper.text()).toContain('Trip Not Available Offline');
    });

    it('renders all offline tabs and sections when bundle is loaded', async () => {
      offlineStore.activeTripBundle = sampleBundle;
      offlineStore.loadTripBundle = vi.fn().mockResolvedValue(sampleBundle);

      const wrapper = mount(OfflineTripDetailView, globalMountOptions);
      await flushPromises();

      expect(wrapper.text()).toContain('Swiss Alps Expedition');
      expect(wrapper.text()).toContain('Available Offline');

      // Itinerary tab by default
      expect(wrapper.text()).toContain('Gornergrat Railway');
      expect(wrapper.text()).toContain('Book window seat on right side');

      // Switch to Stays & Transport tab
      const staysTab = wrapper.findAll('button').find(b => b.text().includes('Stays & Transport'));
      expect(staysTab).toBeDefined();
      await staysTab.trigger('click');
      expect(wrapper.text()).toContain('Matterhorn Peak Lodge');
      expect(wrapper.text()).toContain('MAT-9901');

      // Switch to Emergency tab
      const emgTab = wrapper.findAll('button').find(b => b.text().includes('Emergency Info'));
      expect(emgTab).toBeDefined();
      await emgTab.trigger('click');
      expect(wrapper.text()).toContain('Swiss Air-Glaciers Rescue');
      expect(wrapper.text()).toContain('1414');

      // Switch to Packing Checklist tab
      const chkTab = wrapper.findAll('button').find(b => b.text().includes('Packing Checklist'));
      expect(chkTab).toBeDefined();
      await chkTab.trigger('click');
      expect(wrapper.text()).toContain('Passport & Travel Visa');
      expect(wrapper.text()).toContain('Thermal Layer & Hiking Boots');
    });

    it('interactively toggles checklist item locally without server request', async () => {
      offlineStore.activeTripBundle = JSON.parse(JSON.stringify(sampleBundle));
      offlineStore.loadTripBundle = vi.fn().mockResolvedValue(sampleBundle);
      offlineStore.toggleChecklistItem = vi.fn().mockImplementation((uid, tid, id, val) => {
        const itm = offlineStore.activeTripBundle.checklists.find(c => c.id === id);
        if (itm) itm.completed = val;
        return Promise.resolve();
      });

      const wrapper = mount(OfflineTripDetailView, globalMountOptions);
      await flushPromises();

      // Switch to checklist tab
      const chkTab = wrapper.findAll('button').find(b => b.text().includes('Packing Checklist'));
      await chkTab.trigger('click');

      const items = wrapper.findAll('.cursor-pointer');
      expect(items.length).toBeGreaterThanOrEqual(1);

      // Click second item
      await items[1].trigger('click');
      expect(offlineStore.toggleChecklistItem).toHaveBeenCalled();
    });

    it('interactively saves local notes', async () => {
      offlineStore.activeTripBundle = JSON.parse(JSON.stringify(sampleBundle));
      offlineStore.loadTripBundle = vi.fn().mockResolvedValue(sampleBundle);
      offlineStore.updateNote = vi.fn().mockResolvedValue();

      const wrapper = mount(OfflineTripDetailView, globalMountOptions);
      await flushPromises();

      // Switch to notes tab
      const notesTab = wrapper.findAll('button').find(b => b.text().includes('Travel Notes'));
      await notesTab.trigger('click');

      expect(wrapper.text()).toContain('Arrival Logistics');

      const saveBtn = wrapper.findAll('button').find(b => b.text().includes('Save Note Locally'));
      expect(saveBtn).toBeDefined();
      await saveBtn.trigger('click');

      expect(offlineStore.updateNote).toHaveBeenCalled();
    });
  });

  describe('OfflineBanner.vue', () => {
    it('renders notification banner when offline', async () => {
      mockIsOnline = false;
      mockIsServerReachable = false;

      const wrapper = mount(OfflineBanner, globalMountOptions);
      expect(wrapper.text()).toContain("You're currently offline");
      expect(wrapper.text()).toContain('Offline Trips');
      expect(wrapper.text()).toContain('Check Connection');
    });
  });
});
