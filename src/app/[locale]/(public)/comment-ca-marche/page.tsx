import { getTranslations, setRequestLocale } from "next-intl/server";

import { Bouton } from "@/components/ui/bouton";
import {
  AppelAction,
  ListePoints,
  PageEditoriale,
  SectionEditoriale,
} from "@/components/ui/mise-en-page";
import type { Market } from "@/config/markets";
import { Link } from "@/i18n/navigation";
import { metadonneesPage } from "@/lib/metadonnees";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "commentCaMarche" });

  return metadonneesPage({
    locale: locale as Market,
    href: "/comment-ca-marche",
    titre: t("metaTitre"),
    description: t("metaDescription"),
  });
}

export default async function PageCommentCaMarche({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("commentCaMarche");

  const garanties = [1, 2, 3, 4].map((numero) => ({
    titre: t(`g${numero}Titre` as never),
    texte: t(`g${numero}Texte` as never),
  }));

  return (
    <PageEditoriale titre={t("titre")} chapo={t("chapo")} densite="mixte">
      <SectionEditoriale titre={t("choisir")}>
        <div className="grid gap-5 md:grid-cols-2">
          {/* Les deux parcours sur un pied d'égalité, y compris visuellement.
              Mettre le locataire en avant et le loueur en second suggérerait
              que l'un est le client et l'autre le fournisseur — alors qu'une
              place de marché ne tient que si les deux côtés se remplissent. */}
          <article className="flex flex-col rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
            <h3 className="text-xl font-semibold text-balance">
              {t("locataire.titre")}
            </h3>
            <p className="mt-3 flex-1 text-pretty text-texte-attenue">
              {t("locataire.texte")}
            </p>
            <Bouton
              as={Link}
              href="/comment-ca-marche/louer"
              className="mt-6 self-start"
            >
              {t("locataire.action")}
            </Bouton>
          </article>

          <article className="flex flex-col rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
            <h3 className="text-xl font-semibold text-balance">
              {t("proprietaire.titre")}
            </h3>
            <p className="mt-3 flex-1 text-pretty text-texte-attenue">
              {t("proprietaire.texte")}
            </p>
            <Bouton
              as={Link}
              href="/comment-ca-marche/mettre-en-location"
              variante="secondaire"
              className="mt-6 self-start"
            >
              {t("proprietaire.action")}
            </Bouton>
          </article>
        </div>
      </SectionEditoriale>

      <SectionEditoriale titre={t("garanties")} chapo={t("garantiesChapo")}>
        <ListePoints points={garanties} />
      </SectionEditoriale>

      <AppelAction titre={t("actionTitre")} texte={t("actionTexte")}>
        <Bouton as={Link} href="/recherche" taille="grand">
          {t("actionLouer")}
        </Bouton>
        <Bouton
          as={Link}
          href="/mettre-en-location"
          taille="grand"
          variante="secondaire"
        >
          {t("actionPublier")}
        </Bouton>
      </AppelAction>
    </PageEditoriale>
  );
}
