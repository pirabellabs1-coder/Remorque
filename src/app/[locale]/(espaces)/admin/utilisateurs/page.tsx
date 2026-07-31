import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { ListeVide } from "@/components/espace/indicateurs";
import { Cellule, Pastille, Tableau } from "@/components/espace/tableau";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import {
  listerUtilisateurs,
  type EtatVerification,
} from "@/server/espaces/administration";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ filtre?: string }>;
};

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const FILTRES = {
  tous: () => true,
  aVerifier: (u: { verification: EtatVerification }) =>
    u.verification === "en_attente",
  loueurs: (u: { role: string }) => u.role !== "locataire",
  suspendus: (u: { suspendu: boolean }) => u.suspendu,
} as const;

type ClefFiltre = keyof typeof FILTRES;

/** La vérification d'identité est le seul état qui appelle une action. */
const TONS: Record<EtatVerification, "succes" | "attente" | "neutre" | "danger"> = {
  verifie: "succes",
  en_attente: "attente",
  non_soumis: "neutre",
  refuse: "danger",
};

export default async function PageUtilisateurs({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { filtre } = await searchParams;
  const actif: ClefFiltre =
    filtre && filtre in FILTRES ? (filtre as ClefFiltre) : "tous";

  const t = await getTranslations("espaces.admin.utilisateurs");
  const format = await getFormatter();

  const tous = listerUtilisateurs();
  const utilisateurs = tous.filter(FILTRES[actif]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace
        titre={t("titre")}
        sousTitre={t("chapo", { nombre: tous.length })}
      />

      <nav className="mt-6 flex flex-wrap gap-2">
        {(Object.keys(FILTRES) as ClefFiltre[]).map((clef) => (
          <Link
            key={clef}
            href={
              clef === "tous"
                ? { pathname: "/admin/utilisateurs" }
                : { pathname: "/admin/utilisateurs", query: { filtre: clef } }
            }
            aria-current={clef === actif ? "page" : undefined}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              clef === actif
                ? "border-accent bg-accent text-accent-contraste"
                : "border-bordure bg-fond-eleve hover:border-accent hover:text-accent",
            )}
          >
            {t(`filtres.${clef}` as never)}
            <span className="ml-2 tabular-nums opacity-70">
              {tous.filter(FILTRES[clef]).length}
            </span>
          </Link>
        ))}
      </nav>

      {utilisateurs.length === 0 ? (
        <div className="mt-8">
          <ListeVide titre={t("titre")} texte={t("chapo", { nombre: 0 })} />
        </div>
      ) : (
        <Tableau
          className="mt-8"
          colonnes={[
            { cle: "nom", entete: t("nom") },
            { cle: "courriel", entete: t("courriel"), secondaire: true },
            { cle: "ville", entete: t("localisation"), secondaire: true },
            { cle: "role", entete: t("role") },
            { cle: "verif", entete: t("verification") },
            { cle: "activite", entete: t("activite"), secondaire: true },
            { cle: "inscrit", entete: t("inscrit"), numerique: true, secondaire: true },
          ]}
        >
          {utilisateurs.slice(0, 60).map((utilisateur) => (
            <tr key={utilisateur.id}>
              <th scope="row" className="px-5 py-3.5 text-left font-normal">
                <span className="flex items-center gap-2">
                  {utilisateur.nom}
                  {utilisateur.suspendu ? (
                    <Pastille ton="danger">{t("suspendu")}</Pastille>
                  ) : null}
                </span>
              </th>
              <Cellule secondaire attenue>
                {utilisateur.courriel}
              </Cellule>
              <Cellule secondaire>{utilisateur.ville}</Cellule>
              <Cellule>{t(`roles.${utilisateur.role}` as never)}</Cellule>
              <Cellule>
                <Pastille ton={TONS[utilisateur.verification]}>
                  {t(`verifications.${utilisateur.verification}` as never)}
                </Pastille>
              </Cellule>
              <Cellule secondaire attenue>
                {t("locations", { nombre: utilisateur.locations })}
                {utilisateur.annonces > 0
                  ? ` · ${t("annonces", { nombre: utilisateur.annonces })}`
                  : ""}
              </Cellule>
              <Cellule numerique secondaire attenue>
                {format.dateTime(utilisateur.inscritLe, {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </Cellule>
            </tr>
          ))}
        </Tableau>
      )}
    </div>
  );
}
