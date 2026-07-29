import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Les photos d'annonces et d'états des lieux sont volumineuses : formats
  // modernes obligatoires (M15 — optimisation des performances).
  images: {
    formats: ["image/avif", "image/webp"],
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
