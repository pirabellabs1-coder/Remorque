"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Bouton } from "@/components/ui/bouton";
import { Champ } from "@/components/ui/champ";
import { Link } from "@/i18n/navigation";
import {
  demanderLocation,
  type EtatDemande,
} from "@/server/reservations/demande-actions";

/**
 * Formulaire de demande de location.
 *
 * Ce qu'il demande n'est pas décoratif : le contrat de location, la facture et
 * l'attestation d'assurance nomment un preneur et le situent. Sans adresse,
 * aucune des trois n'est émettable — et le propriétaire remet un bien de
 * plusieurs milliers d'euros à quelqu'un dont il ne sait rien.
 *
 * Les champs sont pré-remplis depuis le compte et réenregistrés à l'envoi : la
 * deuxième location ne les redemande pas.
 *
 * Les erreurs s'affichent sous chaque champ, et la saisie reste en place. Un
 * formulaire de dix champs qui se vide sur une faute de frappe au téléphone
 * est un formulaire qu'on abandonne.
 */
export function FormulaireDemande({
  annonceId,
  debut,
  fin,
  compte,
}: {
  annonceId: string;
  /** Horodatages déjà choisis sur la fiche, au format attendu par `Date`. */
  debut: string;
  fin: string;
  compte: {
    prenom: string;
    nom: string;
    telephone: string;
    adresseLigne1: string;
    adresseLigne2: string;
    codePostal: string;
    ville: string;
  };
}) {
  const t = useTranslations("annonce.demande");

  const [etat, action, enCours] = useActionState<EtatDemande, FormData>(
    demanderLocation,
    { statut: "inactif" },
  );

  const champs = etat.statut === "erreur" ? etat.champs : {};
  const erreurDe = (nom: string) =>
    champs[nom] ? t(`erreurs.${nom}` as never) : undefined;

  if (etat.statut === "envoyee") {
    return (
      <div className="rounded-carte border border-succes/30 bg-succes/5 p-6 text-center">
        <p className="text-lg font-semibold text-succes">
          {t("envoyee.titre", { numero: etat.numero })}
        </p>
        <p className="mx-auto mt-2 max-w-md text-[0.9375rem] text-texte-attenue">
          {t("envoyee.texte")}
        </p>
        <Bouton as={Link} href="/compte/reservations" className="mt-5">
          {t("envoyee.suivre")}
        </Bouton>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="annonceId" value={annonceId} />
      <input type="hidden" name="debut" value={debut} />
      <input type="hidden" name="fin" value={fin} />

      <fieldset className="rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
        <legend className="px-2 text-[0.9375rem] font-semibold">
          {t("coordonnees")}
        </legend>

        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Champ
            libelle={t("prenom")}
            name="prenom"
            required
            autoComplete="given-name"
            defaultValue={compte.prenom}
            erreur={erreurDe("prenom")}
          />
          <Champ
            libelle={t("nom")}
            name="nom"
            required
            autoComplete="family-name"
            defaultValue={compte.nom}
            erreur={erreurDe("nom")}
          />
          <Champ
            libelle={t("telephone")}
            name="telephone"
            type="tel"
            required
            autoComplete="tel"
            inputMode="tel"
            defaultValue={compte.telephone}
            aide={t("telephoneAide")}
            erreur={erreurDe("telephone")}
            className="sm:col-span-2"
          />
        </div>
      </fieldset>

      <fieldset className="rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
        <legend className="px-2 text-[0.9375rem] font-semibold">
          {t("adresse")}
        </legend>
        <p className="mt-2 text-[0.9375rem] text-texte-attenue">
          {t("adresseChapo")}
        </p>

        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          <Champ
            libelle={t("adresseLigne1")}
            name="adresseLigne1"
            required
            autoComplete="address-line1"
            defaultValue={compte.adresseLigne1}
            erreur={erreurDe("adresseLigne1")}
            className="sm:col-span-3"
          />
          <Champ
            libelle={t("adresseLigne2")}
            name="adresseLigne2"
            autoComplete="address-line2"
            defaultValue={compte.adresseLigne2}
            className="sm:col-span-3"
          />
          <Champ
            libelle={t("codePostal")}
            name="codePostal"
            required
            autoComplete="postal-code"
            inputMode="numeric"
            defaultValue={compte.codePostal}
            erreur={erreurDe("codePostal")}
          />
          <Champ
            libelle={t("villeChamp")}
            name="ville"
            required
            autoComplete="address-level2"
            defaultValue={compte.ville}
            erreur={erreurDe("ville")}
            className="sm:col-span-2"
          />
        </div>
      </fieldset>

      <fieldset className="rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
        <legend className="px-2 text-[0.9375rem] font-semibold">
          {t("message")}
        </legend>

        <label htmlFor="message-demande" className="sr-only">
          {t("message")}
        </label>
        <textarea
          id="message-demande"
          name="message"
          rows={4}
          maxLength={1000}
          placeholder={t("messagePlaceholder")}
          className="mt-4 w-full rounded-champ border border-bordure bg-fond-eleve px-4 py-3 text-base text-texte transition-colors focus:border-accent"
        />
        <p className="mt-2 text-sm text-texte-attenue">{t("messageAide")}</p>
      </fieldset>

      <div>
        <label className="flex items-start gap-3 text-[0.9375rem]">
          <input
            type="checkbox"
            name="conditions"
            className="mt-1 size-4 accent-[var(--accent)]"
          />
          <span>
            {t("conditions")}{" "}
            <Link href="/cgv" className="font-medium underline underline-offset-4">
              {t("conditionsLien")}
            </Link>
          </span>
        </label>
        {erreurDe("conditions") ? (
          <p className="mt-2 text-sm text-danger">{erreurDe("conditions")}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Bouton type="submit" taille="grand" disabled={enCours}>
          {enCours ? t("envoi") : t("envoyer")}
        </Bouton>

        <p aria-live="polite" role="status" className="text-[0.9375rem] text-danger">
          {etat.statut === "erreur" && etat.general
            ? t(`erreurs.${etat.general}` as never)
            : null}
        </p>
      </div>
    </form>
  );
}
