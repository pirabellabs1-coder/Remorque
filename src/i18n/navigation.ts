import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/**
 * À utiliser à la place de `next/link` et `next/navigation` dans toute
 * l'application : ces helpers résolvent automatiquement le préfixe du marché
 * et l'adresse localisée.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
