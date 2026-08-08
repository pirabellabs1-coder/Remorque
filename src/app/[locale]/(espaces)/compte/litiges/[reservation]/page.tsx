import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { DossierLitige } from "@/components/espace/dossier-litige";
import { FormulaireLitige } from "@/components/espace/formulaire-litige";
import { Link } from "@/i18n/navigation";
import { PRIX_AFFICHE } from "@/lib/cn";
import { contexteOuverture, litigeDeLaReservation } from "@/server/litiges/depot";

type Props = { params: Promise<{ locale: string; reservation: string }> };

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Le litige d'une location, vu du locataire.
 *
 * Une seule adresse, avant comme après : le formulaire d'ouverture tant qu'il
 * n'y a rien, le dossier ensuite. C'est le même parti pris que pour les états
 * des lieux — un dossier ne change pas d'adresse en naissant.
 */
export default async function PageLitigeLocataire({ params }: Props) {
  const { locale, reservation } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.litige");
  const format = await getFormatter();

  const litige = await litigeDeLaReservation(reservation);
  const contexte = await contexteOuverture(reservation);
  if (!litige && !contexte) notFound();

  const entete = litige ?? contexte!;

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

      {litige ? (
        <DossierLitige litige={litige} />
      ) : (
        <FormulaireLitige
          reservationId={reservation}
          caution={contexte!.caution}
          cautionAffichee={format.number(contexte!.caution / 100, {
            ...PRIX_AFFICHE,
            currency: contexte!.devise,
          })}
          espace="compte"
        />
      )}
    </div>
  );
}
