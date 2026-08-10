import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { Cellule, Pastille, Tableau } from "@/components/espace/tableau";
import { Illustration } from "@/components/ui/illustration";
import { Link } from "@/i18n/navigation";
import { PRIX_AFFICHE } from "@/lib/cn";
import { listerAnnoncesDetaillees } from "@/server/annonces/depot";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PageAnnoncesAdmin({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.admin.annonces");
  const format = await getFormatter();

  const annonces = await listerAnnoncesDetaillees();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace
        titre={t("titre")}
        sousTitre={t("chapo", { nombre: annonces.length })}
      />

      <Tableau
        className="mt-8"
        colonnes={[
          { cle: "materiel", entete: t("materiel") },
          { cle: "proprietaire", entete: t("proprietaire"), secondaire: true },
          { cle: "ville", entete: t("ville"), secondaire: true },
          { cle: "prix", entete: t("prix"), numerique: true },
          { cle: "caution", entete: t("caution"), numerique: true, secondaire: true },
          { cle: "note", entete: t("note") },
          { cle: "action", entete: "" },
        ]}
      >
        {annonces.map((annonce) => (
          <tr key={annonce.id}>
            <th scope="row" className="px-5 py-3 text-left font-normal">
              <span className="flex items-center gap-3">
                <Illustration
                  src={annonce.photo}
                  alt=""
                  className="size-10 shrink-0 rounded-[0.4rem]"
                  tailles="40px"
                />
                <span className="min-w-0">
                  <span className="block truncate">{annonce.titre}</span>
                  <span className="block text-sm text-texte-attenue">
                    {annonce.ptacKg} kg · {annonce.chargeUtileKg} kg utiles
                  </span>
                </span>
              </span>
            </th>
            <Cellule secondaire attenue>
              {annonce.proprietaire?.prenom ?? "—"}
              {annonce.proprietaire?.professionnel ? " · pro" : ""}
            </Cellule>
            <Cellule secondaire>{annonce.ville}</Cellule>
            <Cellule numerique>
              {format.number(annonce.prixJour / 100, {
                ...PRIX_AFFICHE,
                currency: annonce.devise,
              })}
            </Cellule>
            <Cellule numerique secondaire attenue>
              {format.number(annonce.caution / 100, {
                ...PRIX_AFFICHE,
                currency: annonce.devise,
              })}
            </Cellule>
            <Cellule>
              {annonce.note === null ? (
                <Pastille>{t("nonNotee")}</Pastille>
              ) : (
                <span className="tabular-nums">
                  <span aria-hidden>★ </span>
                  {format.number(annonce.note, { maximumFractionDigits: 1 })}
                  <span className="text-texte-attenue">
                    {" "}
                    ({annonce.nombreAvis})
                  </span>
                </span>
              )}
            </Cellule>
            <Cellule>
              <Link
                href={{
                  pathname: "/remorque/[ville]/[slug]",
                  params: { ville: annonce.villeSlug, slug: annonce.slug },
                }}
                className="text-sm font-medium text-accent hover:underline"
              >
                {t("voirPublic")}
              </Link>
            </Cellule>
          </tr>
        ))}
      </Tableau>

      <section className="mt-8 rounded-carte border border-bordure bg-fond-doux p-6">
        <h2 className="text-[0.9375rem] font-semibold">{t("moderation")}</h2>
        <p className="mt-2 max-w-2xl text-[0.9375rem] text-texte-attenue">
          {t("moderationTexte")}
        </p>
      </section>
    </div>
  );
}
