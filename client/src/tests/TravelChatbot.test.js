import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import TravelChatbot from '../components/TravelChatbot.vue';
import api from '../api';
import { useAuthStore } from '../stores/auth';

vi.mock('../api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn()
  }
}));

const mockPush = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush
  })
}));

describe('TravelChatbot.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('renders floating trigger button initially', () => {
    const wrapper = mount(TravelChatbot);
    const triggerBtn = wrapper.find('#travel-chatbot-toggle-btn');
    expect(triggerBtn.exists()).toBe(true);
    expect(wrapper.find('#travel-chatbot-window').exists()).toBe(false);
  });

  it('opens chat window when floating button is clicked', async () => {
    const wrapper = mount(TravelChatbot);
    const triggerBtn = wrapper.find('#travel-chatbot-toggle-btn');
    await triggerBtn.trigger('click');

    expect(wrapper.find('#travel-chatbot-window').exists()).toBe(true);
    expect(wrapper.text()).toContain('TravelSync AI Guide');
  });

  it('sends natural language query and displays destination recommendations with grounded explanations', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        message: 'Based on relaxing beach in Goa, here are recommendations:',
        follow_up_questions: [],
        extracted_preferences: { region: 'India', travel_type: 'beach' },
        recommendations: [
          {
            rank: 1,
            destination_id: 'goa',
            destination: 'Goa',
            country: 'India',
            region: 'India',
            subregion: 'West India',
            match_score: 92.0,
            budget_level: 'moderate',
            estimated_daily_cost: 4200,
            currency: 'INR',
            estimated_daily_cost_usd: 50.4,
            estimated_budget: 'INR 4,200/day (~US$50; moderate band, illustrative)',
            suggested_duration: 'about 5 days',
            suitable_activities: 'Beach hopping; Water sports; Sunset cruise',
            best_seasons: ['winter'],
            travel_pace: 'relaxed',
            suitable_companions: ['solo', 'couple', 'friends'],
            explanation: 'It rates 10/10 for beach; fits your moderate budget',
            trade_offs: 'None notable.',
            destination_description: 'Famous coastal hub.'
          }
        ],
        is_ambiguous: false
      }
    });

    const wrapper = mount(TravelChatbot);
    await wrapper.find('#travel-chatbot-toggle-btn').trigger('click');

    const input = wrapper.find('#travel-chatbot-input');
    await input.setValue('Goa beach vacation');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(api.post).toHaveBeenCalledWith('/recommendations/chat', {
      message: 'Goa beach vacation',
      previous_preferences: null
    }, {
      skipAuthRedirect: true,
      skipErrorToast: true
    });

    expect(wrapper.text()).toContain('Goa');
    expect(wrapper.text()).toContain('92% match');
    expect(wrapper.text()).toContain('It rates 10/10 for beach');
  });

  it('displays follow-up questions when query is ambiguous', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        message: 'I have some ideas, but tell me more:',
        follow_up_questions: ['Are you looking for trips within India or international destinations?'],
        extracted_preferences: {},
        recommendations: [],
        is_ambiguous: true
      }
    });

    const wrapper = mount(TravelChatbot);
    await wrapper.find('#travel-chatbot-toggle-btn').trigger('click');

    const input = wrapper.find('#travel-chatbot-input');
    await input.setValue('I want to travel');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(wrapper.text()).toContain('Help me narrow this down:');
    expect(wrapper.text()).toContain('Are you looking for trips within India or international destinations?');
  });

  it('opens CreateTripModal with prefilled destination when Plan Trip is clicked (no 404 navigation)', async () => {
    const authStore = useAuthStore();
    authStore.firebaseUser = { uid: 'test-user-123' };

    api.post.mockResolvedValueOnce({
      data: {
        message: 'Top match:',
        recommendations: [
          {
            rank: 1,
            destination_id: 'goa',
            destination: 'Goa',
            country: 'India',
            region: 'India',
            subregion: 'West India',
            match_score: 95.0,
            budget_level: 'moderate',
            estimated_daily_cost: 4200,
            currency: 'INR',
            estimated_daily_cost_usd: 50.4,
            estimated_budget: 'INR 4,200/day',
            suggested_duration: 'about 5 days',
            suitable_activities: 'Beach',
            best_seasons: ['winter'],
            travel_pace: 'relaxed',
            suitable_companions: ['couple'],
            explanation: 'Fits budget',
            trade_offs: 'None notable.',
            destination_description: 'Goa beaches.'
          }
        ]
      }
    });

    const wrapper = mount(TravelChatbot, {
      global: {
        stubs: {
          teleport: true
        }
      }
    });

    // Open chat and get recommendation
    await wrapper.find('#travel-chatbot-toggle-btn').trigger('click');
    const input = wrapper.find('#travel-chatbot-input');
    await input.setValue('Goa trip');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    // Click "Plan Trip" button on the card
    const planTripBtn = wrapper.findAll('button').find(b => b.text().includes('Plan Trip'));
    expect(planTripBtn).toBeDefined();
    await planTripBtn.trigger('click');
    await flushPromises();

    // Verify it did NOT navigate to the invalid '/trips' route (which caused Page Not Found)
    expect(mockPush).not.toHaveBeenCalledWith(expect.objectContaining({ path: '/trips' }));

    // Verify the CreateTripModal is now open with initialDestination = 'Goa'
    const modal = wrapper.findComponent({ name: 'CreateTripModal' });
    expect(modal.exists()).toBe(true);
    expect(modal.props('isOpen')).toBe(true);
    expect(modal.props('initialDestination')).toBe('Goa');

    // Simulate trip creation event from the modal
    await modal.vm.$emit('trip-created', { id: 'new-trip-789', destination: 'Goa' });
    await flushPromises();

    // Verify it navigated to the registered itinerary route /trips/new-trip-789
    expect(mockPush).toHaveBeenCalledWith('/trips/new-trip-789');
  });

  it('prompts unauthenticated user to log in when Plan Trip is clicked', async () => {
    const authStore = useAuthStore();
    authStore.firebaseUser = null; // Unauthenticated

    api.post.mockResolvedValueOnce({
      data: {
        message: 'Top match:',
        recommendations: [
          {
            rank: 1,
            destination_id: 'goa',
            destination: 'Goa',
            country: 'India',
            region: 'India',
            subregion: 'West India',
            match_score: 95.0,
            budget_level: 'moderate',
            estimated_daily_cost: 4200,
            currency: 'INR',
            estimated_daily_cost_usd: 50.4,
            estimated_budget: 'INR 4,200/day',
            suggested_duration: 'about 5 days',
            suitable_activities: 'Beach',
            best_seasons: ['winter'],
            travel_pace: 'relaxed',
            suitable_companions: ['couple'],
            explanation: 'Fits budget',
            trade_offs: 'None notable.',
            destination_description: 'Goa beaches.'
          }
        ]
      }
    });

    const wrapper = mount(TravelChatbot, {
      global: {
        stubs: {
          teleport: true
        }
      }
    });

    await wrapper.find('#travel-chatbot-toggle-btn').trigger('click');
    const input = wrapper.find('#travel-chatbot-input');
    await input.setValue('Goa trip');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    const planTripBtn = wrapper.findAll('button').find(b => b.text().includes('Plan Trip'));
    await planTripBtn.trigger('click');
    await flushPromises();

    // Verify redirect to /login
    expect(mockPush).toHaveBeenCalledWith({
      path: '/login',
      query: { redirect: '/dashboard?create=1&dest=Goa' }
    });
  });

  it('persists accumulated preferences and sends direct_preference_update when structured option chip is clicked', async () => {
    // Turn 1 response: asks for budget
    api.post.mockResolvedValueOnce({
      data: {
        message: 'Based on adventure vibe in Europe for 7 days, please select your budget:',
        extracted_preferences: {
          travel_type: 'adventure',
          interests: ['mountains'],
          region: 'Europe',
          duration_days: 7
        },
        follow_up_questions: ['What is your preferred budget range?'],
        structured_follow_ups: [
          {
            field: 'budget_level',
            question: 'What is your preferred budget range?',
            options: [
              { label: 'Budget (< $50/day)', value: 'budget' },
              { label: 'Moderate ($50-$130)', value: 'moderate' },
              { label: 'Luxury (> $130)', value: 'premium' }
            ]
          }
        ],
        recommendations: []
      }
    });

    const wrapper = mount(TravelChatbot);
    await wrapper.find('#travel-chatbot-toggle-btn').trigger('click');

    const input = wrapper.find('#travel-chatbot-input');
    await input.setValue('Mountain adventure in Europe for 7 days');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    // Verify turn 1 call
    expect(api.post).toHaveBeenNthCalledWith(1, '/recommendations/chat', {
      message: 'Mountain adventure in Europe for 7 days',
      previous_preferences: null
    }, {
      skipAuthRedirect: true,
      skipErrorToast: true
    });

    // Check that structured chip buttons rendered
    const optionChips = wrapper.findAll('.follow-up-option-btn');
    expect(optionChips.length).toBe(3);
    expect(optionChips[0].text()).toContain('Budget');

    // Turn 2: Click "Budget (< $50/day)" chip
    api.post.mockResolvedValueOnce({
      data: {
        message: 'Based on adventure vibe in Europe on a budget for 7 days...',
        extracted_preferences: {
          travel_type: 'adventure',
          interests: ['mountains'],
          region: 'Europe',
          duration_days: 7,
          budget_level: 'budget'
        },
        structured_follow_ups: [],
        recommendations: [
          {
            rank: 1,
            destination_id: 'lucerne',
            destination: 'Lucerne',
            country: 'Switzerland',
            subregion: 'Western Europe',
            match_score: 88.0,
            estimated_daily_cost: 160,
            currency: 'CHF',
            estimated_daily_cost_usd: 179.2,
            best_seasons: ['summer'],
            suitable_companions: ['couple'],
            explanation: 'It rates 10/10 for mountain scenery',
            trade_offs: 'Daily costs exceed budget range',
            suitable_activities: 'Alpine hiking',
            is_alternative: true
          }
        ]
      }
    });

    await optionChips[0].trigger('click');
    await flushPromises();

    // Verify turn 2 call sent direct_preference_update and previous_preferences
    expect(api.post).toHaveBeenNthCalledWith(2, '/recommendations/chat', {
      message: 'Budget (< $50/day)',
      previous_preferences: {
        travel_type: 'adventure',
        interests: ['mountains'],
        region: 'Europe',
        duration_days: 7
      },
      direct_preference_update: { budget_level: 'budget' }
    }, {
      skipAuthRedirect: true,
      skipErrorToast: true
    });

    // Check that user message bubble displays the chip label cleanly
    expect(wrapper.text()).toContain('Budget (< $50/day)');
    expect(wrapper.text()).not.toContain('on a budget budget');
    expect(wrapper.text()).toContain('Higher-Budget Alternative');
  });

  it('decodes HTML entities in explanations and cards safely', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        message: '&#x49;t fits your adventure request&#x20;well.',
        recommendations: [
          {
            rank: 1,
            destination_id: 'lucerne',
            destination: 'Lucerne',
            country: 'Switzerland',
            subregion: 'Western Europe',
            match_score: 90.0,
            estimated_daily_cost: 160,
            currency: 'CHF',
            estimated_daily_cost_usd: 179.2,
            best_seasons: ['summer'],
            suitable_companions: ['couple'],
            explanation: '&#x49;t rates 10/10&#x20;for mountains. &#x47;ood fit; &#x4C;imited budget options.',
            trade_offs: '&#x4C;imited availability in winter &amp; high prices.',
            suitable_activities: 'Hiking &amp; skiing',
            is_alternative: true
          }
        ]
      }
    });

    const wrapper = mount(TravelChatbot);
    await wrapper.find('#travel-chatbot-toggle-btn').trigger('click');

    const input = wrapper.find('#travel-chatbot-input');
    await input.setValue('Lucerne info');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    // Verify decoded plain text
    expect(wrapper.text()).toContain('It fits your adventure request well.');
    expect(wrapper.text()).toContain('It rates 10/10 for mountains. Good fit; Limited budget options.');
    expect(wrapper.text()).toContain('Limited availability in winter & high prices.');
    expect(wrapper.text()).not.toContain('&#x49;');
    expect(wrapper.text()).not.toContain('&#x20;');
    expect(wrapper.text()).not.toContain('&amp;');
  });

  it('tolerates missing or null optional fields in destination cards without throwing', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        message: 'Top match with missing optional attributes:',
        recommendations: [
          {
            rank: 1,
            destination_id: 'minimal_dest',
            destination: 'Minimal Destination',
            country: 'Nowhere',
            region: 'Unknown',
            subregion: 'Somewhere',
            match_score: 80.0,
            budget_level: 'budget',
            estimated_daily_cost: null, // null daily cost
            currency: null,
            estimated_daily_cost_usd: null,
            suggested_duration: null,
            suitable_activities: null,
            best_seasons: null, // null seasons list
            travel_pace: null,
            suitable_companions: null, // null companions list
            explanation: 'Grounded match description',
            trade_offs: '',
            destination_description: ''
          }
        ]
      }
    });

    const wrapper = mount(TravelChatbot);
    await wrapper.find('#travel-chatbot-toggle-btn').trigger('click');
    const input = wrapper.find('#travel-chatbot-input');
    await input.setValue('Minimal request');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(wrapper.text()).toContain('Minimal Destination');
    expect(wrapper.text()).toContain('80% match');
  });

  it('displays rate limit error message when 429 is returned', async () => {
    api.post.mockRejectedValueOnce({
      response: {
        status: 429,
        data: { message: 'Too many requests' }
      }
    });

    const wrapper = mount(TravelChatbot);
    await wrapper.find('#travel-chatbot-toggle-btn').trigger('click');
    const input = wrapper.find('#travel-chatbot-input');
    await input.setValue('Fast query');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(wrapper.text()).toContain('You are sending requests too quickly');
  });

  it('resets conversation state when reset button is clicked', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        message: 'Here is your recommendation:',
        recommendations: []
      }
    });

    const wrapper = mount(TravelChatbot);
    await wrapper.find('#travel-chatbot-toggle-btn').trigger('click');
    const input = wrapper.find('#travel-chatbot-input');
    await input.setValue('First turn');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(wrapper.text()).toContain('First turn');

    // Click reset button
    const resetBtn = wrapper.find('#travel-chatbot-reset-btn');
    expect(resetBtn.exists()).toBe(true);
    await resetBtn.trigger('click');
    await flushPromises();

    // Check that previous message was cleared
    expect(wrapper.text()).not.toContain('First turn');
  });
});
