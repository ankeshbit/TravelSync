<template>
  <div class="demo-box">
    <div class="demo-header">
      <span class="material-symbols-outlined" style="font-size:16px">science</span>
      <span>Interview Demo Access</span>
    </div>
    <p class="demo-desc">
      1-click sign in with seeded fictional demo accounts:
    </p>
    <div class="demo-btns">
      <button
        type="button"
        @click="$emit('login', 'alice')"
        :disabled="loading"
        class="demo-btn demo-btn-alice"
      >
        <span class="material-symbols-outlined" style="font-size:15px">admin_panel_settings</span>
        <span>Alice (Owner)</span>
      </button>
      <button
        type="button"
        @click="$emit('login', 'bob')"
        :disabled="loading"
        class="demo-btn demo-btn-bob"
      >
        <span class="material-symbols-outlined" style="font-size:15px">person</span>
        <span>Bob (Member)</span>
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  loading: {
    type: Boolean,
    default: false
  }
})
defineEmits(['login'])
</script>

<style scoped>
.demo-box {
  margin-top: 1.5rem;
  padding: 1rem;
  border-radius: 0.75rem;
  border: 1px dashed rgba(99, 102, 241, 0.4);
  background: rgba(99, 102, 241, 0.05);
  text-align: center;
}
.demo-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  color: #4f46e5;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.375rem;
}
:global(.dark) .demo-header {
  color: #818cf8;
}
.demo-desc {
  font-size: 0.75rem;
  color: #64748b;
  margin-bottom: 0.75rem;
}
:global(.dark) .demo-desc {
  color: #94a3b8;
}
.demo-btns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}
.demo-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 0.5rem;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
.demo-btn-alice {
  background: #4f46e5;
  color: #ffffff;
}
.demo-btn-alice:hover {
  background: #4338ca;
}
.demo-btn-bob {
  background: #334155;
  color: #ffffff;
}
.demo-btn-bob:hover {
  background: #1e293b;
}
</style>

