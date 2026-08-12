import { getTranslations, setRequestLocale } from "next-intl/server";

import {
  CarteBrouillon,
  CarteParc,
} from "@/components/espace/annonces/carte-parc";
import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { ListeVide } from "@/components/espace/indicateurs";
import { Bouton } from "@/components/ui/bouton";
import { Link } from "@/i18n/navigation";
import { exigerProfil } from "@/server/authentification/garde";
import {
  annoncesPublieesDuProprietaire,
  brouillonsDuProprietaire,
} from "@/server/annonces/publication";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };

/** Le parc change à chaque publication : rien à mettre en cache ici. */
export const dynamic = "force-dynamic";

export default async function PageAnnonces({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const compte = await exigerProfil(
    locale,
    "/proprietaire/annonces",
    "proprietaire",
  );

  const t = await getTranslations("espaces.loueur");

  const [annonces, brouillons] = await Promise.all([
    annoncesPublieesDuProprietaire(compte.id),
    brouillonsDuProprietaire(compte.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace
        titre={t("annonces.titre")}
        sousTitre={t("annonces.chapo", { nombre: annonces.length })}
        actions={
          <Bouton as={Link} href="/proprietaire/annonces/publier" taille="grand">
            {t("annonces.publier")}
          </Bouton>
        }
      />

      {/* Les brouillons d'abord : ce sont eux qu'on revient terminer, et les
          reléguer en bas de page revient à les abandonner. */}
      {brouillons.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-[1.0625rem] font-semibold">
            {t("annonces.brouillons")}
          </h2>

          <ul className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {brouillons.map((brouillon) => (
              <li key={brouillon.id}>
                <CarteBrouillon brouillon={brouillon} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="text-[1.0625rem] font-semibold">{t("annonces.parc")}</h2>

        {annonces.length === 0 ? (
          <div className="mt-4">
            <ListeVide
              titre={t("annonces.vide.titre")}
              texte={t("annonces.vide.texte")}
              action={
                <Bouton as={Link} href="/proprietaire/annonces/publier">
                  {t("annonces.publier")}
                </Bouton>
              }
            />
          </div>
        ) : (
          <ul className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {annonces.map((annonce) => (
              <li key={annonce.id}>
                <CarteParc annonce={annonce} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
