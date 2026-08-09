"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { PRIORITES_SUPPORT } from "@/domain/support/machine";
import { useRouter } from "@/i18n/navigation";
import { ouvrirDemande } from "@/server/support/actions";

/**
 * Ouverture d'une demande d'assistance.
 *
 * Le rattachement à une location est proposé, jamais imposé : on écrit au
 * support avant d'avoir réservé. Mais quand la demande porte sur un dossier,
 * le choisir ici épargne l'aller-retour où l'assistance réclame la référence.
 *
 * La priorité est déclarée par le demandeur. C'est un pari assumé : la
 * plupart des gens l'estiment honnêtement, et l'écran annonce le délai attaché
 * à chaque niveau plutôt que de laisser croire que « haute » accélère tout.
 */
export function FormulaireDemande({
  locations,
}: {
  locations: { id: string; libelle: string }[];
}) {
  const t = useTranslations("espaces.support.formulaire");
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);

    const formulaire = evenement.currentTarget;
    const donnees = new FormData(formulaire);

    demarrer(async () => {
      // Une action serveur qui rejette — panne de base, réseau coupé — laisse
      // sinon le bouton se réactiver sans un mot : l'usager croit n'avoir rien
      // cliqué et recommence, ce qui produit deux demandes au lieu d'une.
      let resultat: Awaited<ReturnType<typeof ouvrirDemande>>;
      try {
        resultat = await ouvrirDemande(donnees);
      } catch {
        setErreur(t("erreurs.echec"));
        return;
      }

      if (resultat.ok) {
        formulaire.reset();
        router.refresh();
        return;
      }

      const connues = [
        "invalide",
        "locationInconnue",
        "connexionRequise",
        "reessayer",
      ];
      setErreur(
        connues.includes(resultat.cle)
          ? t(`erreurs.${resultat.cle}` as never)
          : t("erreurs.echec"),
      );
    });
  }

  return (
    <form onSubmit={soumettre} className="mt-8 space-y-6">
      <div className="rounded-carte border border-bordure bg-fond-eleve p-5 shadow-(--ombre-carte)">
        <label htmlFor="sujet" className="block text-[0.9375rem] font-semibold">
          {t("sujet")}
        </label>
        <input
          id="sujet"
          name="sujet"
          type="text"
          required
          minLength={5}
          maxLength={200}
          className="mt-2 h-12 w-full rounded-champ border border-bordure bg-fond-eleve px-4 text-base focus:border-accent"
        />

        <label
          htmlFor="priorite"
          className="mt-5 block text-[0.9375rem] font-semibold"
        >
          {t("priorite")}
        </label>
        <p className="mt-1 text-sm text-texte-attenue">{t("prioriteAide")}</p>
        <select
          id="priorite"
          name="priorite"
          defaultValue="normale"
          className="mt-2 h-12 w-full rounded-champ border border-bordure bg-fond-eleve px-4 text-base focus:border-accent"
        >
          {PRIORITES_SUPPORT.map((priorite) => (
            <option key={priorite} value={priorite}>
              {t(`priorites.${priorite}` as never)}
            </option>
          ))}
        </select>

        {locations.length > 0 ? (
          <>
            <label
              htmlFor="reservationId"
              className="mt-5 block text-[0.9375rem] font-semibold"
            >
              {t("location")}
            </label>
            <p className="mt-1 text-sm text-texte-attenue">{t("locationAide")}</p>
            <select
              id="reservationId"
              name="reservationId"
              defaultValue=""
              className="mt-2 h-12 w-full rounded-champ border border-bordure bg-fond-eleve px-4 text-base focus:border-accent"
            >
              <option value="">{t("sansLocation")}</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.libelle}
                </option>
              ))}
            </select>
          </>
        ) : null}

        <label
          htmlFor="message"
          className="mt-5 block text-[0.9375rem] font-semibold"
        >
          {t("message")}
        </label>
        <p className="mt-1 text-sm text-texte-attenue">{t("messageAide")}</p>
        <textarea
          id="message"
          name="message"
          required
          minLength={20}
          maxLength={4000}
          rows={6}
          className="mt-2 w-full resize-y rounded-champ border border-bordure bg-fond-eleve px-4 py-3 text-base focus:border-accent"
        />
      </div>

      <div>
        <button
          type="submit"
          disabled={enCours}
          className="w-full rounded-champ bg-accent px-6 py-3.5 text-base font-medium text-accent-contraste transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto"
        >
          {enCours ? t("envoiEnCours") : t("envoyer")}
        </button>

        {erreur ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            {erreur}
          </p>
        ) : null}
      </div>
    </form>
  );
}
