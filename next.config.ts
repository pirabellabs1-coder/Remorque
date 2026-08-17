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

/**
 * Hôtes autorisés pour `next/image`.
 *
 * Vercel Blob sert chaque magasin sous un sous-domaine qui lui est propre —
 * `<identifiant>.public.blob.vercel-storage.com`. On ne peut donc pas le
 * nommer sans le connaître, et le connaître demanderait une variable de plus à
 * tenir en cohérence avec le magasin réellement rattaché.
 *
 * Le caractère générique porte donc sur le sous-domaine, jamais sur le
 * domaine : `*.public.blob.vercel-storage.com` n'ouvre que les magasins Blob,
 * là où un `**` laisserait optimiser n'importe quelle image du web sous notre
 * nom — et facturer l'optimisation à ce compte.
 */
const sourcesImages = [
  ...(hoteStockage
    ? ([
        {
          protocol: "https" as const,
          hostname: hoteStockage,
          pathname: "/storage/**",
        },
      ])
    : []),
  {
    protocol: "https" as const,
    hostname: "*.public.blob.vercel-storage.com",
    pathname: "/**",
  },
];

/**
 * Politique de sécurité du contenu.
 *
 * **Sans nonce, et c'est un choix contraint.** La méthode recommandée par Next
 * — un nonce tiré à chaque requête, posé par le proxy — impose le rendu
 * dynamique de toute page qui en bénéficie : le nonce est appliqué pendant le
 * rendu serveur, et une page pré-générée à la compilation n'a ni requête ni
 * en-tête où le lire. Or tout l'espace public est pré-rendu, et c'est la
 * condition du référencement local qui portera l'essentiel du trafic
 * (règle 8). Échanger cela contre un `script-src` strict serait payer très
 * cher une protection dont l'application n'a pas le besoin le plus criant :
 * elle n'affiche aucun HTML fourni par un tiers.
 *
 * **Ce que cette politique arrête réellement**, et c'est loin d'être rien :
 *
 *  - `connect-src` borne les destinations d'appel. Un script injecté ne peut
 *    pas exfiltrer vers un serveur qu'il aurait choisi — c'est la dernière
 *    étape de presque toute attaque, et celle qu'on peut couper.
 *  - `script-src 'self'` interdit de charger un script depuis un domaine
 *    étranger, donc la charge utile d'une injection par balise.
 *  - `frame-ancestors 'none'` interdit l'encadrement, donc le détournement de
 *    clic — le doublon de `X-Frame-Options`, qui est le seul respecté par les
 *    navigateurs anciens.
 *  - `form-action 'self'` empêche qu'un formulaire poste ailleurs que chez
 *    nous : sans lui, une injection réécrit l'action du formulaire de
 *    connexion et récolte les mots de passe.
 *  - `base-uri 'self'` interdit la réécriture de l'adresse de base, qui
 *    détournerait tous les chemins relatifs de la page d'un coup.
 *  - `object-src 'none'` ferme les greffons, vecteur ancien et sans usage ici.
 *
 * **Ce qu'elle n'arrête pas** : un script en ligne injecté dans notre propre
 * HTML, faute de nonce. C'est la limite assumée, et elle se comblera le jour
 * où l'espace public pourra être rendu dynamiquement sans perdre son
 * référencement.
 *
 * `'unsafe-inline'` sur les styles n'est pas négociable : les composants
 * portent des styles calculés — la largeur d'une jauge, la position d'un
 * repère sur une carte — qui ne peuvent pas vivre dans une feuille statique.
 */
const POLITIQUE_CONTENU = [
  "default-src 'self'",
  // `unsafe-inline` est ignoré par les navigateurs qui comprennent
  // `strict-dynamic` ; ici il n'y a pas de nonce, il reste donc nécessaire au
  // script d'amorçage que Next insère dans chaque page.
  // `unsafe-eval` en développement uniquement : React s'en sert pour
  // reconstruire les piles d'appels serveur dans le navigateur, et le dit
  // lui-même — « React will never use eval() in production mode ». L'ouvrir en
  // production annulerait une bonne part de ce que la politique protège.
  `script-src 'self' 'unsafe-inline'${
    process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""
  } https://js.stripe.com`,
  "style-src 'self' 'unsafe-inline'",
  // `blob:` pour les aperçus d'images avant envoi, `data:` pour les icônes en
  // ligne, et les deux hébergeurs de fichiers réellement employés.
  "img-src 'self' blob: data: https://*.public.blob.vercel-storage.com https://api.maptiler.com",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  // Les tuiles cartographiques et, le jour venu, le paiement. Rien d'autre :
  // c'est cette ligne qui empêche l'exfiltration.
  // En développement, le rechargement à chaud passe par une connexion
  // WebSocket vers notre propre hôte : sans elle, chaque modification exige un
  // rechargement manuel. Elle n'a rien à faire en production.
  `connect-src 'self' https://api.maptiler.com https://api.stripe.com${
    process.env.NODE_ENV === "development" ? " ws: wss:" : ""
  }`,
  // MapLibre décode les tuiles dans un fil d'exécution séparé, servi depuis
  // notre domaine, et en crée d'autres par `blob:`.
  "worker-src 'self' blob:",
  // Le cadre de paiement de Stripe, seul encadrement autorisé.
  "frame-src https://js.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Les photos d'annonces et d'états des lieux sont volumineuses : formats
  // modernes obligatoires (M15 — optimisation des performances).
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: sourcesImages,
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
          { key: "Content-Security-Policy", value: POLITIQUE_CONTENU },
          {
            /**
             * Fonctions du navigateur qu'aucune page n'a à demander.
             *
             * La géolocalisation reste ouverte — c'est elle qui propose « près
             * de chez moi » — et l'appareil photo aussi, l'état des lieux se
             * fait au téléphone. Le reste est fermé : une page qui n'utilise
             * pas le micro n'a aucune raison de pouvoir le demander, et une
             * extension malveillante ne peut pas le demander à sa place.
             */
            key: "Permissions-Policy",
            value: [
              "accelerometer=()",
              "autoplay=()",
              "camera=(self)",
              "display-capture=()",
              "geolocation=(self)",
              "gyroscope=()",
              "magnetometer=()",
              "microphone=()",
              "payment=(self)",
              "usb=()",
            ].join(", "),
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
