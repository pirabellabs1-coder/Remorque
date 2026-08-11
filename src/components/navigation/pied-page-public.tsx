import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

/**
 * Le pied de page porte les obligations d'information du droit de la
 * consommation (section 11) : conditions par pays, médiateur désigné,
 * transparence des frais. Ce n'est pas un bloc décoratif.
 */
export function PiedPagePublic() {
  const t = useTranslations();
  const annee = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-bordure bg-fond-eleve">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <nav aria-label={t("piedPage.louer")}>
          <h2 className="text-sm font-semibold">{t("piedPage.louer")}</h2>
          <ul className="mt-3 space-y-2 text-sm text-texte-attenue">
            <li>
              <Link href="/recherche">{t("navigation.louer")}</Link>
            </li>
            <li>
              <Link href="/comment-ca-marche/louer">
                {t("navigation.commentCaMarche")}
              </Link>
            </li>
            <li>
              <Link href="/quel-permis-pour-quelle-remorque">
                Quel permis pour quelle remorque
              </Link>
            </li>
            <li>
              <Link href="/calculateur-de-charge">Calculateur de charge</Link>
            </li>
          </ul>
        </nav>

        <nav aria-label={t("piedPage.proprietaires")}>
          <h2 className="text-sm font-semibold">
            {t("piedPage.proprietaires")}
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-texte-attenue">
            <li>
              <Link href="/mettre-en-location">
                {t("navigation.mettreEnLocation")}
              </Link>
            </li>
            <li>
              <Link href="/comment-ca-marche/mettre-en-location">
                {t("navigation.commentCaMarche")}
              </Link>
            </li>
            <li>
              <Link href="/tarifs">Frais de service</Link>
            </li>
            <li>
              <Link href="/pro">Loueurs professionnels</Link>
            </li>
          </ul>
        </nav>

        <nav aria-label={t("piedPage.entreprise")}>
          <h2 className="text-sm font-semibold">{t("piedPage.entreprise")}</h2>
          <ul className="mt-3 space-y-2 text-sm text-texte-attenue">
            <li>
              <Link href="/a-propos">{t("piedPage.aPropos")}</Link>
            </li>
            <li>
              <Link href="/assurance">{t("navigation.assurance")}</Link>
            </li>
            {/* Le lien vers le blog est retiré tant qu'aucun article n'existe.
                Un lien qui mène nulle part use la confiance, et le
                référencement le pénalise plus qu'une rubrique absente. */}
            <li>
              <Link href="/aide">{t("piedPage.aide")}</Link>
            </li>
            <li>
              <Link href="/contact">{t("piedPage.contact")}</Link>
            </li>
          </ul>
        </nav>

        <nav aria-label={t("piedPage.legal")}>
          <h2 className="text-sm font-semibold">{t("piedPage.legal")}</h2>
          <ul className="mt-3 space-y-2 text-sm text-texte-attenue">
            <li>
              <Link href="/cgu">{t("piedPage.cgu")}</Link>
            </li>
            <li>
              <Link href="/cgv">{t("piedPage.cgv")}</Link>
            </li>
            <li>
              <Link href="/confidentialite">{t("piedPage.confidentialite")}</Link>
            </li>
            <li>
              <Link href="/mediation">{t("piedPage.mediation")}</Link>
            </li>
            <li>
              <Link href="/cookies">{t("piedPage.cookies")}</Link>
            </li>
            {/* Le plan du site met chaque ville et chaque type à un clic de
                n'importe quelle page — ce que `sitemap.xml` ne fait que pour
                les moteurs. */}
            <li>
              <Link href="/plan-du-site">{t("piedPage.planDuSite")}</Link>
            </li>
            <li>
              <Link href="/mentions-legales">{t("piedPage.mentionsLegales")}</Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-bordure">
        <p className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-texte-attenue sm:px-6">
          {t("piedPage.droits", { annee })}
        </p>
      </div>
    </footer>
  );
}
