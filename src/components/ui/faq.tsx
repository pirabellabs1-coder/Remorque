import { cn } from "@/lib/cn";

export type Question = { question: string; reponse: string };

/**
 * Questions fréquentes, en accordéon.
 *
 * Construit sur `<details>` natif, sans une ligne de JavaScript : le
 * déploiement fonctionne avant l'hydratation, la navigation au clavier et
 * l'annonce par les lecteurs d'écran sont celles du navigateur, et la réponse
 * reste présente dans le HTML — donc lue par les moteurs, ce qui est tout
 * l'intérêt d'une FAQ balisée.
 *
 * Replié par défaut : dix réponses dépliées forment un mur de texte que
 * personne ne lit, alors que dix questions se parcourent en trois secondes.
 */
export function Faq({
  questions,
  className,
}: {
  questions: Question[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "divide-y divide-bordure overflow-hidden rounded-carte border border-bordure bg-fond-eleve",
        "shadow-(--ombre-carte)",
        className,
      )}
    >
      {questions.map((entree) => (
        <details key={entree.question} className="group">
          <summary
            className={cn(
              "flex cursor-pointer list-none items-center justify-between gap-6",
              "px-5 py-5 text-[1.0625rem] font-medium transition-colors sm:px-7",
              "hover:text-accent group-open:text-accent",
              // Retire le triangle par défaut de Safari.
              "[&::-webkit-details-marker]:hidden",
            )}
          >
            {entree.question}
            <span
              aria-hidden
              className="grid size-7 shrink-0 place-items-center rounded-full border border-bordure text-texte-attenue transition-colors group-open:border-accent group-open:text-accent"
            >
              <svg
                viewBox="0 0 12 12"
                className="size-3 transition-transform duration-200 group-open:rotate-180"
                fill="none"
              >
                <path
                  d="m2.5 4.5 3.5 3.5 3.5-3.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </summary>

          <p className="px-5 pb-6 text-[0.9375rem] leading-[1.65] text-texte-attenue sm:px-7 sm:pr-20">
            {entree.reponse}
          </p>
        </details>
      ))}
    </div>
  );
}
