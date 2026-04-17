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
  // Project-wide guardrails that encode production lessons learned — see
  // Phase 1 of the test-hardening plan.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // Force every form through useAppForm, which injects toastFirstError as
      // the default onInvalid handler. A raw useForm call dropped submits
      // silently on /company and /equipment in prod.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react-hook-form",
              importNames: ["useForm"],
              message: "Use `useAppForm` from '@/hooks/use-app-form'. Raw useForm silently swallows failed submits when zod rejects — the app-wide wrapper surfaces a toast with the first error.",
            },
          ],
        },
      ],
    },
  },
  // Escape hatch: the wrapper itself must import the raw useForm.
  {
    files: ["src/hooks/use-app-form.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  // Tests can use react-hook-form directly without the wrapper.
  {
    files: ["tests/**/*.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
]);

export default eslintConfig;
