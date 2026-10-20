<template>
  <!-- From Uiverse.io by Admin12121 - Adapted for TravelSync -->
  <button
    type="button"
    class="new-transaction-container group"
    @click="handleClick"
    aria-label="New Transaction - Add Expense"
  >
    <div class="new-transaction-left-side">
      <!-- Animated Payment Card -->
      <div class="new-transaction-card">
        <div class="new-transaction-card-line"></div>
        <div class="new-transaction-buttons"></div>
      </div>

      <!-- Animated Terminal / Post with Dollar Display -->
      <div class="new-transaction-post">
        <div class="new-transaction-post-line"></div>
        <div class="new-transaction-screen">
          <div class="new-transaction-dollar">$</div>
        </div>
        <div class="new-transaction-numbers"></div>
        <div class="new-transaction-numbers-line2"></div>
      </div>
    </div>

    <!-- Right Label & Animated Arrow -->
    <div class="new-transaction-right-side">
      <span class="new-transaction-new">New Transaction</span>
      <svg
        class="new-transaction-arrow"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 451.846 451.846"
        aria-hidden="true"
      >
        <path
          d="M345.441 248.292L151.154 442.573c-12.359 12.359-32.397 12.359-44.756 0-12.359-12.359-12.359-32.397 0-44.756L278.25 225.922 106.398 54.069c-12.359-12.359-12.359-32.397 0-44.756 12.359-12.359 32.397-12.359 44.756 0l194.287 194.284c6.177 6.18 9.271 14.271 9.271 22.363.001 8.09-3.108 16.182-9.285 22.36z"
          fill="currentColor"
        />
      </svg>
    </div>
  </button>
</template>

<script setup>
const emit = defineEmits(['click']);

const handleClick = (event) => {
  emit('click', event);
};
</script>

<style scoped>
/* From Uiverse.io by Admin12121 - Scoped & Adapted for TravelSync theme */
.new-transaction-container {
  display: inline-flex;
  align-items: center;
  position: relative;
  height: 48px;
  width: auto;
  min-width: 195px;
  max-width: 100%;
  background-color: #FFFFFF;
  border: 1px solid #E3E0D8;
  border-radius: 14px;
  cursor: pointer;
  overflow: hidden;
  padding: 0;
  text-align: left;
  user-select: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1),
              border-color 0.25s ease,
              box-shadow 0.25s ease;
}

:global(.dark) .new-transaction-container {
  background-color: #1B1C19;
  border-color: #30312C;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.new-transaction-container:hover,
.new-transaction-container:focus-visible {
  border-color: #A7A99A;
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(167, 169, 154, 0.15);
}

:global(.dark) .new-transaction-container:hover,
:global(.dark) .new-transaction-container:focus-visible {
  border-color: #A7A99A;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5), 0 0 12px rgba(167, 169, 154, 0.12);
}

.new-transaction-container:active {
  transform: scale(0.98);
}

.new-transaction-container:focus-visible {
  outline: 2px solid #A7A99A;
  outline-offset: 2px;
}

/* Left side container holding the payment terminal & card illustration */
.new-transaction-left-side {
  background-color: #4A6355;
  width: 58px;
  height: 100%;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
  overflow: hidden;
  transition: background-color 0.3s ease;
}

:global(.dark) .new-transaction-left-side {
  background-color: #31443A;
}

.new-transaction-container:hover .new-transaction-left-side,
.new-transaction-container:focus-visible .new-transaction-left-side {
  background-color: #557262;
}

:global(.dark) .new-transaction-container:hover .new-transaction-left-side,
:global(.dark) .new-transaction-container:focus-visible .new-transaction-left-side {
  background-color: #3B5347;
}

/* Credit Card */
.new-transaction-card {
  width: 36px;
  height: 24px;
  background-color: #C8D6C9;
  border-radius: 4px;
  position: absolute;
  display: flex;
  z-index: 10;
  flex-direction: column;
  align-items: center;
  box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.2);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
              width 0.3s ease,
              height 0.3s ease;
}

:global(.dark) .new-transaction-card {
  background-color: #A7A99A;
  box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.4);
}

.new-transaction-container:hover .new-transaction-card,
.new-transaction-container:focus-visible .new-transaction-card {
  transform: translateY(-4px) scale(1.05);
}

.new-transaction-card-line {
  width: 32px;
  height: 6px;
  background-color: #7A9684;
  border-radius: 1px;
  margin-top: 3px;
}

:global(.dark) .new-transaction-card-line {
  background-color: #4C5E53;
}

.new-transaction-buttons {
  width: 4px;
  height: 4px;
  background-color: #2D3D33;
  box-shadow: 0 -6px 0 0 #2D3D33, 0 6px 0 0 #2D3D33;
  border-radius: 50%;
  margin-top: 3px;
  transform: rotate(90deg);
}

/* Post / Payment Terminal */
.new-transaction-post {
  width: 38px;
  height: 28px;
  background-color: #E6E4DD;
  position: absolute;
  border-radius: 4px;
  bottom: 3px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.15);
  transform: translateY(38px);
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 5;
}

:global(.dark) .new-transaction-post {
  background-color: #242521;
  border: 1px solid #3A3B34;
  box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.4);
}

.new-transaction-container:hover .new-transaction-post,
.new-transaction-container:focus-visible .new-transaction-post {
  transform: translateY(0);
}

.new-transaction-post-line {
  width: 26px;
  height: 3px;
  background-color: #A7A99A;
  border-radius: 1px;
  margin-top: 3px;
}

.new-transaction-screen {
  width: 26px;
  height: 14px;
  background-color: #FFFFFF;
  border-radius: 2px;
  margin-top: 2px;
  display: flex;
  justify-content: center;
  align-items: center;
}

:global(.dark) .new-transaction-screen {
  background-color: #171814;
}

.new-transaction-dollar {
  font-size: 10px;
  font-weight: 800;
  color: #4A6355;
  line-height: 1;
}

:global(.dark) .new-transaction-dollar {
  color: #86A98B;
}

.new-transaction-numbers {
  width: 5px;
  height: 5px;
  background-color: #8FA698;
  border-radius: 1px;
  position: absolute;
  right: 4px;
  top: 3px;
}

.new-transaction-numbers-line2 {
  width: 5px;
  height: 5px;
  background-color: #C2CEC6;
  border-radius: 1px;
  position: absolute;
  right: 11px;
  top: 3px;
}

/* Right side content: Label & Arrow */
.new-transaction-right-side {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px 0 12px;
  gap: 10px;
  white-space: nowrap;
}

.new-transaction-new {
  font-size: 13px;
  font-weight: 700;
  color: #1C1D1A;
  letter-spacing: -0.01em;
  transition: color 0.2s ease;
}

:global(.dark) .new-transaction-new {
  color: #D5D3CA;
}

.new-transaction-container:hover .new-transaction-new,
.new-transaction-container:focus-visible .new-transaction-new {
  color: #171813;
}

:global(.dark) .new-transaction-container:hover .new-transaction-new,
:global(.dark) .new-transaction-container:focus-visible .new-transaction-new {
  color: #FFFFFF;
}

.new-transaction-arrow {
  width: 14px;
  height: 14px;
  color: #7E8075;
  flex-shrink: 0;
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1),
              color 0.2s ease;
}

:global(.dark) .new-transaction-arrow {
  color: #A5A69B;
}

.new-transaction-container:hover .new-transaction-arrow,
.new-transaction-container:focus-visible .new-transaction-arrow {
  color: #1C1D1A;
  transform: translateX(3px);
}

:global(.dark) .new-transaction-container:hover .new-transaction-arrow,
:global(.dark) .new-transaction-container:focus-visible .new-transaction-arrow {
  color: #D5D3CA;
}

/* Reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  .new-transaction-container,
  .new-transaction-card,
  .new-transaction-post,
  .new-transaction-arrow,
  .new-transaction-left-side {
    transition: none !important;
    transform: none !important;
  }
}
</style>
