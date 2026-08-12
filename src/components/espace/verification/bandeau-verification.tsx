import { getTranslations } from "next-intl/server";

import { Bouton } from "@/components/ui/bouton";
import { Link } from "@/i18n/navigation";
import { compteConnecte } from "@/server/authentification/session";
import { dossierDe } from "@/server/verification/dossier";

/**
 * Rappel du dossier incomplet, en tête des deux espaces.
 *
 * Placé dans la mise en page et non dans chaque écran : le tableau de bord
 * n'est pas la seule porte d'entrée, on arrive aussi par un lien de courriel
 * ou par un favori. Un rappel posé sur la seule page d'accueil de l'espace est
 * un rappel qu'on ne voit pas.
 *
 * **Il se tait quand il n'a rien à dire**, et notamment pendant l'examen : une
 * bannière qui reste après le dépôt fait croire que l'envoi n'a pas abouti, et
 * les pièces sont redéposées une seconde fois. C'est `manques` qui décide, et
 * c'est la même fonction que la porte du serveur — le bandeau ne peut donc pas
 * annoncer un blocage qui n'existe pas, ni taire celui qui existe.
 */
export async function BandeauVerification({
  espace,
}: {
  espace: "locataire" | "proprietaire";
}) {
  const compte = await compteConnecte();
  if (!compte) return null;

  const dossier = await dossierDe(compte.id);
  if (!dossier || !dossier.exigee) return null;

  const manques =
    espace === "locataire"
      ? dossier.manquesReservation
      : dossier.manquesPublication;

  if (manques.length === 0) return null;

  // Une pièce en cours d'examen n'appelle aucune action : le dire ici
  // relancerait un dépôt inutile. Le détail reste sur l'écran dédié.
  const enExamen = manques.every((manque) => manque.endsWith("EnAttente"));
  if (enExamen) return null;

  const t = await getTranslations("espaces.verification.bandeau");

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-carte border border-attention/30 bg-attention/5 px-5 py-4">
      <div>
        <p className="text-[0.9375rem] font-medium">{t("titre")}</p>
        <p className="mt-1 text-sm text-texte-attenue">{t(espace)}</p>
      </div>
      <Bouton as={Link} href="/verification" variante="secondaire">
        {t("action")}
      </Bouton>
    </div>
  );
}
