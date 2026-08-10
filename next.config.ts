import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Hôte du stockage objet, déduit de l'adresse S3.
 *
 * `next/image` refuse par défaut toute source distante : sans cette
 * autorisation, les photos déposées par les propriétaires reviendraient en
 * 400. On n'ouvre que l'hôte configuré, et rien d'autre — un `**` ici
 * laisserait optimiser n'importe quelle image du web sous notre nom.
 */
const hoteStockage = process.env.S3_ENDPOINT
  ? new URL(process.env.S3_ENDPOINT).hostname
  : null;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Les photos d'annonces et d'états des lieux sont volumineuses : formats
  // modernes obligatoires (M15 — optimisation des performances).
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: hoteStockage
      ? [{ protocol: "https", hostname: hoteStockage, pathname: "/storage/**" }]
      : [],
  },
  experimental: {
    serverActions: {
      // Les photos sont réduites sur l'appareil avant l'envoi (voir
      // `depot-photos.tsx`) : une photo pèse alors quelques centaines de
      // kilo-octets. La limite d'un méga-octet par défaut suffirait pour une
      // photo, pas pour la sélection de huit que fait un propriétaire pressé.
      bodySizeLimit: "12mb",
    },
  },
  // La plateforme manipule des pièces d'identité et des coordonnées bancaires :
  // le niveau d'exigence est celui d'un service financier (section 12).
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
