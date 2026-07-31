"use client";

import { useTranslations } from "next-intl";
import { useActionState, useId } from "react";

import { Bouton } from "@/components/ui/bouton";
import { Champ } from "@/components/ui/champ";
import { CATEGORIES } from "@/config/categories";
import { PAYS, villesDuPays } from "@/config/villes";
import { Link } from "@/i18n/navigation";
import {
  publierAnnonce,
  type EtatPublication,
} from "@/server/annonces/actions";

/**
 * Publication d'une annonce.
 *
 * Un vrai formulaire relié à une action serveur : ce qui est publié ici est
 * réellement enregistré et apparaît aussitôt dans le catalogue public. Ce
 * n'est pas une maquette.
 *
 * Les montants sont saisis en euros — c'est ce qu'un humain écrit — et
 * convertis en centimes côté serveur, à la frontière. Aucun euro flottant ne
 * circule au-delà.
 */
export function FormulaireAnnonce() {
  const t = useTranslations("espaces.loueur.publication");
  const identifiant = useId();

  const [etat, action, enCours] = useActionState<EtatPublication, FormData>(
    publierAnnonce,
    { statut: "inactif" },
  );

  const champ =
    "mt-2 h-12 w-full rounded-champ border border-bordure bg-fond-eleve px-4 text-base text-texte";

  return (
    <form action={action} className="space-y-8">
      {/* ---------- Le matériel ---------- */}
      <fieldset className="rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
        <legend className="px-2 text-[0.9375rem] font-semibold">
          {t("materiel")}
        </legend>

        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Champ
            libelle={t("titreChamp")}
            name="titre"
            required
            minLength={5}
            maxLength={80}
            placeholder={t("titrePlaceholder")}
            className="sm:col-span-2"
          />

          <div>
            <label
              htmlFor={`${identifiant}-categorie`}
              className="text-sm font-medium"
            >
              {t("categorie")}
            </label>
            <select
              id={`${identifiant}-categorie`}
              name="categorie"
              required
              className={champ}
            >
              {CATEGORIES.map((categorie) => (
                <option key={categorie.slug} value={categorie.slug}>
                  {categorie.nom}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor={`${identifiant}-ville`}
              className="text-sm font-medium"
            >
              {t("ville")}
            </label>
            <select
              id={`${identifiant}-ville`}
              name="villeSlug"
              required
              className={champ}
            >
              {PAYS.map((pays) => (
                <optgroup key={pays} label={pays}>
                  {villesDuPays(pays).map((ville) => (
                    <option key={ville.slug} value={ville.slug}>
                      {ville.nom}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor={`${identifiant}-description`}
              className="text-sm font-medium"
            >
              {t("description")}
            </label>
            <textarea
              id={`${identifiant}-description`}
              name="description"
              required
              minLength={20}
              maxLength={2000}
              rows={4}
              placeholder={t("descriptionPlaceholder")}
              className="mt-2 w-full rounded-champ border border-bordure bg-fond-eleve px-4 py-3 text-base text-texte"
            />
          </div>
        </div>
      </fieldset>

      {/* ---------- Caractéristiques ---------- */}
      <fieldset className="rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
        <legend className="px-2 text-[0.9375rem] font-semibold">
          {t("caracteristiques")}
        </legend>

        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Champ
            libelle={t("ptac")}
            name="ptacKg"
            type="number"
            inputMode="numeric"
            required
            min={100}
            max={3500}
            defaultValue={750}
          />
          <Champ
            libelle={t("poidsVide")}
            name="poidsVideKg"
            type="number"
            inputMode="numeric"
            required
            min={20}
            max={3000}
            defaultValue={250}
            aide={t("poidsVideAide")}
          />
          <Champ
            libelle={t("longueur")}
            name="longueurUtileMm"
            type="number"
            inputMode="numeric"
            required
            min={500}
            max={10000}
            defaultValue={2000}
          />
          <Champ
            libelle={t("largeur")}
            name="largeurUtileMm"
            type="number"
            inputMode="numeric"
            required
            min={500}
            max={3000}
            defaultValue={1300}
          />
        </div>

        <label className="mt-5 flex items-center gap-3 text-[0.9375rem]">
          <input
            type="checkbox"
            name="freinee"
            className="size-4 accent-[var(--accent)]"
          />
          {t("freinee")}
        </label>
      </fieldset>

      {/* ---------- Conditions ---------- */}
      <fieldset className="rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
        <legend className="px-2 text-[0.9375rem] font-semibold">
          {t("conditions")}
        </legend>

        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Champ
            libelle={t("prix")}
            name="prixJourEuros"
            type="number"
            inputMode="decimal"
            required
            min={1}
            max={2000}
            step={1}
            defaultValue={35}
          />
          <Champ
            libelle={t("caution")}
            name="cautionEuros"
            type="number"
            inputMode="decimal"
            required
            min={0}
            max={5000}
            step={10}
            defaultValue={400}
            aide={t("cautionAide")}
          />

          <div>
            <label
              htmlFor={`${identifiant}-annulation`}
              className="text-sm font-medium"
            >
              {t("annulation")}
            </label>
            <select
              id={`${identifiant}-annulation`}
              name="politiqueAnnulation"
              defaultValue="moderee"
              className={champ}
            >
              <option value="souple">{t("annulationSouple")}</option>
              <option value="moderee">{t("annulationModeree")}</option>
              <option value="stricte">{t("annulationStricte")}</option>
            </select>
          </div>
        </div>

        <Champ
          libelle={t("equipements")}
          name="equipements"
          placeholder={t("equipementsPlaceholder")}
          aide={t("equipementsAide")}
          className="mt-5"
        />

        <label className="mt-5 flex items-start gap-3 text-[0.9375rem]">
          <input
            type="checkbox"
            name="reservationInstantanee"
            className="mt-1 size-4 accent-[var(--accent)]"
          />
          <span>
            {t("instantanee")}
            <span className="mt-0.5 block text-sm text-texte-attenue">
              {t("instantaneeAide")}
            </span>
          </span>
        </label>
      </fieldset>

      <div className="flex flex-wrap items-center gap-4">
        <Bouton type="submit" taille="grand" disabled={enCours}>
          {enCours ? t("enCours") : t("publier")}
        </Bouton>

        <p aria-live="polite" className="text-[0.9375rem]">
          {etat.statut === "erreur" ? (
            <span className="text-danger">
              {t("erreur", { champ: etat.message })}
            </span>
          ) : null}
          {etat.statut === "publiee" ? (
            <span className="text-succes">
              {t("publiee")}{" "}
              <Link
                href={{
                  pathname: "/remorque/[ville]/[slug]",
                  params: { ville: etat.villeSlug, slug: etat.slug },
                }}
                className="font-medium underline underline-offset-4"
              >
                {t("voirEnLigne")}
              </Link>
            </span>
          ) : null}
        </p>
      </div>
    </form>
  );
}
