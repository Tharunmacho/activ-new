import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      /*
       * One family, Inter, for the whole product.
       *
       * `font-sans` is the default for everything, so setting it here changes
       * every screen at once rather than leaving each one to remember.
       *
       * `display` and `serif` deliberately resolve to Inter as well. `display`
       * used to be Plus Jakarta Sans, which stops at 800 and silently clamped
       * every `font-black` heading on the site to 800. `serif` is mapped
       * because the public headings were written with `font-serif` — Tailwind's
       * stock serif stack, i.e. Georgia — so the About, Events, Gallery and
       * Contact headings were rendering in a completely different typeface from
       * the body text beneath them. Those classes are removed in the components,
       * and this mapping is the backstop so a stray one can never fall back to
       * Georgia again.
       *
       * The system stack stays behind all three as the fallback that renders
       * while the web font is still in flight.
       */
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        /**
         * The logo navy, as a scale. `bg-brand`, `text-brand-600`,
         * `border-brand-100` and so on. Defined once in index.css.
         *
         * Use it on the PUBLIC / onboarding pages only. Tailwind's stock
         * `blue-*` is deliberately left alone so the member and admin screens
         * keep their own palette.
         */
        brand: {
          DEFAULT: "hsl(var(--brand-800))",
          50: "hsl(var(--brand-50))",
          100: "hsl(var(--brand-100))",
          200: "hsl(var(--brand-200))",
          300: "hsl(var(--brand-300))",
          400: "hsl(var(--brand-400))",
          500: "hsl(var(--brand-500))",
          600: "hsl(var(--brand-600))",
          700: "hsl(var(--brand-700))",
          800: "hsl(var(--brand-800))",
          900: "hsl(var(--brand-900))",
          /* On-dark highlight only — see the note in index.css. */
          accent: "hsl(var(--brand-accent))",
        },

        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        /*
         * Ambient depth for the public pages. All four animate `transform` or
         * `opacity` only, so they run on the compositor and never touch layout
         * — a decorative loop that forces reflow on every frame is the fastest
         * way to make a marketing page feel slower than a static one.
         */
        "activ-float": {
          "0%, 100%": { transform: "translate3d(0, 0, 0)" },
          "50%": { transform: "translate3d(0, -14px, 0)" },
        },
        "activ-float-slow": {
          "0%, 100%": { transform: "translate3d(0, 0, 0) rotate(0deg)" },
          "50%": { transform: "translate3d(0, -22px, 0) rotate(2.5deg)" },
        },
        "activ-orbit": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "activ-orbit-reverse": {
          from: { transform: "rotate(360deg)" },
          to: { transform: "rotate(0deg)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "activ-float": "activ-float 6s ease-in-out infinite",
        "activ-float-slow": "activ-float-slow 9s ease-in-out infinite",
        "activ-orbit": "activ-orbit 38s linear infinite",
        "activ-orbit-reverse": "activ-orbit-reverse 52s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
