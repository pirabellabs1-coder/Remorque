import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { DossierDemande } from "@/components/espace/dossier-demande";
import { Link } from "@/i18n/navigation";
import { demandeParIdentifiant } from "@/server/support/depot";

type Props = { params: Promise<{ locale: string; demande: string }> };

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Une demande d'assistance, vue de l'assistance.
 *
 * Le dossier est celui que voit le demandeur, augmenté des notes internes.
 * Seules les actions diffèrent — prendre, répondre et clore n'appartiennent
 * qu'à l'assistance.
 */
export default async function PageDemandeAdmin({ params }: Props) {
  const { locale, demande: demandeId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.support");

  const demande = await demandeParIdentifiant(demandeId);
  if (!demande) notFound();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
      <Link
        href="/admin/support"
        className="text-sm font-medium text-texte-attenue transition-colors hover:text-accent"
      >
        ← {t("retourFile")}
      </Link>

      <div className="mt-4">
        <EnTeteEspace
          titre={t("titre")}
          sousTitre={`${demande.reference} · ${demande.demandeur || demande.demandeurEmail || ""}`}
        />
      </div>

      <DossierDemande ticket={demande} />
    </div>
  );
}
