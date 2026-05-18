<template>
  <div class="trip-presence" v-if="activeMembers && activeMembers.length > 0">
    <div
      v-for="member in activeMembers"
      :key="member.userId"
      class="presence-avatar"
      :title="member.name"
    >
      {{ getInitials(member.name) }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  activeMembers: {
    type: Array,
    default: () => []
  }
});

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};
</script>

<style scoped>
.trip-presence {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
}

.presence-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0ea5e9, #2563eb);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: bold;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  cursor: default;
  transition: transform 0.2s;
}

.presence-avatar:hover {
  transform: translateY(-2px);
}

:global(.dark) .presence-avatar {
  border-color: #1e293b;
}
</style>
