import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { Pastille } from "@/components/espace/tableau";
import { DecisionDossier } from "@/components/espace/verification/decision-dossier";
import { Carte } from "@/components/ui/carte";
import { dossiersEnAttente } from "@/server/verification/dossier";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };

/**
 * Rien à mettre en cache ici.
 *
 * La file change à chaque dépôt : une page figée au déploiement
 * annoncerait « aucun dossier en attente » à un contrôleur qui en a trois.
 */
export const dynamic = "force-dynamic";

/**
 * File de contrôle des dossiers de vérification.
 *
 * **Groupée par compte, jamais par pièce.** On ne décide pas d'un recto : la
 * date de fin de validité est au dos, et un contrôleur qui traite une file de
 * faces isolées prend deux fois la même décision sur le même dossier.
 *
 * **Les pièces s'ouvrent, elles ne s'affichent pas.** Une file d'attente qui
 * étale vingt cartes d'identité à l'écran est une fuite de données au premier
 * regard par-dessus l'épaule, et elle charge vingt images pour deux qu'on
 * regarde. Chaque face est un lien vers la route gardée, qui vérifie la
 * session et interdit toute mise en cache.
 *
 * Chaque décision écrit au journal d'audit — règle 5, et ici plus qu'ailleurs :
 * « qui a validé l'identité de ce compte » est la première question posée le
 * jour où un bien ne revient pas.
 */
export default async function PageVerifications({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.admin.verifications");
  const format = await getFormatter();

  const dossiers = await dossiersEnAttente();

  return (
    <div className="space-y-8">
      <EnTeteEspace
        titre={t("titre")}
        sousTitre={t("sousTitre")}
        actions={
          <Pastille ton={dossiers.length > 0 ? "attente" : "succes"}>
            {t("enAttente", { nombre: dossiers.length })}
          </Pastille>
        }
      />

      {dossiers.length === 0 ? (
        <Carte>
          <p className="text-[0.9375rem]">{t("vide")}</p>
          <p className="mt-1 text-sm text-texte-attenue">{t("videTexte")}</p>
        </Carte>
      ) : null}

      {dossiers.map((dossier) => {
        // Un compte peut avoir déposé identité et permis dans la même session.
        // Ils se décident séparément : accepter une pièce d'identité valable
        // ne dit rien du permis, et l'inverse non plus.
        const types = [...new Set(dossier.pieces.map((piece) => piece.type))];

        return (
          <Carte key={dossier.utilisateurId}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">
                  {[dossier.prenom, dossier.nom].filter(Boolean).join(" ") ||
                    t("sansNom")}
                </h2>
                <p className="mt-1 text-sm text-texte-attenue">
                  {dossier.email}
                </p>
              </div>
              <p className="text-sm text-texte-attenue">
                {t("depose", {
                  date: format.relativeTime(dossier.pieces[0].deposeeLe),
                })}
              </p>
            </div>

            {types.map((type) => (
              <div
                key={type}
                className="mt-6 border-t border-bordure pt-6 first:border-t-0 first:pt-0"
              >
                <p className="text-sm font-medium">{t(`type.${type}`)}</p>

                <ul className="mt-3 flex flex-wrap gap-3">
                  {dossier.pieces
                    .filter((piece) => piece.type === type)
                    .map((piece) => (
                      <li key={piece.id}>
                        {/* Nouvel onglet : le contrôleur garde la file sous
                            les yeux et n'a pas à revenir en arrière entre
                            chaque face. */}
                        <a
                          href={`/api/verification/piece/${piece.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center rounded-champ border border-bordure px-3 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
                        >
                          {t(`face.${piece.face}`)}
                        </a>
                      </li>
                    ))}
                </ul>

                <DecisionDossier
                  utilisateurId={dossier.utilisateurId}
                  type={type}
                  permis={type === "permis"}
                />
              </div>
            ))}
          </Carte>
        );
      })}
    </div>
  );
}
