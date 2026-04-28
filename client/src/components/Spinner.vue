<template>
  <div :class="{ 'inline-block': inline, 'flex justify-center': !inline }">
    <div class="animate-spin rounded-full border-2 border-gray-300 border-t-primary" :style="{ width: size, height: size }"></div>
  </div>
</template>

<script setup>
defineProps({
  size: {
    type: String,
    default: '24px'
  },
  inline: {
    type: Boolean,
    default: false
  }
});
</script>
