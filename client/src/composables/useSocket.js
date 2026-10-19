import { onUnmounted, ref, toValue, watch } from 'vue';
import { useRouter } from 'vue-router';
import { io } from 'socket.io-client';
import { auth } from '../firebase';
import { usePlacesStore } from '../stores/places';
import { useExpensesStore } from '../stores/expenses';
import { useTripsStore } from '../stores/trips';
import { useToastStore } from '../stores/toast';
import { getBaseUrl } from '../utils/url';

export function useSocket(tripId) {
  const router = useRouter();
  const placesStore = usePlacesStore();
  const expensesStore = useExpensesStore();
  const tripsStore = useTripsStore();
  const toastStore = useToastStore();
  const socket = ref(null);
  const activeMembers = ref([]);

  function disconnectSocket() {
    if (socket.value) {
      socket.value.removeAllListeners();
      socket.value.disconnect();
      socket.value = null;
    }
    activeMembers.value = [];
  }

  function connectSocket(rawTripId) {
    disconnectSocket();
    if (!rawTripId) return;

    const socketURL = getBaseUrl();

    socket.value = io(socketURL, {
      auth: async (cb) => {
        try {
          const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
          cb({ token });
        } catch {
          cb({ token: null });
        }
      },
      query: { tripId: rawTripId }
    });

    socket.value.on('connect_error', (err) => {
      console.error('Socket connect error:', err.message);
    });

    socket.value.on('presence:list', (list) => {
      activeMembers.value = (Array.isArray(list) ? list : []).map(u => ({
        userId: u.id || u.userId,
        name: u.name
      }));
    });

    socket.value.on('user:joined', (user) => {
      const uid = user.id || user.userId;
      if (!activeMembers.value.some(m => m.userId === uid)) {
        activeMembers.value.push({ userId: uid, name: user.name });
      }
    });

    socket.value.on('user:left', (data) => {
      const uid = data.userId || data.id;
      activeMembers.value = activeMembers.value.filter(m => m.userId !== uid);
    });

    socket.value.on('place:added', (place) => {
      const placeId = place.id || place._id;
      if (!placesStore.places.some(p => (p.id || p._id) === placeId)) {
        placesStore.places.push(place);
        toastStore.showToast('A member added a place', 'info');
      }
    });

    socket.value.on('place:deleted', (data) => {
      const exists = placesStore.places.find(p => (p.id || p._id) === data.placeId);
      if (exists) {
        placesStore.places = placesStore.places.filter(p => (p.id || p._id) !== data.placeId);
        toastStore.showToast('A member deleted a place', 'info');
      }
    });

    socket.value.on('place:reordered', (places) => {
      placesStore.places = places;
      toastStore.showToast('A member reordered places', 'info');
    });

    socket.value.on('place:note_updated', (updatedPlace) => {
      const placeId = updatedPlace.id || updatedPlace._id;
      const index = placesStore.places.findIndex(p => (p.id || p._id) === placeId);
      if (index !== -1) {
        placesStore.places[index] = updatedPlace;
        toastStore.showToast('A member updated a note', 'info');
      }
    });

    socket.value.on('expense:added', (expense) => {
      const expenseId = expense.id || expense._id;
      if (!expensesStore.expenses.some(e => (e.id || e._id) === expenseId)) {
        expensesStore.expenses.push(expense);
        expensesStore.fetchBalances(rawTripId).catch(() => {});
        toastStore.showToast('A member added an expense', 'info');
      }
    });

    socket.value.on('expense:deleted', (data) => {
      const exists = expensesStore.expenses.find(e => (e.id || e._id) === data.expenseId);
      if (exists) {
        expensesStore.expenses = expensesStore.expenses.filter(e => (e.id || e._id) !== data.expenseId);
        expensesStore.fetchBalances(rawTripId).catch(() => {});
        toastStore.showToast('A member deleted an expense', 'info');
      }
    });

    socket.value.on('member:joined', (user) => {
      toastStore.showToast(`${user.name || user.email || 'A new member'} joined the trip`, 'info');
      tripsStore.fetchTrip(rawTripId).catch(() => {});
    });

    socket.value.on('trip:updated', () => {
      tripsStore.fetchTrip(rawTripId).catch(() => {});
    });

    socket.value.on('trip:deleted', () => {
      toastStore.showToast('This trip has been deleted by the owner', 'warning');
      router.push('/dashboard').catch(() => {});
    });

    socket.value.on('trip:removed', () => {
      toastStore.showToast('You have been removed from this trip', 'warning');
      router.push('/dashboard').catch(() => {});
    });
  }

  watch(() => toValue(tripId), (newTripId) => {
    connectSocket(newTripId);
  }, { immediate: true });

  onUnmounted(() => {
    disconnectSocket();
  });

  return {
    socket,
    activeMembers
  };
}
