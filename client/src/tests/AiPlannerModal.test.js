import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import AiPlannerModal from '../components/AiPlannerModal.vue';
import api from '../api';
import { usePlacesStore } from '../stores/places';
import { useToastStore } from '../stores/toast';

vi.mock('../api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn()
  }
}));

describe('AiPlannerModal.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  const defaultProps = {
    isOpen: true,
    tripId: 'trip-123',
    destination: 'Kyoto',
    duration: 3
  };

  it('modal stays open after generate and does not emit itinerary-generated immediately', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        suggestions: {
          summary: 'A wonderful 3-day trip in Kyoto',
          days: [
            {
              day: 1,
              theme: 'Temples',
              places: [
                { name: 'Kinkaku-ji', type: 'attraction', description: 'Golden pavilion', lat: 35.039, lng: 135.729 }
              ]
            }
          ],
          tips: ['Buy bus pass']
        }
      }
    });

    const wrapper = mount(AiPlannerModal, {
      props: defaultProps,
      global: {
        stubs: { teleport: true }
      }
    });

    // Trigger generate itinerary
    const generateBtn = wrapper.findAll('button').find(b => b.text().includes('Generate Itinerary'));
    expect(generateBtn).toBeDefined();
    await generateBtn.trigger('click');
    await flushPromises();

    // Modal stays open, itinerary is rendered
    expect(wrapper.text()).toContain('A wonderful 3-day trip in Kyoto');
    expect(wrapper.text()).toContain('Kinkaku-ji');

    // Does NOT emit itinerary-generated immediately
    expect(wrapper.emitted('itinerary-generated')).toBeUndefined();
    // Does NOT close modal
    expect(wrapper.emitted('update:isOpen')).toBeUndefined();
  });

  it('Done emits itinerary-generated once with added places and closes modal', async () => {
    api.post.mockImplementation((url, data) => {
      if (url.includes('ai-suggestions')) {
        return Promise.resolve({
          data: {
            suggestions: {
              summary: 'Kyoto tour',
              days: [{
                day: 1,
                theme: 'Temples',
                places: [{ name: 'Kinkaku-ji', lat: 35.039, lng: 135.729 }]
              }]
            }
          }
        });
      }
      if (url.includes('/places')) {
        return Promise.resolve({
          data: { id: 'p1', name: data.name, orderIndex: data.orderIndex, dayNumber: data.dayNumber }
        });
      }
      return Promise.resolve({ data: {} });
    });
    api.get.mockResolvedValueOnce({ data: [] });

    const wrapper = mount(AiPlannerModal, {
      props: defaultProps,
      global: {
        stubs: { teleport: true }
      }
    });

    // Generate
    const generateBtn = wrapper.findAll('button').find(b => b.text().includes('Generate Itinerary'));
    await generateBtn.trigger('click');
    await flushPromises();

    // Add place to itinerary
    const addBtn = wrapper.findAll('button').find(b => b.text().includes('Add to itinerary'));
    expect(addBtn).toBeDefined();
    await addBtn.trigger('click');
    await flushPromises();

    // Click Done
    const doneBtn = wrapper.findAll('button').find(b => b.text().trim() === 'Done');
    expect(doneBtn).toBeDefined();
    await doneBtn.trigger('click');
    await flushPromises();

    // Emits itinerary-generated once with added places list
    expect(wrapper.emitted('itinerary-generated')).toHaveLength(1);
    expect(wrapper.emitted('itinerary-generated')[0][0]).toEqual([
      expect.objectContaining({ name: 'Kinkaku-ji' })
    ]);
    // Closes modal
    expect(wrapper.emitted('update:isOpen')).toEqual([[false]]);
  });

  it('computes orderIndex correctly appending after max orderIndex of the day after fetching current trip places', async () => {
    const placesStore = usePlacesStore();
    // Simulate stale places in store from another trip
    placesStore.places = [{ id: 'other-trip-p', tripId: 'other-trip', dayNumber: 1, orderIndex: 10 }];

    // Fresh fetch returns places for current trip on day 1 with max orderIndex 2
    api.get.mockImplementation((url) => {
      if (url === '/trips/trip-123/places') {
        return Promise.resolve({
          data: [
            { id: 'cur-1', tripId: 'trip-123', dayNumber: 1, orderIndex: 0 },
            { id: 'cur-2', tripId: 'trip-123', dayNumber: 1, orderIndex: 2 }
          ]
        });
      }
      return Promise.resolve({ data: [] });
    });

    let savedPlaceData = null;
    api.post.mockImplementation((url, data) => {
      if (url.includes('ai-suggestions')) {
        return Promise.resolve({
          data: {
            suggestions: {
              summary: 'Kyoto tour',
              days: [{
                day: 1,
                theme: 'Temples',
                places: [{ name: 'Ginkaku-ji', lat: 35.027, lng: 135.798 }]
              }]
            }
          }
        });
      }
      if (url.includes('/places')) {
        savedPlaceData = data;
        return Promise.resolve({
          data: { id: 'new-p', ...data }
        });
      }
      return Promise.resolve({ data: {} });
    });

    const wrapper = mount(AiPlannerModal, {
      props: defaultProps,
      global: {
        stubs: { teleport: true }
      }
    });

    // Generate
    const generateBtn = wrapper.findAll('button').find(b => b.text().includes('Generate Itinerary'));
    await generateBtn.trigger('click');
    await flushPromises();

    // Add place
    const addBtn = wrapper.findAll('button').find(b => b.text().includes('Add to itinerary'));
    await addBtn.trigger('click');
    await flushPromises();

    expect(api.get).toHaveBeenCalledWith('/trips/trip-123/places');
    expect(savedPlaceData).toBeDefined();
    // Max orderIndex was 2, so next must be 3
    expect(savedPlaceData.orderIndex).toBe(3);
  });

  it('skips adding place and warns if lat/lng are missing', async () => {
    const toastStore = useToastStore();
    const showToastSpy = vi.spyOn(toastStore, 'showToast');

    api.post.mockResolvedValueOnce({
      data: {
        suggestions: {
          summary: 'Kyoto tour',
          days: [{
            day: 1,
            theme: 'Temples',
            places: [{ name: 'Mystery Spot' }] // Missing lat/lng
          }]
        }
      }
    });

    const wrapper = mount(AiPlannerModal, {
      props: defaultProps,
      global: {
        stubs: { teleport: true }
      }
    });

    // Generate
    const generateBtn = wrapper.findAll('button').find(b => b.text().includes('Generate Itinerary'));
    await generateBtn.trigger('click');
    await wrapper.vm.$nextTick();

    // Add place
    const addBtn = wrapper.findAll('button').find(b => b.text().includes('Add to itinerary'));
    await addBtn.trigger('click');

    expect(showToastSpy).toHaveBeenCalledWith(
      expect.stringContaining('Skipping "Mystery Spot" without valid coordinates'),
      'warning'
    );
    expect(api.get).not.toHaveBeenCalled();
  });
});
