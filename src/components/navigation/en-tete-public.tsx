import { useTranslations } from "next-intl";

import { Bouton } from "@/components/ui/bouton";
import { Link } from "@/i18n/navigation";

export function EnTetePublic() {
  const t = useTranslations("navigation");
  const tCommun = useTranslations("commun");

  return (
    <header className="sticky top-0 z-40 border-b border-bordure bg-fond-eleve/90 backdrop-blur">
      <nav
        aria-label={t("louer")}
        className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-4 sm:px-6"
      >
        <Link href="/" className="font-semibold tracking-tight">
          {tCommun("nomPlateforme")}
        </Link>

        <ul className="hidden items-center gap-6 text-sm text-texte-attenue md:flex">
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
            variante="secondaire"
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
