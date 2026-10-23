// eslint-config-next 16 já exporta flat configs — não precisa mais do FlatCompat.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "_to_delete/**",
      "scripts-pdf-visual.mts",
    ],
  },
];

export default eslintConfig;
