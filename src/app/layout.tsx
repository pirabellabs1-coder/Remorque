import type { ReactNode } from "react";

/**
 * Racine minimale : les balises `<html>` et `<body>` sont rendues par
 * `src/app/[locale]/layout.tsx`, qui seul connaît la langue du marché.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
