<template>
  <!-- From Uiverse.io by satyamchaudharydev --> 
  <label class="switch" title="Toggle theme">
    <input 
      type="checkbox" 
      :checked="isDarkMode" 
      @change="toggleDarkMode"
      aria-label="Toggle dark mode"
    >
    <span class="slider"></span>
  </label>
</template>

<script setup>
import { useDarkMode } from '../composables/useDarkMode';

const { isDarkMode, toggleDarkMode } = useDarkMode();
</script>

<style scoped>
/* From Uiverse.io by satyamchaudharydev */ 
/* The switch - the box around the slider */
.switch {
  display: block;
  font-size: 0.75rem;
  --width-of-switch: 3.5em;
  --height-of-switch: 2em;
  /* size of sliding icon -- sun and moon */
  --size-of-icon: 1.4em;
  /* it is like a inline-padding of switch */
  --slider-offset: 0.3em;
  position: relative;
  width: var(--width-of-switch);
  height: var(--height-of-switch);
  cursor: pointer;
}

/* Hide default HTML checkbox */
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

/* The slider */
.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #f4f4f5;
  transition: .4s;
  border-radius: 30px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.slider:before {
  position: absolute;
  content: "";
  height: var(--size-of-icon, 1.4em);
  width: var(--size-of-icon, 1.4em);
  border-radius: 20px;
  left: var(--slider-offset, 0.3em);
  top: 50%;
  transform: translateY(-50%);
  background: linear-gradient(40deg, #ff0080, #ff8c00 70%);
  transition: .4s;
}

input:checked + .slider {
  background-color: #303136;
  border-color: rgba(255, 255, 255, 0.12);
}

input:checked + .slider:before {
  left: calc(100% - (var(--size-of-icon, 1.4em) + var(--slider-offset, 0.3em)));
  background: #303136;
  /* change the value of second inset in box-shadow to change the angle and direction of the moon  */
  box-shadow: inset -3px -2px 5px -2px #8983f7, inset -10px -4px 0 0 #a3dafb;
}

/* Optional keyboard focus outline for accessibility */
.switch input:focus-visible + .slider {
  outline: 2px solid #7BAE9E;
  outline-offset: 2px;
}
</style>
