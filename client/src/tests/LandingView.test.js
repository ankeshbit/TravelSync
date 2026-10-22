import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import LandingView from '../views/LandingView.vue';
import { useAuthStore } from '../stores/auth';

const routerLinkStub = {
  name: 'RouterLink',
  props: ['to'],
  template: '<a :href="typeof to === \'string\' ? to : to.path"><slot /></a>'
};

describe('LandingView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    class MockIntersectionObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    window.IntersectionObserver = MockIntersectionObserver;
  });

  it('renders all key sections and branding', () => {
    const authStore = useAuthStore();
    authStore.firebaseUser = null;

    const wrapper = mount(LandingView, {
      global: {
        stubs: {
          RouterLink: routerLinkStub
        }
      }
    });

    // Branding
    expect(wrapper.text()).toContain('TravelSync');
    expect(wrapper.text()).toContain('Find the places that feel like you');

    // Key sections
    expect(wrapper.find('#hero').exists()).toBe(true);
    expect(wrapper.find('#about').exists()).toBe(true);
    expect(wrapper.find('#categories').exists()).toBe(true);
    expect(wrapper.find('#how-it-works').exists()).toBe(true);

    // Categories
    expect(wrapper.text()).toContain('Alpine Wilderness');
    expect(wrapper.text()).toContain('Coastal Sanctuary');
    expect(wrapper.text()).toContain('Urban Heritage');
    expect(wrapper.text()).toContain('Raw Exploration');

    // How it works steps
    expect(wrapper.text()).toContain('Tell Us What You Love');
    expect(wrapper.text()).toContain('Discover Your Possibilities');
    expect(wrapper.text()).toContain('Find Your Next Adventure');
  });

  it('shows "Continue with TravelSync" pointing to /login when unauthenticated', () => {
    const authStore = useAuthStore();
    authStore.firebaseUser = null;

    const wrapper = mount(LandingView, {
      global: {
        stubs: {
          RouterLink: routerLinkStub
        }
      }
    });

    const ctaLinks = wrapper.findAll('a').filter(a => a.text().includes('Continue with TravelSync'));
    expect(ctaLinks.length).toBeGreaterThan(0);
    ctaLinks.forEach(link => {
      expect(link.attributes('href')).toBe('/login');
    });
  });

  it('shows "Go to Dashboard" when authenticated', () => {
    const authStore = useAuthStore();
    authStore.firebaseUser = { uid: 'u1', emailVerified: true };

    const wrapper = mount(LandingView, {
      global: {
        stubs: {
          RouterLink: routerLinkStub
        }
      }
    });

    expect(wrapper.text()).toContain('Go to Dashboard');
  });

  it('toggles mobile menu when hamburger button is clicked', async () => {
    const wrapper = mount(LandingView, {
      global: {
        stubs: {
          RouterLink: routerLinkStub
        }
      }
    });

    const toggleBtn = wrapper.find('button[aria-label="Toggle Navigation Menu"]');
    expect(toggleBtn.exists()).toBe(true);

    expect(wrapper.vm.mobileMenuOpen).toBe(false);
    await toggleBtn.trigger('click');
    expect(wrapper.vm.mobileMenuOpen).toBe(true);
    await toggleBtn.trigger('click');
    expect(wrapper.vm.mobileMenuOpen).toBe(false);
  });

  it('updates active section when scrollToSection is called', () => {
    const wrapper = mount(LandingView, {
      global: {
        stubs: {
          RouterLink: routerLinkStub
        }
      }
    });

    // Mock document.getElementById
    const mockElement = { scrollIntoView: vi.fn() };
    vi.spyOn(document, 'getElementById').mockReturnValue(mockElement);

    wrapper.vm.scrollToSection('categories');
    expect(wrapper.vm.activeSection).toBe('categories');
    expect(mockElement.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });
});
