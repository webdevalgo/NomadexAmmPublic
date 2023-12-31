const theme = {
  default: {
    "--rounded-box": "0.25rem",
    "--rounded-btn": "0.125rem",
    "--rounded-badge": "0.125rem",
    "--tab-radius": "0.125rem",
    "--animation-btn": "0",
    "--animation-input": "0",
    "--btn-focus-scale": "1",
  },
  light: {
    "color-scheme": "light",
    "base-100": "#fafafa",
    "primary": "#101010",
    "primary-content": "#fafafa",
  },
  dark: {
    "color-scheme": "dark",
    "base-100": "#222222",
    "primary": "#fafafa",
    "primary-content": "#101010",
  }
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: false,
  daisyui: {
    themes: [
      {
        "light": {
          ...theme.default,
          ...theme.light
        },
      },
      {
        "dark": {
          ...theme.default,
          ...theme.dark
        }
      }
    ],
    // darkTheme: "dark", // name of one of the included themes for dark mode
    base: true, // applies background color and foreground color for root element by default
    styled: true, // include daisyUI colors and design decisions for all components
    utils: true, // adds responsive and modifier utility classes
    prefix: "", // prefix for daisyUI classnames (components, modifiers and responsive class names. Not colors)
    logs: true, // Shows info about daisyUI version and used config in the console when building your CSS
    themeRoot: ":root", // The element that receives theme color CSS variables
  },
  theme: {
    extend: {
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
    require("daisyui")
  ],
}

