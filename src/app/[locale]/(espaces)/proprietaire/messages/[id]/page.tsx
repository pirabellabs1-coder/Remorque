import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { FilConversation } from "@/components/espace/fil-conversation";
import { Link } from "@/i18n/navigation";
import { marquerLus, mesFils, messagesDuFil } from "@/server/messagerie/depot";

type Props = { params: Promise<{ locale: string; id: string }> };

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PageFilProprietaire({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.fil");

  // Chercher le fil dans « mes fils » vaut contrôle d'accès : un identifiant
  // recopié depuis l'adresse d'autrui ne s'y trouvera pas.
  const fil = (await mesFils()).find((entree) => entree.id === id);
  if (!fil) notFound();

  const messages = await messagesDuFil(fil.id);

  // Ouvrir le fil, c'est le lire : le compteur retombe pour la prochaine page.
  await marquerLus(fil.id);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
      <Link
        href="/proprietaire/messages"
        className="text-sm font-medium text-texte-attenue transition-colors hover:text-accent"
      >
        ← {t("retour")}
      </Link>

      <div className="mt-4">
        <EnTeteEspace
          titre={fil.interlocuteur}
          sousTitre={
            fil.reference
              ? `${fil.annonceTitre} · ${t("reservation", { reference: fil.reference })}`
              : fil.annonceTitre
          }
        />
      </div>

      <FilConversation fil={fil} messages={messages} />
    </div>
  );
}
