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

export default async function TableauDeBordLocataire({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.locataire");
  const tCommun = await getTranslations("espaces");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace titre={t("tableau.titre")} sousTitre={t("tableau.chapo")} />

      <div className="mt-8 space-y-8">
        <BanniereEnAttente>{tCommun("enAttente")}</BanniereEnAttente>

        <div className="grid gap-4 sm:grid-cols-3">
          <CarteIndicateur
            libelle={t("tableau.aVenir")}
            precision={t("tableau.aVenirPrecision")}
          />
          <CarteIndicateur
            libelle={t("tableau.cautions")}
            precision={t("tableau.cautionsPrecision")}
          />
          <CarteIndicateur
            libelle={t("tableau.messages")}
            precision={t("tableau.messagesPrecision")}
          />
        </div>

        <section>
          <h2 className="text-[1.0625rem] font-semibold">
            {t("tableau.prochaine")}
          </h2>
          <div className="mt-4">
            <ListeVide
              titre={t("tableau.vide.titre")}
              texte={t("tableau.vide.texte")}
              action={
                <Bouton as={Link} href="/recherche">
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
