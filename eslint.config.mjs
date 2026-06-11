import js from "@eslint/js";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import config from "eslint-config-prettier";

export default defineConfig([
  {
    ignores: ["**/dist/**", "**/.next/**", "**/node_modules/**", "**/coverage/**", "**/*.js"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },

  // NestJS сервисы — строже, console.log запрещён (используй Logger)
  {
    files: ["apps/api-gateway/**/*.ts", "apps/auth-service/**/*.ts", "apps/product-service/**/*.ts", "apps/order-service/**/*.ts", "apps/payment-service/**/*.ts", "apps/notification-service/**/*.ts"],
    rules: {
      "no-console": "error",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },

  // Next.js frontend — чуть мягче
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    rules: {
      "no-console": "warn",
    },
  },
  config,
]);
