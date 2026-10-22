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

        // Stitch Design System Tokens
        "surface": "#101413",
        "surface-dim": "#101413",
        "surface-bright": "#363a39",
        "surface-container-lowest": "#0d1110",
        "surface-container-low": "#151918",
        "surface-container": "#1c2220",
        "surface-container-high": "#252b29",
        "surface-container-highest": "#2e3633",
        "surface-variant": "#242a28",
        "on-surface": "#f5f5f0",
        "on-surface-variant": "#bac3bd",
        "on-background": "#f5f5f0",
        "primary": "#8fa89b",
        "primary-container": "#8fa89b",
        "on-primary": "#0f1413",
        "on-primary-container": "#0f1413",
        "primary-fixed": "#cee9da",
        "primary-fixed-dim": "#b3ccbf",
        "on-primary-fixed": "#092017",
        "on-primary-fixed-variant": "#354c41",
        "secondary": "#8fa89b",
        "secondary-container": "#26332d",
        "on-secondary": "#1f352c",
        "on-secondary-container": "#a5beb2",
        "secondary-fixed": "#cfe8dc",
        "secondary-fixed-dim": "#b3ccc0",
        "on-secondary-fixed": "#091f18",
        "on-secondary-fixed-variant": "#354b42",
        "tertiary": "#a7bdb1",
        "tertiary-container": "#25342d",
        "on-tertiary": "#1d352b",
        "on-tertiary-container": "#cde9d9",
        "outline": "#48524d",
        "outline-variant": "#28302d",
        "inverse-surface": "#e0e3e1",
        "inverse-on-surface": "#2d3130",
        "inverse-primary": "#4c6358",
        "surface-tint": "#8fa89b"
      },
      "spacing": {
        "space-xs": "0.25rem",
        "space-sm": "0.5rem",
        "space-md": "1rem",
        "space-lg": "1.5rem",
        "space-xl": "2.5rem",
        "space-2xl": "4rem",
        "gutter": "1.5rem",
        "gutter-mobile": "1rem",
        "margin": "3rem",
        "margin-mobile": "1.25rem"
      },
      "borderRadius": {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      },
      "fontFamily": {
        "manrope": ["Manrope", "sans-serif"],
        "inter": ["Inter", "sans-serif"],
        "display-hero": ["Manrope", "sans-serif"],
        "display-hero-mobile": ["Manrope", "sans-serif"],
        "headline-lg": ["Manrope", "sans-serif"],
        "headline-md": ["Manrope", "sans-serif"],
        "headline-sm": ["Manrope", "sans-serif"],
        "title-md": ["Manrope", "sans-serif"],
        "label-caps": ["Manrope", "sans-serif"],
        "label-lg": ["Manrope", "sans-serif"],
        "label-md": ["Manrope", "sans-serif"],
        "label-sm": ["Plus Jakarta Sans"],
        "body-lg": ["Inter", "sans-serif"],
        "body-md": ["Inter", "sans-serif"],
        "body-sm": ["Inter", "sans-serif"],
        "h1": ["Plus Jakarta Sans"],
        "h2": ["Plus Jakarta Sans"],
        "h3": ["Plus Jakarta Sans"]
      },
      "fontSize": {
        "display-hero": ["56px", { "lineHeight": "64px", "letterSpacing": "-0.03em", "fontWeight": "800" }],
        "display-hero-mobile": ["36px", { "lineHeight": "44px", "letterSpacing": "-0.025em", "fontWeight": "800" }],
        "headline-lg": ["40px", { "lineHeight": "48px", "letterSpacing": "-0.025em", "fontWeight": "700" }],
        "headline-md": ["28px", { "lineHeight": "36px", "letterSpacing": "-0.02em", "fontWeight": "700" }],
        "headline-sm": ["22px", { "lineHeight": "30px", "letterSpacing": "-0.015em", "fontWeight": "600" }],
        "title-md": ["18px", { "lineHeight": "26px", "letterSpacing": "-0.01em", "fontWeight": "600" }],
        "body-lg": ["18px", { "lineHeight": "28px", "letterSpacing": "-0.005em", "fontWeight": "400" }],
        "body-md": ["15px", { "lineHeight": "24px", "letterSpacing": "0em", "fontWeight": "400" }],
        "body-sm": ["13px", { "lineHeight": "20px", "letterSpacing": "0em", "fontWeight": "400" }],
        "label-caps": ["11px", { "lineHeight": "16px", "letterSpacing": "0.08em", "fontWeight": "700" }],
        "label-lg": ["14px", { "lineHeight": "20px", "letterSpacing": "0.01em", "fontWeight": "600" }],
        "label-md": ["12px", { "lineHeight": "16px", "letterSpacing": "0.02em", "fontWeight": "600" }],
        "h1": ["36px", { "lineHeight": "1.2", "letterSpacing": "-0.02em", "fontWeight": "700" }],
        "h2": ["24px", { "lineHeight": "1.3", "letterSpacing": "-0.01em", "fontWeight": "600" }],
        "h3": ["18px", { "lineHeight": "1.4", "letterSpacing": "0", "fontWeight": "600" }]
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
