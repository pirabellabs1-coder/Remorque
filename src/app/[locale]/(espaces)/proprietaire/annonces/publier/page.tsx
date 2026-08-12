import { getTranslations, setRequestLocale } from "next-intl/server";

import { DepotPhotos } from "@/components/espace/publication/depot-photos";
import { ChampPosition } from "@/components/espace/publication/champ-position";
import { FilEtapes } from "@/components/espace/publication/fil-etapes";
import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { Bouton } from "@/components/ui/bouton";
import { Champ } from "@/components/ui/champ";
import { Illustration } from "@/components/ui/illustration";
import { CATEGORIES } from "@/config/categories";
import { clientEnv } from "@/config/env-client";
import { getMarket, type Market } from "@/config/markets";
import { villesDuPays, type CodePays } from "@/config/villes";
import {
  PHOTOS_MAXIMUM,
  PHOTOS_MINIMUM,
  etapeAffichable,
  etapePrecedente,
  rangDe,
  type Etape,
} from "@/domain/annonce/publication";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { exigerProfil } from "@/server/authentification/garde";
import {
  choisirCategorie,
  deplacerPhotoAction,
  enregistrerEtapeCaracteristiques,
  enregistrerEtapeMateriel,
  enregistrerEtapeRetrait,
  enregistrerEtapeTarifs,
  supprimerPhoto,
  validerEtapePhotos,
} from "@/server/annonces/publication-actions";
import { chargerBrouillon, type Brouillon } from "@/server/annonces/publication";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata = { robots: { index: false, follow: false } };

/** Un brouillon change à chaque étape : rien à mettre en cache ici. */
export const dynamic = "force-dynamic";

const lire = (valeur: string | string[] | undefined) =>
  Array.isArray(valeur) ? valeur[0] : valeur;

const champ =
  "mt-2 h-12 w-full rounded-champ border border-bordure bg-fond-eleve px-4 text-base text-texte transition-colors focus:border-accent";

const zone =
  "mt-2 w-full rounded-champ border border-bordure bg-fond-eleve px-4 py-3 text-base text-texte transition-colors focus:border-accent";

const carte =
  "rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)";

export default async function PagePublier({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const compte = await exigerProfil(
    locale,
    "/proprietaire/annonces/publier",
    "proprietaire",
  );

  const parametres = await searchParams;
  const t = await getTranslations("espaces.loueur.publication");

  const annonceId = lire(parametres.annonce);
  const erreur = lire(parametres.erreur);
  const enregistre = lire(parametres.enregistre) === "oui";

  const brouillon = annonceId
    ? await chargerBrouillon(annonceId, compte.id)
    : null;

  const categorieChoisie =
    brouillon?.categorieSlug ?? lire(parametres.categorie) ?? "";

  // Quelle étape peut être dessinée, compte tenu de ce qu'on a sous la main.
  // La règle vit dans le domaine, où elle est vérifiée sans base ni réseau —
  // c'est elle qui décide, et non une condition écrite ici au fil de l'eau.
  const etape: Etape = etapeAffichable({
    rangDemande: Number(lire(parametres.etape) ?? "1"),
    aBrouillon: brouillon !== null,
    aCategorie: categorieChoisie !== "",
  });

  // Corriger une annonce en ligne emprunte les mêmes écrans que la créer :
  // ce qui change, ce sont les mots et la destination du dernier bouton.
  const enEdition = brouillon !== null && brouillon.statut !== "brouillon";

  const precedente = etapePrecedente(etape);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace
        titre={enEdition ? t("edition.titre") : t("titre")}
        sousTitre={enEdition ? t("edition.chapo") : t("chapo")}
      />

      <div className="mt-8">
        <FilEtapes
          courante={etape}
          atteinte={brouillon?.etapeAtteinte ?? 1}
          annonceId={brouillon?.id}
          enEdition={enEdition}
        />
      </div>

      {erreur ? (
        <p
          role="alert"
          className="mt-6 rounded-carte border border-danger/40 bg-danger/5 px-4 py-3 text-[0.9375rem] text-danger"
        >
          {t("erreur", { champ: erreur })}
        </p>
      ) : null}

      {enregistre ? (
        <p
          role="status"
          className="mt-6 rounded-carte border border-succes/40 bg-succes/5 px-4 py-3 text-[0.9375rem] text-succes"
        >
          {t("enregistre")}
        </p>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        {/* `key` porte l'étape : React remplace le nœud à chaque passage, ce
            qui relance l'animation. Sans elle, il réutiliserait le même
            élément, l'animation ne serait jouée qu'une fois et les cinq
            écrans suivants apparaîtraient sèchement. */}
        <div key={etape} className="animate-etape">
          {etape === "categorie" ? (
            <EtapeCategorie locale={locale} choisie={categorieChoisie} />
          ) : null}

          {etape === "materiel" ? (
            <EtapeMateriel
              locale={locale}
              categorie={categorieChoisie}
              brouillon={brouillon}
              enEdition={enEdition}
            />
          ) : null}

          {etape === "caracteristiques" && brouillon ? (
            <EtapeCaracteristiques
              locale={locale}
              brouillon={brouillon}
              enEdition={enEdition}
            />
          ) : null}

          {etape === "photos" && brouillon ? (
            <EtapePhotos locale={locale} brouillon={brouillon} />
          ) : null}

          {etape === "retrait" && brouillon ? (
            <EtapeRetrait
              locale={locale}
              brouillon={brouillon}
              enEdition={enEdition}
            />
          ) : null}

          {etape === "tarifs" && brouillon ? (
            <EtapeTarifs
              locale={locale}
              brouillon={brouillon}
              enEdition={enEdition}
            />
          ) : null}

          {precedente ? (
            <p className="mt-6">
              <Link
                href={{
                  pathname: "/proprietaire/annonces/publier",
                  query: {
                    etape: String(rangDe(precedente)),
                    // À l'étape 2, le brouillon n'existe pas encore : c'est la
                    // catégorie qui doit repartir dans l'adresse, sans quoi le
                    // retour perdrait le choix déjà fait.
                    ...(brouillon
                      ? { annonce: brouillon.id }
                      : { categorie: categorieChoisie }),
                  },
                }}
                className="text-[0.9375rem] text-texte-attenue underline underline-offset-4 hover:text-texte"
              >
                {t("retour", { etape: t(`etapes.${precedente}`) })}
              </Link>
            </p>
          ) : null}
        </div>

        <AsideConseils etape={etape} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Étape 1 — la catégorie                                                     */
/* -------------------------------------------------------------------------- */

async function EtapeCategorie({
  locale,
  choisie,
}: {
  locale: string;
  choisie: string;
}) {
  const t = await getTranslations("espaces.loueur.publication");

  return (
    <form action={choisirCategorie}>
      <input type="hidden" name="locale" value={locale} />

      <h2 className="text-[1.0625rem] font-semibold">{t("categorie.titre")}</h2>
      <p className="mt-2 max-w-2xl text-[0.9375rem] text-texte-attenue">
        {t("categorie.chapo")}
      </p>

      {/* Une grille d'images plutôt qu'une liste déroulante : « nacelle et
          matériel de chantier » ne dit rien tant qu'on ne l'a pas vue, et
          c'est le choix qui détermine tout le reste du formulaire. */}
      <fieldset className="mt-6">
        <legend className="sr-only">{t("categorie.titre")}</legend>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {CATEGORIES.map((entree) => (
            <label
              key={entree.slug}
              className={cn(
                "group relative cursor-pointer overflow-hidden rounded-carte border bg-fond-eleve transition-colors",
                "border-bordure hover:border-accent",
                "has-checked:border-accent has-checked:ring-2 has-checked:ring-accent/30",
              )}
            >
              <input
                type="radio"
                name="categorie"
                value={entree.slug}
                defaultChecked={entree.slug === choisie}
                required
                className="sr-only"
              />
              <Illustration
                src={entree.photo}
                alt=""
                className="aspect-[4/3] w-full"
                tailles="(min-width: 1280px) 20vw, (min-width: 640px) 30vw, 45vw"
              />
              <span className="block px-3 py-2.5">
                <span className="block text-[0.9375rem] font-medium">
                  {entree.nom}
                </span>
                <span className="mt-0.5 block text-xs text-texte-attenue">
                  {entree.usages}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-8">
        <Bouton type="submit" taille="grand">
          {t("continuer")}
        </Bouton>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*  Étape 2 — le matériel                                                      */
/* -------------------------------------------------------------------------- */

async function EtapeMateriel({
  locale,
  categorie,
  brouillon,
  enEdition,
}: {
  locale: string;
  categorie: string;
  brouillon: Brouillon | null;
  enEdition: boolean;
}) {
  const t = await getTranslations("espaces.loueur.publication");

  return (
    <form action={enregistrerEtapeMateriel} className={carte}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="categorie" value={categorie} />
      {brouillon ? (
        <input type="hidden" name="annonce" value={brouillon.id} />
      ) : null}

      <h2 className="text-[1.0625rem] font-semibold">{t("materiel.titre")}</h2>
      <p className="mt-2 text-[0.9375rem] text-texte-attenue">
        {t("materiel.chapo")}
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Champ
          libelle={t("titreChamp")}
          name="titre"
          required
          minLength={5}
          maxLength={80}
          defaultValue={brouillon?.valeurs.titre}
          placeholder={t("titrePlaceholder")}
          className="sm:col-span-2"
        />

        <div className="sm:col-span-2">
          <label htmlFor="ville-annonce" className="text-sm font-medium">
            {t("ville")}
          </label>
          {/* Les villes du marché courant, sans choix de pays. Proposer
              l'Europe entière laissait publier depuis le site français une
              remorque garée à Charleroi : elle partait alors sur le marché
              belge, où son propriétaire ne la retrouvait plus. Le pays n'est
              pas une question posée au loueur, c'est une conséquence de
              l'endroit d'où il publie. */}
          <select
            id="ville-annonce"
            name="villeSlug"
            required
            defaultValue={brouillon?.villeSlug}
            className={champ}
          >
            {villesDuPays(getMarket(locale as Market).country as CodePays).map(
              (ville) => (
                <option key={ville.slug} value={ville.slug}>
                  {ville.nom} ({ville.province})
                </option>
              ),
            )}
          </select>
          <p className="mt-2 text-sm text-texte-attenue">{t("villeAide")}</p>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="description-annonce" className="text-sm font-medium">
            {t("description")}
          </label>
          <textarea
            id="description-annonce"
            name="description"
            required
            minLength={20}
            maxLength={2000}
            rows={5}
            defaultValue={brouillon?.valeurs.description}
            placeholder={t("descriptionPlaceholder")}
            className={zone}
          />
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Bouton type="submit" taille="grand">
          {t("continuer")}
        </Bouton>
        {/* Même formulaire, même enregistrement : seule la destination change.
            Sans ce bouton, s'arrêter en cours de route demandait de deviner
            qu'on pouvait fermer l'onglet sans rien perdre. */}
        <Bouton
          type="submit"
          name="finir"
          value="oui"
          variante="secondaire"
          taille="grand"
        >
          {t(enEdition ? "edition.terminer" : "enregistrerBrouillon")}
        </Bouton>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*  Étape 3 — les caractéristiques                                             */
/* -------------------------------------------------------------------------- */

async function EtapeCaracteristiques({
  locale,
  brouillon,
  enEdition,
}: {
  locale: string;
  brouillon: Brouillon;
  enEdition: boolean;
}) {
  const t = await getTranslations("espaces.loueur.publication");
  const valeurs = brouillon.valeurs;

  return (
    <form action={enregistrerEtapeCaracteristiques} className={carte}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="annonce" value={brouillon.id} />

      <h2 className="text-[1.0625rem] font-semibold">
        {t("caracteristiques.titre")}
      </h2>
      <p className="mt-2 text-[0.9375rem] text-texte-attenue">
        {t("caracteristiques.chapo")}
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Champ
          libelle={t("ptac")}
          name="ptacKg"
          type="number"
          inputMode="numeric"
          required
          min={100}
          max={3500}
          defaultValue={valeurs.ptacKg ?? 750}
        />
        <Champ
          libelle={t("poidsVide")}
          name="poidsVideKg"
          type="number"
          inputMode="numeric"
          required
          min={20}
          max={3400}
          defaultValue={valeurs.poidsVideKg ?? 250}
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
          defaultValue={valeurs.longueurUtileMm ?? 2000}
        />
        <Champ
          libelle={t("largeur")}
          name="largeurUtileMm"
          type="number"
          inputMode="numeric"
          required
          min={500}
          max={3000}
          defaultValue={valeurs.largeurUtileMm ?? 1300}
        />
        <Champ
          libelle={t("hauteur")}
          name="hauteurUtileMm"
          type="number"
          inputMode="numeric"
          min={100}
          max={3000}
          defaultValue={valeurs.hauteurUtileMm ?? undefined}
          aide={t("hauteurAide")}
        />
        <Champ
          libelle={t("essieux")}
          name="nombreEssieux"
          type="number"
          inputMode="numeric"
          required
          min={1}
          max={3}
          defaultValue={valeurs.nombreEssieux ?? 1}
        />
        <Champ
          libelle={t("attelage")}
          name="typeAttelage"
          required
          defaultValue={valeurs.typeAttelage ?? "Boule Ø 50 mm"}
        />

        <div>
          <label htmlFor="faisceau-annonce" className="text-sm font-medium">
            {t("faisceau")}
          </label>
          <select
            id="faisceau-annonce"
            name="faisceauBroches"
            defaultValue={String(valeurs.faisceauBroches ?? 13)}
            className={champ}
          >
            <option value="7">{t("faisceau7")}</option>
            <option value="13">{t("faisceau13")}</option>
          </select>
        </div>
      </div>

      <Champ
        libelle={t("equipements")}
        name="equipements"
        defaultValue={valeurs.equipements.join(", ")}
        placeholder={t("equipementsPlaceholder")}
        aide={t("equipementsAide")}
        className="mt-5"
      />

      <div className="mt-5 space-y-3">
        <label className="flex items-center gap-3 text-[0.9375rem]">
          <input
            type="checkbox"
            name="freinee"
            defaultChecked={valeurs.freinee}
            className="size-4 accent-[var(--accent)]"
          />
          {t("freinee")}
        </label>

        <label className="flex items-center gap-3 text-[0.9375rem]">
          <input
            type="checkbox"
            name="adaptateurFourni"
            defaultChecked={valeurs.adaptateurFourni}
            className="size-4 accent-[var(--accent)]"
          />
          {t("adaptateur")}
        </label>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Bouton type="submit" taille="grand">
          {t("continuer")}
        </Bouton>
        {/* Même formulaire, même enregistrement : seule la destination change.
            Sans ce bouton, s'arrêter en cours de route demandait de deviner
            qu'on pouvait fermer l'onglet sans rien perdre. */}
        <Bouton
          type="submit"
          name="finir"
          value="oui"
          variante="secondaire"
          taille="grand"
        >
          {t(enEdition ? "edition.terminer" : "enregistrerBrouillon")}
        </Bouton>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*  Étape 4 — les photos                                                       */
/* -------------------------------------------------------------------------- */

async function EtapePhotos({
  locale,
  brouillon,
}: {
  locale: string;
  brouillon: Brouillon;
}) {
  const t = await getTranslations("espaces.loueur.publication");
  const photos = brouillon.photos;
  const assez = photos.length >= PHOTOS_MINIMUM;

  return (
    <div className={carte}>
      <h2 className="text-[1.0625rem] font-semibold">{t("photos.titre")}</h2>
      <p className="mt-2 text-[0.9375rem] text-texte-attenue">
        {t("photos.chapo", { minimum: PHOTOS_MINIMUM })}
      </p>

      {photos.length > 0 ? (
            <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {photos.map((photo, rang) => (
                <li
                  key={photo.id}
                  className="overflow-hidden rounded-carte border border-bordure bg-fond"
                >
                  <div className="relative">
                    <Illustration
                      src={photo.url}
                      alt=""
                      className="aspect-[4/3] w-full"
                      tailles="(min-width: 1280px) 18vw, (min-width: 640px) 30vw, 45vw"
                    />
                    {rang === 0 ? (
                      <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-contraste">
                        {t("photos.couverture")}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between gap-1 px-2 py-2">
                    <div className="flex gap-1">
                      <BoutonPhoto
                        action={deplacerPhotoAction}
                        locale={locale}
                        annonceId={brouillon.id}
                        photoId={photo.id}
                        sens="avant"
                        libelle={t("photos.monter")}
                        desactive={rang === 0}
                      >
                        ↑
                      </BoutonPhoto>
                      <BoutonPhoto
                        action={deplacerPhotoAction}
                        locale={locale}
                        annonceId={brouillon.id}
                        photoId={photo.id}
                        sens="apres"
                        libelle={t("photos.descendre")}
                        desactive={rang === photos.length - 1}
                      >
                        ↓
                      </BoutonPhoto>
                    </div>

                    <BoutonPhoto
                      action={supprimerPhoto}
                      locale={locale}
                      annonceId={brouillon.id}
                      photoId={photo.id}
                      libelle={t("photos.supprimer")}
                      danger
                    >
                      ✕
                    </BoutonPhoto>
                  </div>
                </li>
              ))}
            </ul>
      ) : null}

      <div className="mt-6">
        <DepotPhotos
          annonceId={brouillon.id}
          locale={locale}
          restantes={PHOTOS_MAXIMUM - photos.length}
        />
      </div>

      <form action={validerEtapePhotos} className="mt-8">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="annonce" value={brouillon.id} />
        <Bouton type="submit" taille="grand" disabled={!assez}>
          {t("continuer")}
        </Bouton>
        {!assez ? (
          <p className="mt-3 text-sm text-texte-attenue">
            {t("photos.encore", { nombre: PHOTOS_MINIMUM - photos.length })}
          </p>
        ) : null}
      </form>
    </div>
  );
}

/** Petit bouton d'action sur une photo, dans son propre formulaire. */
function BoutonPhoto({
  action,
  locale,
  annonceId,
  photoId,
  sens,
  libelle,
  desactive = false,
  danger = false,
  children,
}: {
  action: (donnees: FormData) => Promise<void>;
  locale: string;
  annonceId: string;
  photoId: string;
  sens?: "avant" | "apres";
  libelle: string;
  desactive?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="annonce" value={annonceId} />
      <input type="hidden" name="photo" value={photoId} />
      {sens ? <input type="hidden" name="sens" value={sens} /> : null}
      <button
        type="submit"
        disabled={desactive}
        aria-label={libelle}
        title={libelle}
        className={cn(
          "grid size-9 place-items-center rounded-champ border border-bordure text-sm transition-colors",
          desactive
            ? "text-texte-attenue/40"
            : danger
              ? "hover:border-danger hover:text-danger"
              : "hover:border-accent hover:text-accent",
        )}
      >
        {children}
      </button>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*  Étape 5 — le retrait                                                       */
/* -------------------------------------------------------------------------- */

async function EtapeRetrait({
  locale,
  brouillon,
  enEdition,
}: {
  locale: string;
  brouillon: Brouillon;
  enEdition: boolean;
}) {
  const t = await getTranslations("espaces.loueur.publication");
  const valeurs = brouillon.valeurs;

  return (
    <form action={enregistrerEtapeRetrait} className={carte}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="annonce" value={brouillon.id} />

      <h2 className="text-[1.0625rem] font-semibold">{t("retrait.titre")}</h2>
      <p className="mt-2 text-[0.9375rem] text-texte-attenue">
        {t("retrait.chapo")}
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Champ
          libelle={t("adresse")}
          name="adresseLigne1"
          required
          minLength={4}
          maxLength={120}
          defaultValue={valeurs.adresseLigne1 ?? ""}
          placeholder={t("adressePlaceholder")}
          className="sm:col-span-2"
          aide={t("adresseAide")}
        />

        <Champ
          libelle={t("codePostal")}
          name="codePostal"
          required
          minLength={4}
          maxLength={10}
          inputMode="numeric"
          defaultValue={valeurs.codePostal ?? ""}
        />

        <div>
          <label htmlFor="rayon-annonce" className="text-sm font-medium">
            {t("rayon")}
          </label>
          <select
            id="rayon-annonce"
            name="rayonApproximatifM"
            defaultValue={String(valeurs.rayonApproximatifM)}
            className={champ}
          >
            <option value="300">{t("rayon300")}</option>
            <option value="800">{t("rayon800")}</option>
            <option value="1500">{t("rayon1500")}</option>
            <option value="3000">{t("rayon3000")}</option>
          </select>
          <p className="mt-2 text-sm text-texte-attenue">{t("rayonAide")}</p>
        </div>

        {/* L'épingle vient après l'adresse : on la pose d'après ce qui vient
            d'être saisi, et on l'ajuste si le géocodage tombe à côté. */}
        <ChampPosition
          longitude={brouillon.position.longitude}
          latitude={brouillon.position.latitude}
          styleUrl={clientEnv.NEXT_PUBLIC_MAP_STYLE_URL}
        />

        <div className="sm:col-span-2">
          <label htmlFor="regles-annonce" className="text-sm font-medium">
            {t("regles")}
          </label>
          <textarea
            id="regles-annonce"
            name="reglesUtilisation"
            rows={4}
            maxLength={1000}
            defaultValue={valeurs.reglesUtilisation ?? ""}
            placeholder={t("reglesPlaceholder")}
            className={zone}
          />
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Bouton type="submit" taille="grand">
          {t("continuer")}
        </Bouton>
        {/* Même formulaire, même enregistrement : seule la destination change.
            Sans ce bouton, s'arrêter en cours de route demandait de deviner
            qu'on pouvait fermer l'onglet sans rien perdre. */}
        <Bouton
          type="submit"
          name="finir"
          value="oui"
          variante="secondaire"
          taille="grand"
        >
          {t(enEdition ? "edition.terminer" : "enregistrerBrouillon")}
        </Bouton>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*  Étape 6 — tarifs, conditions et publication                                */
/* -------------------------------------------------------------------------- */

async function EtapeTarifs({
  locale,
  brouillon,
  enEdition,
}: {
  locale: string;
  brouillon: Brouillon;
  enEdition: boolean;
}) {
  const t = await getTranslations("espaces.loueur.publication");
  const valeurs = brouillon.valeurs;

  return (
    <form action={enregistrerEtapeTarifs} className={carte}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="annonce" value={brouillon.id} />

      <h2 className="text-[1.0625rem] font-semibold">{t("tarifs.titre")}</h2>
      <p className="mt-2 text-[0.9375rem] text-texte-attenue">
        {t("tarifs.chapo")}
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <Champ
          libelle={t("prix")}
          name="prixJourEuros"
          type="number"
          inputMode="decimal"
          required
          min={1}
          max={2000}
          step={1}
          defaultValue={
            valeurs.prixJour !== null ? valeurs.prixJour / 100 : 35
          }
        />
        <Champ
          libelle={t("caution")}
          name="cautionEuros"
          type="number"
          inputMode="decimal"
          required
          min={brouillon.bornesCaution.minimum / 100}
          max={brouillon.bornesCaution.maximum / 100}
          step={10}
          defaultValue={valeurs.caution / 100}
          // Les bornes viennent de la table `pays` : elles ne sont écrites ni
          // ici ni dans le schéma de validation (règle 2).
          aide={t("cautionBornes", {
            minimum: brouillon.bornesCaution.minimum / 100,
            maximum: brouillon.bornesCaution.maximum / 100,
          })}
        />

        <div>
          <label htmlFor="annulation-annonce" className="text-sm font-medium">
            {t("annulation")}
          </label>
          <select
            id="annulation-annonce"
            name="politiqueAnnulation"
            defaultValue={valeurs.politiqueAnnulation}
            className={champ}
          >
            <option value="souple">{t("annulationSouple")}</option>
            <option value="moderee">{t("annulationModeree")}</option>
            <option value="stricte">{t("annulationStricte")}</option>
          </select>
        </div>

        <Champ
          libelle={t("dureeMinimum")}
          name="dureeMinimumJours"
          type="number"
          inputMode="numeric"
          required
          min={1}
          max={30}
          defaultValue={valeurs.dureeMinimumJours}
        />
        <Champ
          libelle={t("dureeMaximum")}
          name="dureeMaximumJours"
          type="number"
          inputMode="numeric"
          required
          min={1}
          max={90}
          defaultValue={valeurs.dureeMaximumJours}
        />
        <Champ
          libelle={t("preparation")}
          name="delaiPreparationHeures"
          type="number"
          inputMode="numeric"
          required
          min={0}
          max={72}
          defaultValue={valeurs.delaiPreparationHeures}
          aide={t("preparationAide")}
        />
      </div>

      <label className="mt-5 flex items-start gap-3 text-[0.9375rem]">
        <input
          type="checkbox"
          name="reservationInstantanee"
          defaultChecked={valeurs.reservationInstantanee}
          className="mt-1 size-4 accent-[var(--accent)]"
        />
        <span>
          {t("instantanee")}
          <span className="mt-0.5 block text-sm text-texte-attenue">
            {t("instantaneeAide")}
          </span>
        </span>
      </label>

      <div className="mt-8 flex flex-wrap gap-3">
        {/* Une annonce déjà en ligne n'a rien à publier : elle l'est. Le même
            formulaire enregistre alors la correction et ramène devant la
            fiche publique. */}
        <Bouton type="submit" name="publier" value="oui" taille="grand">
          {t(enEdition ? "edition.enregistrer" : "publier")}
        </Bouton>
        {enEdition ? null : (
          <Bouton
            type="submit"
            name="publier"
            value="non"
            variante="secondaire"
            taille="grand"
          >
            {t("enregistrerBrouillon")}
          </Bouton>
        )}
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*  Colonne de conseils                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Ce qui se joue à l'étape en cours.
 *
 * Elle occupe la colonne restée vide sur grand écran et sert à quelque chose :
 * chaque étape a une décision qui se paie plus tard — une caution trop basse,
 * une photo de trois-quarts absente, un délai de préparation à zéro.
 */
async function AsideConseils({ etape }: { etape: Etape }) {
  const t = await getTranslations("espaces.loueur.publication");

  return (
    <aside className="rounded-carte border border-bordure bg-fond-doux p-5 lg:sticky lg:top-24">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-texte-attenue">
        {t("conseils")}
      </h2>
      <p className="mt-3 text-[0.9375rem] leading-relaxed">
        {t(`conseil.${etape}`)}
      </p>
    </aside>
  );
}
