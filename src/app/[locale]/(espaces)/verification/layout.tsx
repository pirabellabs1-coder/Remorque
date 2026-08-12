import type { ReactNode } from "react";

import { CoquilleEspace } from "@/components/espace/coquille-espace";
import {
  NAVIGATION_LOCATAIRE,
  NAVIGATION_LOUEUR,
} from "@/components/espace/navigation-espace";
import { exigerConnexion } from "@/server/authentification/garde";

/**
 * Coquille de la vérification d'identité.
 *
 * **Elle n'exige aucun profil, seulement une session.** C'est tout l'objet de
 * ce fichier. L'écran vivait sous `/compte`, dont la coquille impose le profil
 * locataire : un compte propriétaire qui cliquait « Vérification » dans son
 * propre menu était renvoyé à son tableau de bord, sans un mot. Le lien
 * existait, la page existait, et elle était inatteignable pour la moitié des
 * comptes — précisément ceux à qui la publication venait d'être fermée faute
 * de vérification.
 *
 * La leçon dépasse le correctif : un écran qui appartient au **compte** ne doit
 * pas vivre sous la coquille d'un **espace**. « Un compte, deux profils » vaut
 * aussi pour l'arborescence.
 *
 * La navigation affichée suit les profils, pour que la barre latérale reste
 * celle de l'espace d'où l'on vient. Le locataire l'emporte quand les deux
 * profils sont actifs, comme partout ailleurs.
 */
export default async function LayoutVerification({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const compte = await exigerConnexion(locale, "/verification");

  const locataire = compte.profilLocataire;

  return (
    <CoquilleEspace
      espace={locataire ? "locataire" : "loueur"}
      navigation={locataire ? NAVIGATION_LOCATAIRE : NAVIGATION_LOUEUR}
      nomCompte={[compte.prenom, compte.nom].filter(Boolean).join(" ")}
      courrielCompte={compte.email}
    >
      {children}
    </CoquilleEspace>
  );
}
