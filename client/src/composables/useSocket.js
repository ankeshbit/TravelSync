import { onMounted, onUnmounted, ref } from 'vue';
import { io } from 'socket.io-client';
import { usePlacesStore } from '../stores/places';
import { useExpensesStore } from '../stores/expenses';
import { useToastStore } from '../stores/toast';
import { useAuthStore } from '../stores/auth';

export function useSocket(tripId) {
  const placesStore = usePlacesStore();
  const expensesStore = useExpensesStore();
  const toastStore = useToastStore();
  const authStore = useAuthStore();
  const socket = ref(null);
  const activeMembers = ref([]);

  onMounted(() => {
    const socketURL = import.meta.env.VITE_API_BASE_URL ? import.meta.env.VITE_API_BASE_URL.replace('/api', '') : 'http://localhost:3000';

    socket.value = io(socketURL, {
      auth: (cb) => cb({ token: authStore.accessToken }),
      query: { tripId }
    });

    socket.value.on('connect_error', (err) => {
      console.error('Socket connect error:', err.message);
    });

    socket.value.on('place:added', (place) => {
      if (!placesStore.places.some(p => p._id === place._id)) {
        placesStore.places.push(place);
        toastStore.showToast(`A member added a place`, 'info');
      }
    });

    socket.value.on('place:deleted', (data) => {
      const exists = placesStore.places.find(p => p._id === data.placeId);
      if (exists) {
        placesStore.places = placesStore.places.filter(p => p._id !== data.placeId);
        toastStore.showToast(`A member deleted a place`, 'info');
      }
    });

    socket.value.on('place:reordered', (places) => {
      placesStore.places = places;
      toastStore.showToast(`A member reordered places`, 'info');
    });

    socket.value.on('place:note_updated', (updatedPlace) => {
      const index = placesStore.places.findIndex(p => p._id === updatedPlace._id);
      if (index !== -1) {
        placesStore.places[index] = updatedPlace;
        toastStore.showToast('A member updated a note', 'info');
      }
    });

    socket.value.on('expense:added', (expense) => {
      if (!expensesStore.expenses.some(e => e._id === expense._id)) {
        expensesStore.expenses.push(expense);
        expensesStore.fetchBalances(tripId);
        toastStore.showToast(`A member added an expense`, 'info');
      }
    });

    socket.value.on('expense:deleted', (data) => {
      const exists = expensesStore.expenses.find(e => e._id === data.expenseId);
      if (exists) {
        expensesStore.expenses = expensesStore.expenses.filter(e => e._id !== data.expenseId);
        expensesStore.fetchBalances(tripId);
        toastStore.showToast(`A member deleted an expense`, 'info');
      }
    });

    socket.value.on('member:joined', (user) => {
      // Just a toast, activeMembers handled by user:joined
      toastStore.showToast(`${user.name || 'A new member'} joined the trip`, 'info');
    });

    socket.value.on('user:joined', (user) => {
      if (!activeMembers.value.some(m => m.userId === user.userId)) {
        activeMembers.value.push(user);
      }
    });

    socket.value.on('user:left', (data) => {
      activeMembers.value = activeMembers.value.filter(m => m.userId !== data.userId);
    });
  });

  onUnmounted(() => {
    if (socket.value) {
      socket.value.disconnect();
    }
  });

  return {
    socket,
    activeMembers
  };
}
