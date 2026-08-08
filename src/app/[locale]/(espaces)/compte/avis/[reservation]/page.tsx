import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { FormulaireAvis } from "@/components/annonce/formulaire-avis";
import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { Link } from "@/i18n/navigation";
import { avisAecrire } from "@/server/espaces/locataire";

type Props = { params: Promise<{ locale: string; reservation: string }> };

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Dépôt d'un avis sur une location close.
 *
 * La page ne s'ouvre que sur une location réellement proposable — trouvée
 * dans « avis à écrire », qui applique déjà la fenêtre de dépôt et l'absence
 * d'avis antérieur. Hors de ce cadre, il n'y a rien à saisir : autant le dire
 * par une absence de page que par un formulaire qui refuserait à l'envoi.
 */
export default async function PageDeposerAvis({ params }: Props) {
  const { locale, reservation } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.locataire.avis");
  const format = await getFormatter();

  const entree = (await avisAecrire()).find(
    (candidat) => candidat.reservationId === reservation,
  );
  if (!entree) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-8 sm:py-10">
      <Link
        href="/compte/avis"
        className="text-sm font-medium text-texte-attenue transition-colors hover:text-accent"
      >
        ← {t("formulaire.retour")}
      </Link>

      <div className="mt-4">
        <EnTeteEspace
          titre={t("formulaire.titre")}
          sousTitre={`${entree.annonceTitre} · ${t("chez", { prenom: entree.proprietaire })} · ${format.dateTime(
            entree.finLe,
            { day: "numeric", month: "long", year: "numeric" },
          )}`}
        />
      </div>

      <FormulaireAvis reservationId={entree.reservationId} />
    </div>
  );
}
