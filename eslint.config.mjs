import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Vendored chrome components render plain <img> on purpose — the library is
    // framework-agnostic and can't reach for next/image. Covers are remote and
    // already sized by their container, so the optimiser has nothing to add.
    files: ["components/chrome/**"],
    rules: { "@next/next/no-img-element": "off" },
  },
]);

export default eslintConfig;
