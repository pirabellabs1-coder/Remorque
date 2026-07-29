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
              <Link href="/a-propos">À propos</Link>
            </li>
            <li>
              <Link href="/assurance">{t("navigation.assurance")}</Link>
            </li>
            <li>
              <Link href="/blog">Blog</Link>
            </li>
            <li>
              <Link href="/contact">Contact</Link>
            </li>
          </ul>
        </nav>

        <nav aria-label={t("piedPage.legal")}>
          <h2 className="text-sm font-semibold">{t("piedPage.legal")}</h2>
          <ul className="mt-3 space-y-2 text-sm text-texte-attenue">
            <li>
              <Link href="/cgu">Conditions générales d&apos;utilisation</Link>
            </li>
            <li>
              <Link href="/cgv">Conditions générales de vente</Link>
            </li>
            <li>
              <Link href="/confidentialite">Politique de confidentialité</Link>
            </li>
            <li>
              <Link href="/mediation">Médiation de la consommation</Link>
            </li>
            <li>
              <Link href="/mentions-legales">Mentions légales</Link>
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
