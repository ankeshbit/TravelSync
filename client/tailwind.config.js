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
              "on-secondary": "#ffffff",
              "inverse-on-surface": "#ebf1ff",
              "tertiary-container": "#743b00",
              "surface-variant": "#dce2f3",
              "surface-container-high": "#e2e8f8",
              "on-surface-variant": "#42474f",
              "secondary": "#006a60",
              "on-secondary-container": "#007166",
              "on-tertiary-container": "#f9a767",
              "primary-fixed-dim": "#a0c9ff",
              "primary": "#00355f",
              "secondary-fixed-dim": "#6fd8c8",
              "surface": "#f9f9ff",
              "primary-fixed": "#d2e4ff",
              "tertiary-fixed-dim": "#ffb780",
              "surface-container-highest": "#dce2f3",
              "secondary-container": "#8cf5e4",
              "surface-bright": "#f9f9ff",
              "error": "#ba1a1a",
              "on-background": "#151c27",
              "secondary-fixed": "#8cf5e4",
              "on-tertiary-fixed": "#2f1400",
              "on-primary": "#ffffff",
              "surface-tint": "#2d6197",
              "inverse-primary": "#a0c9ff",
              "primary-container": "#0f4c81",
              "on-primary-fixed-variant": "#07497d",
              "on-secondary-fixed-variant": "#005048",
              "on-primary-fixed": "#001c37",
              "surface-container-low": "#f0f3ff",
              "inverse-surface": "#2a313d",
              "on-secondary-fixed": "#00201c",
              "outline": "#727780",
              "surface-container-lowest": "#ffffff",
              "tertiary": "#532800",
              "outline-variant": "#c2c7d1",
              "on-error-container": "#93000a",
              "surface-container": "#e7eefe",
              "on-surface": "#151c27",
              "on-error": "#ffffff",
              "surface-dim": "#d3daea",
              "background": "#f9f9ff",
              "on-primary-container": "#8ebdf9",
              "error-container": "#ffdad6",
              "tertiary-fixed": "#ffdcc4",
              "on-tertiary-fixed-variant": "#6f3800",
              "on-tertiary": "#ffffff"
      },
      "borderRadius": {
              "DEFAULT": "0.25rem",
              "lg": "0.5rem",
              "xl": "0.75rem",
              "full": "9999px"
      },
      "spacing": {
              "sm": "8px",
              "xl": "40px",
              "xs": "4px",
              "base": "4px",
              "margin": "32px",
              "gutter": "24px",
              "md": "16px",
              "lg": "24px"
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
