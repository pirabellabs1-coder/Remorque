import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import {
  adressePostale,
  ENTREPRISE,
  identiteComplete,
  VERSION_DOCUMENTS,
} from "@/config/entreprise";
import { cn } from "@/lib/cn";

/**
 * Mise en page des documents contractuels.
 *
 * Un document juridique se lit autrement que le reste du site : on n'y arrive
 * pas pour se laisser convaincre, mais pour vérifier un point précis — qui
 * édite ce site, ce qu'il advient de mes données, comment j'annule. Trois
 * conséquences de conception, toutes destinées à ce lecteur-là.
 *
 * **On entre par le résumé.** Chaque document s'ouvre sur trois ou quatre
 * cartes en langue ordinaire, qui disent l'essentiel avant que le texte
 * contractuel ne commence. Ce n'est pas une facilité : la plupart des gens ne
 * liront que cela, et il vaut mieux qu'ils lisent un résumé exact que rien du
 * tout.
 *
 * **Le sommaire reste visible.** Il colle au défilement sur grand écran, parce
 * qu'un document de vingt articles où l'on doit remonter en haut pour changer
 * de section ne se consulte pas, il se subit.
 *
 * **Chaque article porte son ancre.** On cite « l'article 7 » pendant des
 * années, dans un courriel de support ou une procédure ; le lien doit désigner
 * exactement une clause, pas une page.
 */

export type Bloc =
  | { type: "p"; texte: string }
  | { type: "liste"; entrees: string[] }
  | { type: "soustitre"; texte: string }
  /** Clause qu'on ne veut pas voir manquée : un délai, un droit, une limite. */
  | { type: "encadre"; ton: "info" | "attention"; titre?: string; texte: string }
  /** Définitions et correspondances : « ce mot veut dire ceci ». */
  | { type: "definitions"; entrees: { terme: string; sens: string }[] };

export type Article = {
  /** Identifiant d'ancre, stable dans le temps : on cite « §4 » longtemps. */
  cle: string;
  titre: string;
  contenu: Bloc[];
};

export type PointCle = {
  /** Nom d'icône dessinée plus bas — jamais une bibliothèque externe. */
  icone: "bouclier" | "horloge" | "euro" | "donnees" | "balance" | "cle";
  titre: string;
  texte: string;
};

const ICONES: Record<PointCle["icone"], ReactNode> = {
  bouclier: <path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6l-8-3Z" />,
  horloge: <path d="M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
  euro: <path d="M17 6.5A6.5 6.5 0 1 0 17 17M4 10h8M4 13.5h8" />,
  donnees: (
    <path d="M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Zm0 0v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
  ),
  balance: <path d="M12 4v16m-7-3h14M6 7l-3 6h6l-3-6Zm12 0-3 6h6l-3-6ZM8 4h8" />,
  cle: (
    <path d="M15 7a4 4 0 1 1-3.9 5H8v3H5v-3H3v-3h8.1A4 4 0 0 1 15 7Zm1 3.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1Z" />
  ),
};

function Icone({ nom, className }: { nom: PointCle["icone"]; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {ICONES[nom]}
    </svg>
  );
}

export async function DocumentLegal({
  surtitre,
  titre,
  chapo,
  pointsCles,
  articles,
  apres,
}: {
  surtitre: string;
  titre: string;
  chapo: string;
  /** L'essentiel en langue ordinaire, lu avant le texte contractuel. */
  pointsCles?: PointCle[];
  articles: Article[];
  apres?: ReactNode;
}) {
  const t = await getTranslations("legal");
  const format = await getFormatter();
  const complet = identiteComplete();

  return (
    <main className="pb-24">
      {/* ---------- Bandeau ---------- */}
      <header className="border-b border-bordure bg-fond-doux">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <p className="text-sm font-medium tracking-widest text-accent uppercase">
            {surtitre}
          </p>
          <h1 className="mt-4 max-w-3xl text-[2rem] leading-[1.1] font-bold tracking-[-0.03em] text-balance sm:text-[2.75rem]">
            {titre}
          </h1>
          <p className="mt-5 max-w-2xl text-[1.0625rem] leading-[1.6] text-texte-attenue">
            {chapo}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-bordure bg-fond-eleve px-3.5 py-1.5 text-sm">
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-succes"
              />
              {t("versionCourte", { version: VERSION_DOCUMENTS })}
            </span>
            <span className="text-sm text-texte-attenue">
              {t("miseAJour", {
                date: format.dateTime(new Date(2026, 6, 1), {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }),
              })}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {/*
          Un document amputé de l'identité de son éditeur ne remplit pas son
          office — et pire, il en donne l'apparence. L'avertissement est visible
          de tous, non réservé au développement : c'est le seul moyen qu'une
          mise en ligne prématurée ne passe pas inaperçue.
        */}
        {!complet ? (
          <p
            role="status"
            className="mt-10 flex items-start gap-3 rounded-carte border border-attention/40 bg-attention/5 px-5 py-4 text-[0.9375rem] text-attention"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              aria-hidden
              className="mt-0.5 size-5 shrink-0"
            >
              <path d="M12 9v4m0 4h.01M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
            {t("identiteManquante")}
          </p>
        ) : null}

        {/* ---------- L'essentiel ---------- */}
        {pointsCles && pointsCles.length > 0 ? (
          <section className="mt-12">
            <h2 className="text-[0.6875rem] font-semibold tracking-[0.14em] text-texte-attenue uppercase">
              {t("enBref")}
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pointsCles.map((point) => (
                <article
                  key={point.titre}
                  className="rounded-carte border border-bordure bg-fond-eleve p-5 shadow-(--ombre-carte)"
                >
                  <span className="inline-grid size-10 place-items-center rounded-full bg-accent/10 text-accent">
                    <Icone nom={point.icone} className="size-5" />
                  </span>
                  <h3 className="mt-4 font-semibold">{point.titre}</h3>
                  <p className="mt-2 text-[0.9375rem] leading-[1.6] text-texte-attenue">
                    {point.texte}
                  </p>
                </article>
              ))}
            </div>
            <p className="mt-4 text-sm text-texte-attenue">{t("bref_avertissement")}</p>
          </section>
        ) : null}

        {/* ---------- Sommaire + corps ---------- */}
        <div className="mt-16 gap-12 lg:grid lg:grid-cols-[16rem_1fr]">
          {/* Le sommaire colle au défilement : un document de vingt articles où
              l'on doit remonter en haut pour changer de section ne se consulte
              pas, il se subit. */}
          <nav
            aria-label={t("sommaire")}
            className="mb-10 lg:sticky lg:top-24 lg:mb-0 lg:self-start"
          >
            <h2 className="text-[0.6875rem] font-semibold tracking-[0.14em] text-texte-attenue uppercase">
              {t("sommaire")}
            </h2>
            <ol className="mt-4 space-y-1 border-l border-bordure">
              {articles.map((article, rang) => (
                <li key={article.cle}>
                  <a
                    href={`#${article.cle}`}
                    className="-ml-px flex gap-2.5 border-l-2 border-transparent py-1.5 pl-4 text-[0.9375rem] text-texte-attenue transition-colors hover:border-accent hover:text-accent"
                  >
                    <span className="shrink-0 tabular-nums opacity-60">
                      {rang + 1}
                    </span>
                    <span>{article.titre}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="min-w-0 max-w-3xl space-y-14">
            {articles.map((article, rang) => (
              <section key={article.cle} id={article.cle} className="scroll-mt-24">
                <div className="flex items-baseline gap-3">
                  <span
                    aria-hidden
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-accent/10 text-sm font-semibold text-accent tabular-nums"
                  >
                    {rang + 1}
                  </span>
                  <h2 className="text-[1.375rem] font-bold tracking-[-0.02em] text-balance">
                    {article.titre}
                  </h2>
                </div>

                <div className="mt-5 space-y-4 sm:pl-11">
                  {article.contenu.map((bloc, index) => (
                    <BlocLegal key={index} bloc={bloc} />
                  ))}
                </div>
              </section>
            ))}

            {apres}

            <footer className="border-t border-bordure pt-6 text-sm text-texte-attenue">
              <p>
                {complet
                  ? t("editeurLigne", {
                      raisonSociale: ENTREPRISE.raisonSociale,
                      adresse: adressePostale(),
                    })
                  : t("editeurAbsent")}
              </p>
            </footer>
          </div>
        </div>
      </div>
    </main>
  );
}

function BlocLegal({ bloc }: { bloc: Bloc }) {
  if (bloc.type === "soustitre") {
    return <h3 className="pt-3 text-[1.0625rem] font-semibold">{bloc.texte}</h3>;
  }

  if (bloc.type === "liste") {
    return (
      <ul className="space-y-2.5">
        {bloc.entrees.map((entree, rang) => (
          <li key={rang} className="flex gap-3 text-[1.0625rem] leading-[1.65]">
            <span
              aria-hidden
              className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent/50"
            />
            <span>{entree}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (bloc.type === "definitions") {
    return (
      <dl className="divide-y divide-bordure overflow-hidden rounded-carte border border-bordure bg-fond-eleve">
        {bloc.entrees.map((entree) => (
          <div key={entree.terme} className="px-5 py-4 sm:flex sm:gap-6">
            <dt className="font-semibold sm:w-40 sm:shrink-0">{entree.terme}</dt>
            <dd className="mt-1 text-[0.9375rem] leading-[1.6] text-texte-attenue sm:mt-0">
              {entree.sens}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  if (bloc.type === "encadre") {
    // Le ton distingue ce qui informe de ce qui engage. Une clause qu'on ne
    // veut pas voir manquée — un délai de rétractation, une limite de
    // responsabilité — mérite d'arrêter l'œil.
    const attention = bloc.ton === "attention";
    return (
      <aside
        className={cn(
          "rounded-carte border-l-4 px-5 py-4",
          attention
            ? "border-l-attention bg-attention/5"
            : "border-l-accent bg-accent/5",
        )}
      >
        {bloc.titre ? (
          <p
            className={cn(
              "text-[0.9375rem] font-semibold",
              attention ? "text-attention" : "text-accent",
            )}
          >
            {bloc.titre}
          </p>
        ) : null}
        <p className="mt-1 text-[1.0625rem] leading-[1.6]">{bloc.texte}</p>
      </aside>
    );
  }

  return <p className="text-[1.0625rem] leading-[1.65]">{bloc.texte}</p>;
}
