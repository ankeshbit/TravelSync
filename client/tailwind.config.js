/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      "colors": {
        graphite: {
          950: '#111210', // App background
          900: '#141512', // Sidebar background
          850: '#1B1C19', // Card surface
          800: '#22231F', // Elevated surface
          750: '#292A25', // Hover surface
          700: '#30312C', // Border
          600: '#414239', // Strong border
          500: '#85867C', // Muted text
          400: '#A5A69B', // Secondary text
          300: '#D5D3CA', // Primary text
        },
        sage: {
          DEFAULT: '#A7A99A', // Primary accent
          hover: '#B9BBAA',   // Accent hover
          fg: '#171813',      // Text on sage buttons
          muted: 'rgba(167, 169, 154, 0.15)',
        },
        status: {
          success: '#86A98B',
          warning: '#C4A36B',
          error: '#C77F78',
          info: '#98A6A0',
        },
        // Semantic aliases
        "app-bg": "var(--color-bg)",
        "sidebar-bg": "var(--color-sidebar)",
        "card-bg": "var(--color-card)",
        "elevated-bg": "var(--color-elevated)",
        "hover-bg": "var(--color-hover)",
        "border-subtle": "var(--color-border)",
        "border-strong": "var(--color-border-strong)",
        "ink-primary": "var(--color-text-primary)",
        "ink-secondary": "var(--color-text-secondary)",
        "ink-muted": "var(--color-text-muted)",
        "accent-main": "var(--color-accent)",
        "accent-hover": "var(--color-accent-hover)",
        "accent-fg": "var(--color-accent-fg)",
      },
      "borderRadius": {
              "DEFAULT": "0.25rem",
              "lg": "0.5rem",
              "xl": "0.75rem",
              "full": "9999px"
      },

      "fontFamily": {
              "h1": ["Plus Jakarta Sans"],
              "label-sm": ["Plus Jakarta Sans"],
              "h2": ["Plus Jakarta Sans"],
              "body-lg": ["Plus Jakarta Sans"],
              "h3": ["Plus Jakarta Sans"],
              "body-md": ["Plus Jakarta Sans"]
      },
      "fontSize": {
              "h1": ["36px", {"lineHeight": "1.2", "letterSpacing": "-0.02em", "fontWeight": "700"}],
              "label-sm": ["12px", {"lineHeight": "1", "letterSpacing": "0.02em", "fontWeight": "600"}],
              "h2": ["24px", {"lineHeight": "1.3", "letterSpacing": "-0.01em", "fontWeight": "600"}],
              "body-lg": ["16px", {"lineHeight": "1.6", "letterSpacing": "0", "fontWeight": "400"}],
              "h3": ["18px", {"lineHeight": "1.4", "letterSpacing": "0", "fontWeight": "600"}],
              "body-md": ["14px", {"lineHeight": "1.5", "letterSpacing": "0", "fontWeight": "400"}]
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
