import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { DossierSinistre } from "@/components/espace/dossier-sinistre";
import { FormulaireSinistre } from "@/components/espace/formulaire-sinistre";
import { Link } from "@/i18n/navigation";
import { contexteDeclaration, sinistreDeLaReservation } from "@/server/sinistres/depot";

type Props = { params: Promise<{ locale: string; reservation: string }> };

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Les états d'une location où un dommage a pu se produire. */
const STATUTS_DECLARABLES = ["en_cours", "restituee", "cloturee"];

/**
 * Le sinistre d'une location, vu du locataire.
 *
 * Une seule adresse, avant comme après : le formulaire de déclaration tant
 * qu'il n'y a rien, le dossier ensuite — le même parti pris que pour les
 * litiges et les états des lieux.
 */
export default async function PageSinistreLocataire({ params }: Props) {
  const { locale, reservation } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.sinistre");

  const sinistre = await sinistreDeLaReservation(reservation);
  const contexte = await contexteDeclaration(reservation);
  if (!sinistre && !contexte) notFound();

  const entete = sinistre ?? contexte!;
  const declarable =
    !sinistre && contexte && STATUTS_DECLARABLES.includes(contexte.statut);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-8 sm:py-10">
      <Link
        href="/compte/reservations"
        className="text-sm font-medium text-texte-attenue transition-colors hover:text-accent"
      >
        ← {t("retourReservations")}
      </Link>

      <div className="mt-4">
        <EnTeteEspace
          titre={t("titre")}
          sousTitre={`${entete.annonceTitre} · ${entete.reference}`}
        />
      </div>

      {sinistre ? (
        <DossierSinistre sinistre={sinistre} />
      ) : declarable ? (
        <FormulaireSinistre reservationId={reservation} />
      ) : (
        <p className="mt-8 rounded-carte border border-bordure bg-fond-eleve p-5 text-[0.9375rem] text-texte-attenue">
          {t("pasEncoreDeclarable")}
        </p>
      )}
    </div>
  );
}
