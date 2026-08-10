import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { ListeVide } from "@/components/espace/indicateurs";
import { Link } from "@/i18n/navigation";
import { mesFils } from "@/server/messagerie/depot";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PageMessages({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.loueur.messages");
  const format = await getFormatter();
  const fils = await mesFils();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace titre={t("titre")} sousTitre={t("chapo")} />

      {fils.length === 0 ? (
        <div className="mt-8">
          <ListeVide titre={t("vide.titre")} texte={t("vide.texte")} />
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-bordure overflow-hidden rounded-carte border border-bordure bg-fond-eleve shadow-(--ombre-carte)">
          {fils.map((fil) => (
            <li key={fil.id}>
              <Link
                href={{ pathname: "/proprietaire/messages/[id]", params: { id: fil.id } }}
                className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-fond-doux"
              >
                {/* Initiale plutôt qu'une photographie : nous n'avons pas
                    d'avatar, et un cercle gris vide est plus laid qu'une
                    lettre. */}
                <span
                  aria-hidden
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-fond-doux font-medium"
                >
                  {fil.interlocuteur.charAt(0)}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate font-medium">{fil.interlocuteur}</p>
                    <span className="shrink-0 text-xs text-texte-attenue">
                      {fil.date
                        ? format.dateTime(fil.date, {
                            day: "numeric",
                            month: "short",
                          })
                        : null}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-texte-attenue">
                    {fil.annonceTitre}
                  </p>
                  <p className="mt-1.5 truncate text-[0.9375rem]">
                    {fil.dernierMessage ?? ""}
                  </p>
                </div>

                {fil.nonLus > 0 ? (
                  <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-contraste">
                    <span className="sr-only">
                      {t("nonLus", { nombre: fil.nonLus })}
                    </span>
                    <span aria-hidden>{fil.nonLus}</span>
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
