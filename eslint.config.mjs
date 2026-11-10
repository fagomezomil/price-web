import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
// La regla está UNPUBLISHED en npm (alpha, sanity-io): dist compilado del GitHub y commit
// de https://github.com/sanity-io/eslint-no-unconsumed-fetch (lección de leaks undici, caso QN).
import noUnconsumedFetch from "./tools/eslint-rules/no-unconsumed-fetch/index.js";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Elemento del array (no spread). No usamos configs.recommended del plugin porque
  // mete "meta" en el objeto de config y flat config lo rechaza.
  {
    plugins: { "no-unconsumed-fetch": noUnconsumedFetch },
    rules: { "no-unconsumed-fetch/no-unconsumed-fetch": "error" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "tools/**",
  ]),
]);

export default eslintConfig;
