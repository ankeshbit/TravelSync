import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { useSocket } from '../composables/useSocket';

const listeners = {};
const mockSocket = {
  on: vi.fn((event, cb) => {
    listeners[event] = cb;
  }),
  emit: vi.fn(),
  removeAllListeners: vi.fn(),
  disconnect: vi.fn()
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket)
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn().mockResolvedValue() })
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
});
