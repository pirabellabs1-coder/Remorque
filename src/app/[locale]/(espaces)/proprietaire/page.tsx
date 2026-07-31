import { getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import {
  BanniereEnAttente,
  CarteIndicateur,
  ListeVide,
} from "@/components/espace/indicateurs";
import { Bouton } from "@/components/ui/bouton";
import { Link } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };

export default async function TableauDeBordLoueur({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.loueur");
  const tCommun = await getTranslations("espaces");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace
        titre={t("tableau.titre")}
        sousTitre={t("tableau.chapo")}
        actions={
          <Bouton as={Link} href="/proprietaire/annonces" taille="petit">
            {t("tableau.action")}
          </Bouton>
        }
      />

      <div className="mt-8 space-y-8">
        <BanniereEnAttente>{tCommun("enAttente")}</BanniereEnAttente>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CarteIndicateur
            libelle={t("tableau.revenus")}
            precision={t("tableau.revenusPrecision")}
          />
          <CarteIndicateur
            libelle={t("tableau.occupation")}
            precision={t("tableau.occupationPrecision")}
          />
          <CarteIndicateur
            libelle={t("tableau.demandes")}
            precision={t("tableau.demandesPrecision")}
          />
          <CarteIndicateur
            libelle={t("tableau.note")}
            precision={t("tableau.notePrecision")}
          />
        </div>

        <section>
          <h2 className="text-[1.0625rem] font-semibold">
            {t("tableau.actions")}
          </h2>
          <div className="mt-4">
            <ListeVide
              titre={t("tableau.vide.titre")}
              texte={t("tableau.vide.texte")}
              action={
                <Bouton as={Link} href="/proprietaire/annonces">
                  {t("tableau.vide.action")}
                </Bouton>
              }
            />
          </div>
        </section>
      </div>
    </div>
  );
}
