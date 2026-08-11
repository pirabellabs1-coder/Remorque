import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { eq } from "drizzle-orm";

import { FormulaireDemande } from "@/components/annonce/formulaire-demande";
import { Illustration } from "@/components/ui/illustration";
import { BAREME_PAR_DEFAUT } from "@/config/baremes";
import type { Market } from "@/config/markets";
import { calculerDevis } from "@/domain/tarification/devis";
import { Link, redirect } from "@/i18n/navigation";
import { PRIX_AFFICHE } from "@/lib/cn";
import { trouverAnnonce } from "@/server/annonces/catalogue";
import { compteConnecte } from "@/server/authentification/session";
import { db } from "@/server/db";
import { utilisateur } from "@/server/db/schema";

type Props = {
  params: Promise<{ locale: string; ville: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Une demande en cours de rédaction n'a rien à faire dans un index. */
export const metadata = { robots: { index: false, follow: false } };

export const dynamic = "force-dynamic";

const lire = (valeur: string | string[] | undefined) =>
  Array.isArray(valeur) ? valeur[0] : valeur;

/** Nombre de jours facturés, bornes incluses côté départ. */
function joursEntre(debut: Date, fin: Date): number {
  const ms = fin.getTime() - debut.getTime();
  if (Number.isNaN(ms) || ms < 0) return 0;
  return Math.max(1, Math.round(ms / 86_400_000));
}

/**
 * Récapitulatif et demande de location.
 *
 * Cet écran sépare deux gestes que la fiche confondait : choisir des dates, et
 * s'engager. Sur la fiche, le bouton créait la demande immédiatement — sans que
 * personne ait dit qui il était, ni où il habitait. Or le contrat de location,
 * la facture et l'attestation d'assurance nomment un preneur et le situent.
 *
 * L'écran est en rendu dynamique et hors index : il dépend de la session et de
 * dates qui n'ont de sens que pour la personne qui vient de les choisir.
 */
export default async function PageReserver({ params, searchParams }: Props) {
  const { locale, ville, slug } = await params;
  setRequestLocale(locale);

  const annonce = await trouverAnnonce(ville, slug);
  if (!annonce) notFound();

  const parametres = await searchParams;
  const debutBrut = lire(parametres.debut) ?? "";
  const finBrut = lire(parametres.fin) ?? "";

  const debut = new Date(debutBrut);
  const fin = new Date(finBrut);
  const jours = joursEntre(debut, fin);

  // Sans dates exploitables, il n'y a rien à récapituler : on renvoie choisir
  // sur la fiche plutôt que d'afficher un formulaire qui ne mènerait nulle part.
  if (jours === 0) {
    redirect({
      href: {
        pathname: "/remorque/[ville]/[slug]",
        params: { ville, slug },
      },
      locale: locale as Market,
    });
  }

  const moi = await compteConnecte();

  // La connexion est exigée ici et non sur la fiche : on laisse composer sa
  // demande, on ne la fait pas recommencer après détour par la connexion.
  if (!moi) {
    redirect({
      href: {
        pathname: "/connexion",
        query: {
          suite: `/reserver/${ville}/${slug}?debut=${debutBrut}&fin=${finBrut}`,
        },
      },
      locale: locale as Market,
    });
  }

  const t = await getTranslations("annonce.demande");
  const format = await getFormatter();

  const [profil] = await db
    .select({
      prenom: utilisateur.prenom,
      nom: utilisateur.nom,
      telephone: utilisateur.telephone,
      adresseLigne1: utilisateur.adresseLigne1,
      adresseLigne2: utilisateur.adresseLigne2,
      codePostal: utilisateur.codePostal,
      ville: utilisateur.ville,
    })
    .from(utilisateur)
    .where(eq(utilisateur.id, moi!.id))
    .limit(1);

  const devis = calculerDevis({
    prixJour: annonce.prixJour,
    nombreJours: jours,
    bareme: BAREME_PAR_DEFAUT,
  });

  const montant = (centimes: number) =>
    format.number(centimes / 100, {
      style: "currency",
      currency: annonce.devise,
    });

  const dateLisible = (valeur: Date) =>
    format.dateTime(valeur, {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <p className="text-sm">
        <Link
          href={{
            pathname: "/remorque/[ville]/[slug]",
            params: { ville, slug },
          }}
          className="text-texte-attenue underline underline-offset-4 hover:text-texte"
        >
          {t("retour", { titre: annonce.titre })}
        </Link>
      </p>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
        {t("titre")}
      </h1>
      <p className="mt-2 max-w-2xl text-texte-attenue">{t("chapo")}</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <FormulaireDemande
          annonceId={annonce.id}
          debut={debutBrut}
          fin={finBrut}
          compte={{
            prenom: profil?.prenom ?? "",
            nom: profil?.nom ?? "",
            telephone: profil?.telephone ?? "",
            adresseLigne1: profil?.adresseLigne1 ?? "",
            adresseLigne2: profil?.adresseLigne2 ?? "",
            codePostal: profil?.codePostal ?? "",
            ville: profil?.ville ?? "",
          }}
        />

        {/* Le récapitulatif reste sous les yeux pendant toute la saisie : on
            ne remplit pas dix champs sans savoir ce qu'on engage. */}
        <aside className="rounded-carte border border-bordure bg-fond-eleve p-5 shadow-(--ombre-carte) lg:sticky lg:top-24">
          <div className="flex gap-4">
            <Illustration
              src={annonce.photo}
              alt=""
              className="size-20 shrink-0 rounded-[0.5rem]"
              tailles="80px"
            />
            <div className="min-w-0">
              <p className="font-medium">{annonce.titre}</p>
              <p className="mt-0.5 text-sm text-texte-attenue">
                {annonce.quartier}, {annonce.ville}
              </p>
            </div>
          </div>

          <dl className="mt-5 space-y-2 border-t border-bordure pt-4 text-sm">
            <div>
              <dt className="text-texte-attenue">{t("retrait")}</dt>
              <dd className="mt-0.5 font-medium">{dateLisible(debut)}</dd>
            </div>
            <div>
              <dt className="text-texte-attenue">{t("restitution")}</dt>
              <dd className="mt-0.5 font-medium">{dateLisible(fin)}</dd>
            </div>
          </dl>

          <dl className="mt-5 space-y-2 border-t border-bordure pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-texte-attenue">
                {t("loyer", {
                  jours,
                  prix: format.number(annonce.prixJour / 100, {
                    ...PRIX_AFFICHE,
                    currency: annonce.devise,
                  }),
                })}
              </dt>
              <dd className="tabular-nums">{montant(devis.loyer)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-texte-attenue">{t("fraisService")}</dt>
              <dd className="tabular-nums">{montant(devis.fraisService)}</dd>
            </div>
            <div className="flex justify-between border-t border-bordure pt-2 text-base font-semibold">
              <dt>{t("total")}</dt>
              <dd className="tabular-nums">{montant(devis.totalLocataire)}</dd>
            </div>
          </dl>

          <ul className="mt-4 space-y-1.5 border-t border-bordure pt-4 text-xs text-texte-attenue">
            <li>
              {t("caution", {
                montant: format.number(annonce.caution / 100, {
                  ...PRIX_AFFICHE,
                  currency: annonce.devise,
                }),
              })}
            </li>
            <li>{t("aucunDebit")}</li>
          </ul>
        </aside>
      </div>
    </main>
  );
}
