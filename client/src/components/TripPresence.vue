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
  background: #22231F;
  color: #D5D3CA;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  border: 1.5px solid #86A98B;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  cursor: default;
  transition: transform 0.2s;
}

.presence-avatar:hover {
  transform: translateY(-2px);
}

:global(.dark) .presence-avatar {
  border-color: #86A98B;
  background: #22231F;
  color: #D5D3CA;
}
</style>
