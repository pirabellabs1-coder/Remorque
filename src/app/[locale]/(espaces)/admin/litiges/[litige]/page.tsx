import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { DossierLitige } from "@/components/espace/dossier-litige";
import { Link } from "@/i18n/navigation";
import { litigeParIdentifiant } from "@/server/litiges/depot";

type Props = { params: Promise<{ locale: string; litige: string }> };

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Instruction d'un litige par l'administration.
 *
 * Le dossier affiché est exactement celui que voient les parties : c'est ce
 * qui rend l'arbitrage opposable. Seules les actions diffèrent — trancher et
 * classer n'appartiennent qu'à la plateforme.
 */
export default async function PageArbitrage({ params }: Props) {
  const { locale, litige: litigeId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.litige");

  const litige = await litigeParIdentifiant(litigeId);
  if (!litige) notFound();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
      <Link
        href="/admin/litiges"
        className="text-sm font-medium text-texte-attenue transition-colors hover:text-accent"
      >
        ← {t("retourListe")}
      </Link>

      <div className="mt-4">
        <EnTeteEspace
          titre={t("titre")}
          sousTitre={`${litige.annonceTitre} · ${litige.reference} · ${litige.interlocuteur}`}
        />
      </div>

      <DossierLitige litige={litige} />
    </div>
  );
}
