import { ref, watch, onMounted } from 'vue';

const isDarkMode = ref(false);

export function useDarkMode() {
  // Initialize dark mode from localStorage or system preference
  onMounted(() => {
    const savedMode = localStorage.getItem('darkMode');
    
    if (savedMode !== null) {
      // Use saved preference
      isDarkMode.value = savedMode === 'true';
    } else {
      // Use system preference
      isDarkMode.value = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    applyDarkMode(isDarkMode.value);
  });

  // Apply dark mode to document
  const applyDarkMode = (enabled) => {
    const htmlElement = document.documentElement;
    if (enabled) {
      htmlElement.classList.add('dark');
    } else {
      htmlElement.classList.remove('dark');
    }
  };

  // Watch for changes and apply immediately
  watch(isDarkMode, (newValue) => {
    localStorage.setItem('darkMode', newValue);
    applyDarkMode(newValue);
  });

  const toggleDarkMode = () => {
    isDarkMode.value = !isDarkMode.value;
  };

  return {
    isDarkMode,
    toggleDarkMode
  };
}
