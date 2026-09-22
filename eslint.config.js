import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      /*
       * AN ERROR, NOT A WARNING.
       *
       * A value read inside a `useMemo` or `useEffect` but missing from its
       * dependency list runs once and never again. On /events that was the
       * online / in-person dropdown: the filter body read it, the list did
       * not, so the control moved and the grid did not. It typechecked, it
       * built, it rendered, and a page sweep saw nothing wrong — only
       * clicking the control finds it.
       *
       * The rule had been reporting exactly this, as a warning, in a run of
       * twenty-odd other warnings. A warning nobody reads is not a check.
       */
      "react-hooks/exhaustive-deps": "error",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
