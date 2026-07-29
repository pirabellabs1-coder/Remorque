"use client";

import { useTranslations } from "next-intl";

import { Bouton } from "@/components/ui/bouton";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/**
 * En-tête de l'espace public.
 *
 * Sur l'accueil, l'en-tête se pose par-dessus la photographie de première vue
 * plutôt que de la surmonter d'un bandeau blanc bordé d'un filet gris : c'est
 * ce qui fait la différence entre un hero plein cadre et une image sous un
 * cartouche. Partout ailleurs, il reste opaque et bordé, car il surplombe du
 * texte à lire.
 */
export function EnTetePublic() {
  const t = useTranslations("navigation");
  const tCommun = useTranslations("commun");
  const chemin = usePathname();
  const surAccueil = chemin === "/";

  return (
    <header
      className={cn(
        "sticky top-0 z-40",
        surAccueil
          ? "bg-transparent text-encre-texte"
          : "border-b border-bordure bg-fond-eleve/95 backdrop-blur",
      )}
    >
      <nav
        aria-label={t("louer")}
        className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-4 sm:px-6"
      >
        <Link href="/" className="font-semibold tracking-tight">
          {tCommun("nomPlateforme")}
        </Link>

        <ul
          className={cn(
            "hidden items-center gap-6 text-sm md:flex",
            surAccueil ? "text-encre-texte/80" : "text-texte-attenue",
          )}
        >
          <li>
            <Link href="/recherche">{t("louer")}</Link>
          </li>
          <li>
            <Link href="/comment-ca-marche">{t("commentCaMarche")}</Link>
          </li>
          <li>
            <Link href="/assurance">{t("assurance")}</Link>
          </li>
          <li>
            <Link href="/aide">{t("aide")}</Link>
          </li>
        </ul>

        <div className="ml-auto flex items-center gap-2">
          <Bouton
            as={Link}
            href="/mettre-en-location"
            variante={surAccueil ? "fantome" : "secondaire"}
            taille="petit"
            className="hidden sm:inline-flex"
          >
            {t("mettreEnLocation")}
          </Bouton>
          <Bouton as={Link} href="/connexion" taille="petit">
            {t("connexion")}
          </Bouton>
        </div>
      </nav>
    </header>
  );
}
