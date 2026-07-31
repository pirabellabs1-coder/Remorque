import type { MetadataRoute } from "next";

import { clientEnv } from "@/config/env-client";

export default function robots(): MetadataRoute.Robots {
  const base = clientEnv.NEXT_PUBLIC_SITE_URL;

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Espaces authentifiés et routes techniques : sans intérêt pour
      // l'indexation, et susceptibles d'exposer des paramètres de session.
      disallow: ["/api/", "/compte/", "/proprietaire/", "/admin/"],
    },
    sitemap: new URL("/sitemap.xml", base).toString(),
  };
}
