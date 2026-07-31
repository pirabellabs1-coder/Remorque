import { useFormatter, useTranslations } from "next-intl";

import { Illustration } from "@/components/ui/illustration";
import { Link } from "@/i18n/navigation";
import { PRIX_AFFICHE } from "@/lib/cn";
import type { AnnonceResume } from "@/server/annonces/catalogue";

/**
 * Carte d'annonce dans les résultats.
 *
 * Densité d'information, pas de prose : photo, prix, poids utile, distance,
 * note. Le visiteur compare une dizaine de cartes en quelques secondes — tout
 * ce qui n'est pas comparable d'un coup d'œil n'a rien à y faire.
 */
export function CarteAnnonce({ annonce }: { annonce: AnnonceResume }) {
  const t = useTranslations("annonce");
  const format = useFormatter();

  const prix = format.number(annonce.prixJour / 100, {
    ...PRIX_AFFICHE,
    currency: annonce.devise,
  });

  return (
    <article className="group relative h-full overflow-hidden rounded-carte border border-bordure bg-fond-eleve shadow-(--ombre-carte) transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-(--ombre-carte-active)">
      <Illustration
        src={annonce.photo}
        alt={annonce.photoAlt}
        className="aspect-4/3 w-full"
        tailles="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"
      />

      {annonce.reservationInstantanee ? (
        <p className="absolute top-3 left-3 rounded-full bg-fond-eleve/95 px-2.5 py-1 text-xs font-medium shadow-sm">
          {t("instantanee")}
        </p>
      ) : null}

      {/* Plus resserré sur mobile : à deux colonnes, chaque carte fait
          moins de 180 px de large. */}
      <div className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[0.9375rem] leading-snug font-medium sm:text-base">
            {/* Lien étendu : toute la carte est cliquable, sans imbriquer de
                lien dans un lien. */}
            <Link
              href={{
                pathname: "/remorque/[ville]/[slug]",
                params: { ville: annonce.villeSlug, slug: annonce.slug },
              }}
              className="after:absolute after:inset-0"
            >
              {annonce.titre}
            </Link>
          </h3>
          {annonce.note !== null ? (
            <p className="shrink-0 text-sm">
              <span aria-hidden>★ </span>
              <span className="font-medium">
                {format.number(annonce.note, { maximumFractionDigits: 1 })}
              </span>
              <span className="text-texte-attenue">
                {" "}
                ({annonce.nombreAvis})
              </span>
              <span className="sr-only">
                {t("noteSur", { note: annonce.note, avis: annonce.nombreAvis })}
              </span>
            </p>
          ) : null}
        </div>

        <p className="mt-1 text-sm text-texte-attenue">
          {annonce.ville} ·{" "}
          {t("distance", { km: Math.round(annonce.distanceM / 100) / 10 })}
        </p>

        {/* Les valeurs portent leur propre libellé (« 500 kg utiles »,
            « PTAC 750 kg ») : ajouter un `dt` masqué le ferait annoncer deux
            fois par un lecteur d'écran. */}
        <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-texte-attenue">
          <div>
            <dt className="sr-only">{t("chargeUtile")}</dt>
            <dd>{t("chargeUtileValeur", { kg: annonce.chargeUtileKg })}</dd>
          </div>
          <div>
            <dt className="sr-only">{t("ptac")}</dt>
            <dd aria-hidden>{t("ptacValeur", { kg: annonce.ptacKg })}</dd>
            <dd className="sr-only">{t("kg", { kg: annonce.ptacKg })}</dd>
          </div>
          {annonce.freinee ? (
            <div>
              <dt className="sr-only">{t("freinage")}</dt>
              <dd>{t("freinee")}</dd>
            </div>
          ) : null}
        </dl>

        {/* Le prix est l'information qui décide : elle porte l'accent. */}
        <p className="mt-3 text-[1.0625rem] font-bold tabular-nums text-accent">
          {prix}
          <span className="font-normal text-texte-attenue"> {t("parJour")}</span>
        </p>
      </div>
    </article>
  );
}
