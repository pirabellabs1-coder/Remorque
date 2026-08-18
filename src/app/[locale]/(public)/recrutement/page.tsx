import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { Bouton } from "@/components/ui/bouton";
import { DonneesStructurees } from "@/components/ui/carte";
import {
  AppelAction,
  ListePoints,
  PageEditoriale,
  SectionEditoriale,
} from "@/components/ui/mise-en-page";
import { clientEnv } from "@/config/env-client";
import type { Market } from "@/config/markets";
import { POSTES } from "@/config/postes";
import { Link } from "@/i18n/navigation";
import { metadonneesPage } from "@/lib/metadonnees";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pageRecrutement" });

  return metadonneesPage({
    locale: locale as Market,
    href: "/recrutement",
    titre: t("metaTitre"),
    description: t("metaDescription"),
  });
}

/**
 * Recrutement.
 *
 * **Aucun poste inventé.** La liste vient de `config/postes.ts`, vide tant que
 * rien n'est réellement ouvert. Une offre d'emploi fictive n'est pas un texte
 * de remplissage comme un autre : quelqu'un y répond, prépare une candidature,
 * attend une réponse. Le coût retombe sur une personne qui cherche du travail.
 *
 * La page dit donc franchement qu'il n'y a rien, et ouvre la candidature
 * spontanée — ce qui est la seule chose vraie qu'on puisse proposer. Dès
 * qu'une entrée est ajoutée à la configuration, elle s'affiche ici avec son
 * balisage `JobPosting`, sans qu'une ligne change.
 *
 * Ce que la page dit de la maison n'est pas une profession de foi : ce sont
 * les règles que le code applique et que les tests vérifient — montants en
 * centimes, taux jamais écrits en dur, interface entièrement traduite, mobile
 * d'abord. Elles se lisent dans le dépôt.
 */
export default async function PageRecrutement({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("pageRecrutement");
  const format = await getFormatter();

  return (
    <PageEditoriale
      surtitre={t("surtitre")}
      titre={t("titre")}
      chapo={t("chapo")}
    >
      {POSTES.length === 0 ? (
        <SectionEditoriale titre={t("aucun.titre")} chapo={t("aucun.texte")}>
          <p className="text-[0.9375rem]">
            {t.rich("aucun.spontanee", {
              lien: (contenu) => (
                <Link
                  href="/contact"
                  className="font-medium text-accent underline underline-offset-4"
                >
                  {contenu}
                </Link>
              ),
            })}
          </p>
        </SectionEditoriale>
      ) : (
        <SectionEditoriale titre={t("ouverts")}>
          {/* Le balisage n'est émis que sur des postes réels : déclarer une
              offre inexistante aux moteurs d'emploi serait une fausse
              annonce, pas une optimisation. */}
          <DonneesStructurees
            donnees={POSTES.map((poste) => ({
              "@context": "https://schema.org",
              "@type": "JobPosting",
              title: poste.intitule,
              description: poste.mission,
              employmentType: poste.contrat,
              datePosted: poste.publieLe,
              hiringOrganization: {
                "@type": "Organization",
                name: "FlexiTrailer",
                sameAs: clientEnv.NEXT_PUBLIC_SITE_URL,
              },
              jobLocation: {
                "@type": "Place",
                address: { "@type": "PostalAddress", addressLocality: poste.lieu },
              },
            }))}
          />

          <ul className="space-y-5">
            {POSTES.map((poste) => (
              <li
                key={poste.cle}
                id={poste.cle}
                className="rounded-carte border border-bordure-carte bg-fond-eleve p-6 shadow-(--ombre-carte)"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="text-[1.0625rem] font-semibold">
                    {poste.intitule}
                  </h3>
                  <p className="text-sm text-texte-attenue">
                    {poste.contrat} · {poste.lieu}
                  </p>
                </div>

                <p className="mt-3 text-[0.9375rem] leading-relaxed">
                  {poste.mission}
                </p>

                <p className="mt-4 text-sm text-texte-attenue">
                  {t("publieLe", {
                    date: format.dateTime(new Date(poste.publieLe), {
                      dateStyle: "long",
                    }),
                  })}
                </p>

                <p className="mt-4">
                  <Link
                    href="/contact"
                    className="font-medium text-accent underline underline-offset-4"
                  >
                    {t("postuler")}
                  </Link>
                </p>
              </li>
            ))}
          </ul>
        </SectionEditoriale>
      )}

      <SectionEditoriale titre={t("metier.titre")} chapo={t("metier.chapo")}>
        <ListePoints
          points={[1, 2, 3, 4].map((rang) => ({
            titre: t(`metier.p${rang}.titre` as never),
            texte: t(`metier.p${rang}.texte` as never),
          }))}
        />
      </SectionEditoriale>

      {/* Ce que la maison exige n'est pas une profession de foi : ce sont les
          règles que le code applique et que les tests vérifient. Elles se
          lisent dans le dépôt, ce qui les rend contestables — donc sérieuses. */}
      <SectionEditoriale titre={t("exigences.titre")} chapo={t("exigences.chapo")}>
        <ListePoints
          points={[1, 2, 3, 4].map((rang) => ({
            titre: t(`exigences.p${rang}.titre` as never),
            texte: t(`exigences.p${rang}.texte` as never),
          }))}
        />
      </SectionEditoriale>

      <AppelAction titre={t("appel.titre")} texte={t("appel.texte")}>
        <Bouton as={Link} href="/contact" taille="grand">
          {t("appel.action")}
        </Bouton>
      </AppelAction>
    </PageEditoriale>
  );
}
