import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { FormulaireAnnonce } from "@/components/espace/formulaire-annonce";
import { ListeVide } from "@/components/espace/indicateurs";
import { Illustration } from "@/components/ui/illustration";
import { Link } from "@/i18n/navigation";
import { PRIX_AFFICHE } from "@/lib/cn";
import { annoncesDuProprietaire } from "@/server/annonces/depot";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };

/** Le catalogue change à chaque publication : rien à mettre en cache ici. */
export const dynamic = "force-dynamic";

export default async function PageAnnonces({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.loueur");
  const format = await getFormatter();
  const annonces = annoncesDuProprietaire();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace
        titre={t("annonces.titre")}
        sousTitre={t("annonces.chapo", { nombre: annonces.length })}
      />

      <section className="mt-8">
        <h2 className="text-[1.0625rem] font-semibold">{t("annonces.parc")}</h2>

        {annonces.length === 0 ? (
          <div className="mt-4">
            <ListeVide
              titre={t("annonces.vide.titre")}
              texte={t("annonces.vide.texte")}
            />
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {annonces.map((annonce) => (
              <li
                key={annonce.id}
                className="flex items-center gap-4 rounded-carte border border-bordure bg-fond-eleve p-3 shadow-(--ombre-carte)"
              >
                <Illustration
                  src={annonce.photo}
                  alt=""
                  className="size-16 shrink-0 rounded-[0.5rem]"
                  tailles="64px"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{annonce.titre}</p>
                  <p className="mt-0.5 text-sm text-texte-attenue">
                    {annonce.ville} · {annonce.ptacKg} kg ·{" "}
                    {annonce.chargeUtileKg} kg utiles
                  </p>
                </div>

                <p className="shrink-0 text-right">
                  <span className="font-bold tabular-nums text-accent">
                    {format.number(annonce.prixJour / 100, {
                      ...PRIX_AFFICHE,
                      currency: annonce.devise,
                    })}
                  </span>
                  <span className="block text-xs text-texte-attenue">
                    {t("annonces.parJour")}
                  </span>
                </p>

                <Link
                  href={{
                    pathname: "/remorque/[ville]/[slug]",
                    params: { ville: annonce.villeSlug, slug: annonce.slug },
                  }}
                  className="shrink-0 rounded-champ border border-bordure px-3 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
                >
                  {t("annonces.voir")}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-[1.0625rem] font-semibold">
          {t("publication.titre")}
        </h2>
        <p className="mt-2 max-w-2xl text-[0.9375rem] text-texte-attenue">
          {t("publication.chapo")}
        </p>
        <div className="mt-6">
          <FormulaireAnnonce />
        </div>
      </section>
    </div>
  );
}
