import { getTranslations } from "next-intl/server";

/**
 * Liens vers les documents d'une location.
 *
 * Ils ne s'affichent qu'à partir de la confirmation : avant, il n'y a pas de
 * contrat — proposer le téléchargement d'une pièce qui n'existe pas encore
 * ferait croire à un engagement pris. Le constat n'apparaît qu'une fois la
 * location partie, puisque c'est là qu'un état des lieux existe.
 *
 * De vrais liens, non des boutons : un document se veut parfois ouvert dans un
 * onglet, envoyé à son assureur, ou simplement enregistré.
 */
export async function DocumentsLocation({
  reservationId,
  statut,
  avecFacture = false,
}: {
  reservationId: string;
  statut: string;
  /** Le reçu ne s'affiche que du côté qui l'a réglé. */
  avecFacture?: boolean;
}) {
  const t = await getTranslations("espaces.documents");

  const confirmee = ["confirmee", "en_cours", "restituee", "cloturee"].includes(
    statut,
  );
  if (!confirmee) return null;

  const constatDisponible = ["en_cours", "restituee", "cloturee"].includes(statut);

  const documents = [
    { type: "contrat", libelle: t("contrat") },
    { type: "attestation", libelle: t("attestation") },
    ...(avecFacture ? [{ type: "facture", libelle: t("facture") }] : []),
    ...(constatDisponible
      ? [{ type: "constat", libelle: t("constat") }]
      : []),
  ];

  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {documents.map((document) => (
        <a
          key={document.type}
          href={`/api/documents/${document.type}/${reservationId}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-texte-attenue underline-offset-4 transition-colors hover:text-accent hover:underline"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden
          >
            <path
              d="M14 3v5h5M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {document.libelle}
        </a>
      ))}
    </div>
  );
}
