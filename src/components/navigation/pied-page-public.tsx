import { useTranslations } from "next-intl";

import { Logo } from "@/components/navigation/logo";
import { Illustration } from "@/components/ui/illustration";
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
    <footer className="relative mt-auto overflow-hidden bg-encre text-encre-texte">
      {/* Une photographie derrière le pied de page, très voilée : elle donne
          une assise à la fin de la lecture sans disputer l'attention aux liens
          qu'elle porte. Le voile est dense à dessein — un pied de page reste
          un endroit où l'on cherche une information précise, jamais une
          image. */}
      <div className="absolute inset-0">
        <Illustration
          src="/images/hero.webp"
          alt=""
          className="h-full w-full"
          tailles="100vw"
        />
      </div>
      <div aria-hidden className="absolute inset-0 bg-marque-950/92" />

      {/* Bandeau d'appel : la question qu'on se pose en bas de page est
          rarement dans la liste des liens. */}
      <div className="relative border-b border-encre-bordure">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 sm:px-6">
          <div>
            <p className="text-[1.0625rem] font-semibold">
              {t("piedPage.aide.titre")}
            </p>
            <p className="mt-1 text-sm text-encre-texte-attenue">
              {t("piedPage.aide.texte")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/aide"
              className="inline-flex h-11 items-center rounded-champ border border-encre-bordure bg-white/10 px-4 text-sm font-medium backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              {t("piedPage.aide.centre")}
            </Link>
            <Link
              href="/contact"
              className="inline-flex h-11 items-center rounded-champ bg-accent px-4 text-sm font-medium text-accent-contraste transition-opacity hover:opacity-90"
            >
              {t("piedPage.aide.contact")}
            </Link>
          </div>
        </div>
      </div>

      <div className="relative mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-5">
        {/* Ce que fait la plateforme, en trois lignes : le pied de page est
            souvent la première chose lue par qui arrive d'un moteur sur une
            page profonde. */}
        <div className="md:col-span-1">
          {/* Sur fond profond : `clair` inverse l'encre du mot, qui s'y
              perdait entièrement. */}
          <Logo clair />
          <p className="mt-4 text-sm leading-relaxed text-encre-texte-attenue">
            {t("piedPage.presentation")}
          </p>
        </div>
        <nav aria-label={t("piedPage.louer")}>
          <h2 className="text-[0.6875rem] font-semibold tracking-[0.14em] uppercase">{t("piedPage.louer")}</h2>
          <ul className="mt-3 space-y-2 text-sm text-encre-texte-attenue">
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
          <h2 className="text-[0.6875rem] font-semibold tracking-[0.14em] uppercase">
            {t("piedPage.proprietaires")}
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-encre-texte-attenue">
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
          <h2 className="text-[0.6875rem] font-semibold tracking-[0.14em] uppercase">{t("piedPage.entreprise")}</h2>
          <ul className="mt-3 space-y-2 text-sm text-encre-texte-attenue">
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
          <h2 className="text-[0.6875rem] font-semibold tracking-[0.14em] uppercase">{t("piedPage.legal")}</h2>
          <ul className="mt-3 space-y-2 text-sm text-encre-texte-attenue">
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

      <div className="relative border-t border-encre-bordure">
        <p className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-encre-texte-attenue sm:px-6">
          {t("piedPage.droits", { annee })}
        </p>
      </div>
    </footer>
  );
}
