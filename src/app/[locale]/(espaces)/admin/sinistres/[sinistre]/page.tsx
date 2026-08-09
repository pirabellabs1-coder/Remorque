import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { DossierSinistre } from "@/components/espace/dossier-sinistre";
import { Link } from "@/i18n/navigation";
import { sinistreParIdentifiant } from "@/server/sinistres/depot";

type Props = { params: Promise<{ locale: string; sinistre: string }> };

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Instruction d'un sinistre par l'administration.
 *
 * Le dossier affiché est exactement celui que voient les parties : c'est ce
 * qui rend l'instruction opposable. Seules les actions diffèrent —
 * transmettre, indemniser et refuser n'appartiennent qu'à la plateforme.
 */
export default async function PageInstructionSinistre({ params }: Props) {
  const { locale, sinistre: sinistreId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.sinistre");

  const sinistre = await sinistreParIdentifiant(sinistreId);
  if (!sinistre) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-8 sm:py-10">
      <Link
        href="/admin/assurance"
        className="text-sm font-medium text-texte-attenue transition-colors hover:text-accent"
      >
        ← {t("retourListe")}
      </Link>

      <div className="mt-4">
        <EnTeteEspace
          titre={t("titre")}
          sousTitre={`${sinistre.annonceTitre} · ${sinistre.reference} · ${sinistre.interlocuteur}`}
        />
      </div>

      <DossierSinistre sinistre={sinistre} />
    </div>
  );
}
