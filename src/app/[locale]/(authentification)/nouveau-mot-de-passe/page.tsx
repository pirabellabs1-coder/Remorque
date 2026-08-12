import { getTranslations, setRequestLocale } from "next-intl/server";

import { CoquilleAuthentification } from "@/components/compte/coquille-authentification";
import { FormulaireNouveauMotDePasse } from "@/components/compte/formulaire-nouveau-mot-de-passe";
import { Bouton } from "@/components/ui/bouton";
import { Link } from "@/i18n/navigation";
import { examinerJeton } from "@/server/authentification/reinitialisation";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ jeton?: string }>;
};

export const metadata = { robots: { index: false, follow: false } };

/**
 * Choix d'un nouveau mot de passe, sur présentation d'un jeton.
 *
 * **Le jeton est examiné au rendu, pas seulement à l'envoi.** Montrer le
 * formulaire puis refuser après la saisie ferait taper une longue phrase pour
 * rien — et sur un téléphone, c'est le genre d'aller-retour qui fait
 * abandonner. L'examen ne consomme rien : il lit, il ne décide pas.
 *
 * Le contrôle est refait à l'envoi, dans la même transaction que l'écriture.
 * Ce n'est pas de la redondance : entre l'affichage et la validation, le lien
 * a pu expirer, ou servir dans un autre onglet.
 */
export default async function PageNouveauMotDePasse({
  params,
  searchParams,
}: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { jeton } = await searchParams;
  const t = await getTranslations("compte.nouveauMotDePasse");

  const verdict = jeton
    ? await examinerJeton(jeton)
    : ({ valide: false, cle: "inconnu" } as const);

  if (!verdict.valide) {
    return (
      <CoquilleAuthentification
        titre={t(`refus.${verdict.cle}.titre`)}
        sousTitre={t(`refus.${verdict.cle}.texte`)}
        illustration="/images/hero.webp"
        illustrationAlt={t("illustration")}
        bas={t.rich("basRetour", {
          lien: (contenu) => (
            <Link
              href="/connexion"
              className="font-medium text-accent underline underline-offset-4"
            >
              {contenu}
            </Link>
          ),
        })}
      >
        <Bouton as={Link} href="/mot-de-passe-oublie" className="w-full">
          {t("redemander")}
        </Bouton>
      </CoquilleAuthentification>
    );
  }

  return (
    <CoquilleAuthentification
      titre={t("titre")}
      sousTitre={t("sousTitre")}
      illustration="/images/hero.webp"
      illustrationAlt={t("illustration")}
      bas={t.rich("basRetour", {
        lien: (contenu) => (
          <Link
            href="/connexion"
            className="font-medium text-accent underline underline-offset-4"
          >
            {contenu}
          </Link>
        ),
      })}
    >
      <FormulaireNouveauMotDePasse jeton={jeton!} />
    </CoquilleAuthentification>
  );
}
