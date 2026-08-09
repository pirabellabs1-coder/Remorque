import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { DossierDemande } from "@/components/espace/dossier-demande";
import { Link } from "@/i18n/navigation";
import { demandeParIdentifiant } from "@/server/support/depot";

type Props = { params: Promise<{ locale: string; demande: string }> };

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Une demande d'assistance, vue du loueur qui l'a écrite. */
export default async function PageDemandeLoueur({ params }: Props) {
  const { locale, demande: demandeId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.support");

  const demande = await demandeParIdentifiant(demandeId);
  if (!demande) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-8 sm:py-10">
      <Link
        href="/proprietaire/assistance"
        className="text-sm font-medium text-texte-attenue transition-colors hover:text-accent"
      >
        ← {t("retourListe")}
      </Link>

      <div className="mt-4">
        <EnTeteEspace titre={t("titre")} sousTitre={demande.reference} />
      </div>

      <DossierDemande ticket={demande} />
    </div>
  );
}
