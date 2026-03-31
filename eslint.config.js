import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["build", "dist", ".react-router"] },
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
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
  {
    files: [
      "src/components/ui/**/*.{ts,tsx}",
      "src/root.tsx",
      "src/route-modules/**/*.{ts,tsx}",
      "src/hooks/useAuth.tsx",
      "src/components/admin/AdminCommandPalette.tsx",
      "src/components/market/RecurrenceLabel.tsx",
      "src/components/market/cards/CardGridLayout.tsx",
    ],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
);
