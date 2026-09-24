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
       * One family, POPPINS, for the whole product.
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
        /*
         * THE BODY FACE: Poppins, with Inter directly behind it.
         *
         * Inter was the body face for most of this project's life and is a
         * better one on the merits — it was drawn for screen UI and holds up at
         * 15px in a card caption, where Poppins is a display face being asked
         * to do text work. The association looked at both and chose Poppins for
         * the whole product, headings and body together, which is a legitimate
         * call: one warm, round voice everywhere beats a correct pairing nobody
         * asked for.
         *
         * Inter stays SECOND in the stack, not deleted. It is what renders in
         * the ~100ms before Poppins arrives (`display=swap`), and it is far
         * closer in colour and width to Poppins than the system UI font is, so
         * the reflow when the real face lands is barely visible.
         *
         * If body copy ever reads tiring on a long screen — the settings pages,
         * the legal notices — putting Inter back is THIS LINE and nothing else.
         * Do not do it one screen at a time.
         */
        sans: ['Poppins', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        /*
         * THE HEADING FACE: Poppins — the SAME family as the body.
         *
         * `display` is kept as its own key rather than deleted, and it matters
         * that it still exists even while it names the same family as `sans`.
         * Dozens of places across the product ask for `font-display` on a `<p>`
         * or `<span>` that should read as a heading — a sub-head inside a card,
         * a statistic — because the `h1..h4` rule in `index.css` keys off the
         * TAG. Removing this key turns every one of those into a class that
         * resolves to nothing, silently, on screens nobody is looking at.
         *
         * It also keeps the swap cheap. The face has moved four times now
         * (Inter, Plus Jakarta Sans, Outfit, Manrope, Poppins) and every one of
         * those moves was two lines in this file, because no screen names a
         * family of its own.
         *
         * Poppins carries a real 900, so `font-black` is an actual cut here.
         * Plus Jakarta Sans and Manrope both stop at 800 and were clamping it.
         *
         * WHAT IS LOST by using one family for both: contrast. A heading and
         * the line beneath it are now distinguished by SIZE and WEIGHT alone,
         * where two families would also have distinguished them by shape. That
         * is why the size scale in `appTypography.ts` is stepped as widely as
         * it is — 24px `font-black` over 17px `font-medium` — and why narrowing
         * those steps would leave a card title reading as bigger body text.
         */
        display: ['Poppins', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        /*
         * NO SERIF IN THIS PRODUCT — `font-serif` resolves to the same sans as
         * everything else, deliberately.
         *
         * Kept rather than deleted: removing the key hands `font-serif` and any
         * `prose` block back to Tailwind's default Georgia stack, which would
         * put a serif on pages nobody asked to change. Nothing should REACH for
         * this class — the certificate did, and was the one page left on the
         * old face when the display font changed. Use `font-display`.
         */
        serif: ['Poppins', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        /*
         * NO MONOSPACE EITHER — `font-mono` is Poppins, for the same reason
         * `serif` is. It was left at Tailwind's default, so booking refs,
         * pasted media URLs, env-var names and chart values rendered in the
         * system's Consolas/Courier on screens that are otherwise all Poppins.
         * Preflight also reads this key for `<code>`, `<pre>`, `<kbd>` and
         * `<samp>`, so those follow. Where digits need to line up, use
         * `tabular-nums` — Poppins has tabular figures.
         */
        mono: ['Poppins', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        /*
         * THE CERTIFICATE NAME, AND NOTHING ELSE ON THE PRODUCT.
         *
         * `font-certificate` exists so that the one place a second family is
         * wanted can have it without `font-serif` becoming a live serif again
         * — which is what this config spent three faces stamping out. The
         * membership certificate's holder name is the only call site; a grep
         * for `font-certificate` is the whole audit.
         *
         * Poppins sits behind it, not Georgia, so a failed font load degrades
         * to the product's own face rather than to a system serif.
         */
        certificate: ['Playfair Display', 'Poppins', 'Georgia', 'serif'],
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
        /*
         * The regional gallery strip.
         *
         * -50% and not -100%, because the track holds the photographs TWICE:
         * at the halfway point the second copy sits exactly where the first
         * began, so the jump back to 0 is invisible. Translating the whole way
         * would scroll the duplicate off and leave a gap.
         */
        "region-marquee": {
          from: { transform: "translate3d(0, 0, 0)" },
          to: { transform: "translate3d(-50%, 0, 0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "activ-float": "activ-float 6s ease-in-out infinite",
        "activ-float-slow": "activ-float-slow 9s ease-in-out infinite",
        "activ-orbit": "activ-orbit 38s linear infinite",
        "activ-orbit-reverse": "activ-orbit-reverse 52s linear infinite",
        "region-marquee": "region-marquee 40s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
