import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { useSocket } from '../composables/useSocket';
import { useExpensesStore } from '../stores/expenses';
import { useToastStore } from '../stores/toast';

const listeners = {};
const mockSocket = {
  on: vi.fn((event, cb) => {
    listeners[event] = cb;
  }),
  emit: vi.fn(),
  removeAllListeners: vi.fn(() => {
    Object.keys(listeners).forEach(k => delete listeners[k]);
  }),
  disconnect: vi.fn()
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket)
}));

const mockPush = vi.fn().mockResolvedValue();
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush })
}));

vi.mock('../firebase', () => ({
  auth: { currentUser: null }
}));

describe('useSocket composable', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    Object.keys(listeners).forEach(k => delete listeners[k]);
  });

  it('connects to socket and manages active members list', async () => {
    let composable;
    const TestComponent = defineComponent({
      setup() {
        composable = useSocket('trip-123');
        return () => h('div');
      }
    });

    const wrapper = mount(TestComponent);

    expect(composable.activeMembers.value).toEqual([]);
    expect(mockSocket.on).toHaveBeenCalledWith('presence:list', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('user:joined', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('user:left', expect.any(Function));

    // Simulate presence:list
    listeners['presence:list']([
      { id: 'u1', name: 'Alice' },
      { id: 'u2', name: 'Bob' }
    ]);
    expect(composable.activeMembers.value).toEqual([
      { userId: 'u1', name: 'Alice' },
      { userId: 'u2', name: 'Bob' }
    ]);

    // Simulate user:joined
    listeners['user:joined']({ id: 'u3', name: 'Charlie' });
    expect(composable.activeMembers.value.length).toBe(3);
    expect(composable.activeMembers.value[2].name).toBe('Charlie');

    // Simulate user:left
    listeners['user:left']({ userId: 'u2' });
    expect(composable.activeMembers.value.map(m => m.userId)).toEqual(['u1', 'u3']);

    // Unmount and check cleanup
    wrapper.unmount();
    expect(mockSocket.removeAllListeners).toHaveBeenCalled();
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it('deletes the ONLY expense, refetches balances, and shows toast on expense:deleted', async () => {
    const expensesStore = useExpensesStore();
    const toastStore = useToastStore();
    expensesStore.expenses = [{ id: 'exp-1', title: 'Coffee', amount: 5 }];
    const fetchBalancesSpy = vi.spyOn(expensesStore, 'fetchBalances').mockResolvedValue();

    const TestComponent = defineComponent({
      setup() {
        useSocket('trip-123');
        return () => h('div');
      }
    });

    const wrapper = mount(TestComponent);

    expect(listeners['expense:deleted']).toBeDefined();

    // Trigger expense:deleted on the only expense
    listeners['expense:deleted']({ expenseId: 'exp-1' });

    expect(expensesStore.expenses).toEqual([]);
    expect(fetchBalancesSpy).toHaveBeenCalledWith('trip-123');
    expect(toastStore.toasts.some(t => t.message.includes('deleted an expense'))).toBe(true);

    wrapper.unmount();
  });

  it('switching tripId reconnects once and old listeners no longer fire', async () => {
    const currentTripId = ref('trip-1');
    let composable;
    const TestComponent = defineComponent({
      setup() {
        composable = useSocket(() => currentTripId.value);
        return () => h('div');
      }
    });

    const wrapper = mount(TestComponent);

    const { io } = await import('socket.io-client');
    expect(io).toHaveBeenCalledTimes(1);
    expect(io).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      query: { tripId: 'trip-1' }
    }));

    // Trigger user:joined on old connection
    listeners['user:joined']({ id: 'u-initial', name: 'User Initial' });
    expect(composable.activeMembers.value.length).toBe(1);

    // Switch to trip-2
    currentTripId.value = 'trip-2';
    await wrapper.vm.$nextTick();

    expect(mockSocket.removeAllListeners).toHaveBeenCalled();
    expect(mockSocket.disconnect).toHaveBeenCalled();
    expect(io).toHaveBeenCalledTimes(2);
    expect(io).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({
      query: { tripId: 'trip-2' }
    }));

    // Active members should be reset
    expect(composable.activeMembers.value).toEqual([]);

    wrapper.unmount();
  });

  it('trip:deleted followed by trip:removed redirects and toasts only once', async () => {
    const toastStore = useToastStore();
    const showToastSpy = vi.spyOn(toastStore, 'showToast');

    const TestComponent = defineComponent({
      setup() {
        useSocket('trip-123');
        return () => h('div');
      }
    });

    const wrapper = mount(TestComponent);

    listeners['trip:deleted']();
    listeners['trip:removed']();

    expect(showToastSpy).toHaveBeenCalledTimes(1);
    expect(showToastSpy).toHaveBeenCalledWith('This trip has been deleted by the owner', 'warning');
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/dashboard');

    wrapper.unmount();
  });
});
