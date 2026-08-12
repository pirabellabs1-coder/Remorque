import { getFormatter, getTranslations } from "next-intl/server";

import { Illustration } from "@/components/ui/illustration";
import { marchePourPays } from "@/config/markets";
import { NOMBRE_ETAPES } from "@/domain/annonce/publication";
import { referenceAnnonce } from "@/domain/annonce/reference";
import { Link } from "@/i18n/navigation";
import { PRIX_AFFICHE } from "@/lib/cn";

/**
 * Cartes du parc d'un propriétaire — annonce publiée et brouillon.
 *
 * **Verticales, et c'est tout le correctif.** Elles étaient horizontales :
 * vignette à gauche, texte au milieu, deux boutons à droite, le tout dans une
 * grille à trois colonnes. Chaque carte tombait alors sous les trois cents
 * pixels ; les boutons gardaient leur largeur — ils portaient `shrink-0` — et
 * la colonne de texte se réduisait à rien. « 750 kg » se repliait sur trois
 * lignes, le titre passait sous les boutons. La faute n'était pas dans un
 * réglage à corriger, elle était dans l'orientation : une rangée ne rentre pas
 * dans un tiers de largeur.
 *
 * La forme retenue est celle de la carte publique — photo en seizième-neuvième,
 * puis le texte, puis les actions en pied. Elle a l'avantage d'être déjà
 * éprouvée, et celui de montrer au propriétaire ce que voit son locataire.
 */

type AnnoncePubliee = {
  id: string;
  titre: string;
  ville: string;
  villeSlug: string;
  slug: string;
  pays: string;
  photo: string | null;
  ptacKg: number | null;
  prixJour: number | null;
  devise: string;
};

export async function CarteParc({ annonce }: { annonce: AnnoncePubliee }) {
  const t = await getTranslations("espaces.loueur.annonces");
  const format = await getFormatter();

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-carte border border-bordure-carte bg-fond-eleve shadow-(--ombre-carte) transition-[border-color,box-shadow] duration-200 hover:border-accent hover:shadow-(--ombre-carte-active)">
      <div className="relative">
        <Illustration
          src={annonce.photo ?? undefined}
          alt=""
          className="aspect-16/9 w-full"
          tailles="(min-width: 1280px) 22rem, (min-width: 640px) 45vw, 100vw"
        />
        {/* La référence sur la photo plutôt que dans le texte : c'est elle
            qu'on cherche quand on appelle l'assistance, et elle se lit alors
            sans parcourir la fiche. */}
        <p className="absolute right-2 bottom-2 rounded-full bg-black/55 px-2.5 py-1 font-mono text-xs tracking-tight text-white tabular-nums backdrop-blur-sm">
          {referenceAnnonce(annonce.id)}
        </p>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-semibold text-balance">{annonce.titre}</h3>
        <p className="mt-1 text-sm text-texte-attenue">
          {annonce.ville}
          {annonce.ptacKg ? ` · ${annonce.ptacKg} kg` : ""}
        </p>

        {annonce.prixJour !== null ? (
          <p className="mt-3 text-[1.0625rem] font-bold text-accent tabular-nums">
            {format.number(annonce.prixJour / 100, {
              ...PRIX_AFFICHE,
              currency: annonce.devise,
            })}
            <span className="ml-1 text-sm font-normal text-texte-attenue">
              {t("parJour")}
            </span>
          </p>
        ) : null}

        {/* `mt-auto` colle les actions en bas : sans lui, une carte au titre
            court remonterait ses boutons et la rangée perdrait son alignement. */}
        <div className="mt-auto flex gap-2 pt-4">
          {/* Corriger passe par les mêmes six écrans, à l'étape du matériel :
              la catégorie, elle, est figée une fois l'annonce en ligne. */}
          <Link
            href={{
              pathname: "/proprietaire/annonces/publier",
              query: { annonce: annonce.id, etape: "2" },
            }}
            className="flex-1 rounded-champ border border-bordure px-3 py-2 text-center text-sm font-medium transition-colors hover:border-accent hover:text-accent"
          >
            {t("modifier")}
          </Link>

          <Link
            href={{
              pathname: "/remorque/[ville]/[slug]",
              params: { ville: annonce.villeSlug, slug: annonce.slug },
            }}
            // Une annonce se consulte sur le marché de son pays. Sans cela, le
            // lien vers une remorque belge, suivi depuis le site français, mène
            // à une page introuvable — le catalogue étant cloisonné par pays.
            locale={marchePourPays(annonce.pays)}
            className="flex-1 rounded-champ border border-bordure px-3 py-2 text-center text-sm font-medium transition-colors hover:border-accent hover:text-accent"
          >
            {t("voir")}
          </Link>
        </div>
      </div>
    </article>
  );
}

type Brouillon = {
  id: string;
  titre: string | null;
  ville: string | null;
  etapeAtteinte: number;
};

/**
 * Carte d'un brouillon.
 *
 * **Une jauge plutôt qu'une phrase.** « Étape 3 sur 6 » se lit ; une barre aux
 * trois cinquièmes se voit. Sur une liste de brouillons, la question est
 * toujours la même — lequel est presque fini ? — et la réponse doit se prendre
 * d'un regard, sans lire.
 */
export async function CarteBrouillon({ brouillon }: { brouillon: Brouillon }) {
  const t = await getTranslations("espaces.loueur.annonces");

  const rang = Math.min(Math.max(brouillon.etapeAtteinte, 1), NOMBRE_ETAPES);
  const part = Math.round((rang / NOMBRE_ETAPES) * 100);

  return (
    <article className="flex h-full flex-col rounded-carte border border-dashed border-bordure-carte bg-fond-eleve p-4">
      <h3 className="font-semibold text-balance">
        {brouillon.titre || t("brouillonSansTitre")}
      </h3>
      {brouillon.ville ? (
        <p className="mt-1 text-sm text-texte-attenue">{brouillon.ville}</p>
      ) : null}

      <div className="mt-4">
        <div
          className="h-1.5 overflow-hidden rounded-full bg-fond-doux"
          role="progressbar"
          aria-valuenow={rang}
          aria-valuemin={1}
          aria-valuemax={NOMBRE_ETAPES}
          aria-label={t("brouillonRang", { rang, total: NOMBRE_ETAPES })}
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500"
            style={{ width: `${part}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-texte-attenue">
          {t("brouillonRang", { rang, total: NOMBRE_ETAPES })}
        </p>
      </div>

      <div className="mt-auto pt-4">
        <Link
          href={{
            pathname: "/proprietaire/annonces/publier",
            query: { annonce: brouillon.id, etape: String(rang) },
          }}
          className="block rounded-champ border border-bordure px-3 py-2 text-center text-sm font-medium transition-colors hover:border-accent hover:text-accent"
        >
          {t("reprendre")}
        </Link>
      </div>
    </article>
  );
}
