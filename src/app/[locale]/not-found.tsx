import { useTranslations } from "next-intl";

import { EnTetePublic } from "@/components/navigation/en-tete-public";
import { PiedPagePublic } from "@/components/navigation/pied-page-public";
import { Bouton } from "@/components/ui/bouton";
import { Link } from "@/i18n/navigation";

/**
 * Page 404 d'un marché. Elle reprend la coquille publique : une adresse
 * erronée reste une page d'entrée possible depuis un moteur de recherche, et
 * doit proposer une porte de sortie plutôt qu'un cul-de-sac.
 */
export default function PageIntrouvable() {
  const t = useTranslations("erreurs");

  return (
    <>
      <EnTetePublic compte={null} />
      <main className="mx-auto w-full max-w-3xl px-4 py-24 sm:px-6">
        <p className="text-sm font-medium uppercase tracking-widest text-accent">
          404
        </p>
        <h1 className="mt-3 text-4xl font-semibold">{t("introuvable")}</h1>
        <p className="mt-4 text-lg text-texte-attenue">
          {t("introuvableTexte")}
        </p>
        <Bouton as={Link} href="/" taille="grand" className="mt-8">
          {t("retourAccueil")}
        </Bouton>
      </main>
      <PiedPagePublic />
    </>
  );
}
