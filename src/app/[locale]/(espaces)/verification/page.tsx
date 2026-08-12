import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { Pastille, type TonPastille } from "@/components/espace/tableau";
import { DepotPiece } from "@/components/espace/verification/depot-piece";
import { Carte } from "@/components/ui/carte";
import type { Piece, StatutVerification } from "@/domain/verification/dossier";
import { compteConnecte } from "@/server/authentification/session";
import { dossierDe, piecesDe } from "@/server/verification/dossier";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ publier?: string }>;
};

export const metadata = { robots: { index: false, follow: false } };

/** Couleur de la pastille d'un statut. Le libellé la double toujours. */
const TON: Record<StatutVerification, TonPastille> = {
  non_soumis: "neutre",
  en_attente: "attente",
  verifie: "succes",
  refuse: "danger",
};

/**
 * Vérification d'identité — un écran pour les deux profils.
 *
 * Rangé sous `/compte` et non dupliqué sous `/proprietaire` : « un compte, deux
 * profils », et la même carte d'identité ne se dépose pas deux fois. Les deux
 * espaces y mènent, et le dossier demandé s'adapte — le propriétaire remet un
 * bien et n'a que son identité à prouver, le locataire attelle et conduit, donc
 * son permis aussi.
 *
 * **Pourquoi cet écran existe.** La base portait `identite_statut` et
 * `permis_statut` depuis l'origine, avec le commentaire « conditionnent la
 * publication et la réservation ». Personne ne les lisait, et rien ne permettait
 * de les renseigner : on pouvait publier une remorque et en réserver une sans
 * jamais avoir dit qui l'on était.
 *
 * **Ce qu'il montre d'un refus.** Le motif, tel quel. Un dossier refusé sans
 * raison visible fait revenir l'intéressé vers le support, qui répétera ce que
 * cet écran aurait pu dire — et pendant ce temps la location ne se fait pas.
 */
export default async function PageVerification({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { publier } = await searchParams;

  const compte = await compteConnecte();
  if (!compte) notFound();

  const dossier = await dossierDe(compte.id);
  if (!dossier) notFound();

  const t = await getTranslations("espaces.verification");
  const format = await getFormatter();

  const pieces = await piecesDe(compte.id);
  const statutDe = (piece: Piece): StatutVerification =>
    piece === "identite"
      ? dossier.etat.identiteStatut
      : dossier.etat.permisStatut;

  /** Le dernier motif de refus connu pour une pièce, s'il existe. */
  const motifDe = (piece: Piece) =>
    pieces.find(
      (entree) =>
        entree.type === piece && entree.statut === "refusee" && entree.motif,
    )?.motif ?? null;

  const { faits, total } = dossier.avancement;

  return (
    <div className="space-y-8">
      <EnTeteEspace
        titre={t("titre")}
        sousTitre={t("sousTitre")}
        actions={
          <Pastille ton={faits === total ? "succes" : "attente"}>
            {t("avancement", { faits, total })}
          </Pastille>
        }
      />

      {/* Une annonce attend d'être publiée : le dire, sinon cet écran ressemble
          à un formulaire administratif tombé du ciel au pire moment. */}
      {publier ? (
        <div className="rounded-carte border border-accent/30 bg-accent/5 p-5">
          <p className="text-[0.9375rem] font-medium">{t("annonceEnAttente")}</p>
          <p className="mt-1 text-sm text-texte-attenue">
            {t("annonceEnAttenteTexte")}
          </p>
        </div>
      ) : null}

      {/* L'adresse électronique, qui n'est pas une pièce mais compte au
          dossier : c'est la seule voie par laquelle on joindra le compte. */}
      <Carte>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">{t("courriel.titre")}</h2>
            <p className="mt-1 text-sm text-texte-attenue">{compte.email}</p>
          </div>
          <Pastille ton={dossier.etat.emailVerifie ? "succes" : "attente"}>
            {t(dossier.etat.emailVerifie ? "statut.verifie" : "statut.en_attente")}
          </Pastille>
        </div>
      </Carte>

      {dossier.requises.map((piece) => {
        const statut = statutDe(piece);
        const motif = motifDe(piece);

        return (
          <Carte key={piece}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-xl">
                <h2 className="font-semibold">{t(`piece.${piece}.titre`)}</h2>
                <p className="mt-1 text-sm text-texte-attenue">
                  {t(`piece.${piece}.pourquoi`)}
                </p>
              </div>
              <Pastille ton={TON[statut]}>{t(`statut.${statut}`)}</Pastille>
            </div>

            {/* Le motif du refus, mot pour mot. C'est la seule chose qui dise
                quoi reprendre. */}
            {statut === "refuse" && motif ? (
              <p className="mt-4 rounded-champ border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
                {motif}
              </p>
            ) : null}

            {statut === "verifie" ? (
              <p className="mt-4 text-sm text-texte-attenue">
                {piece === "permis" && dossier.etat.permisExpireLe
                  ? t("valideJusquau", {
                      date: format.dateTime(dossier.etat.permisExpireLe, {
                        dateStyle: "long",
                      }),
                    })
                  : t("piece.acceptee")}
              </p>
            ) : statut === "en_attente" ? (
              <p className="mt-4 text-sm text-texte-attenue">{t("enExamen")}</p>
            ) : (
              <DepotPiece
                type={piece}
                titre={t(`piece.${piece}.depot`)}
                explication={t(`piece.${piece}.consigne`)}
              />
            )}
          </Carte>
        );
      })}

      <p className="text-sm text-texte-attenue">{t("confidentialite")}</p>
    </div>
  );
}
