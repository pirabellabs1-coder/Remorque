import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { ListeVide } from "@/components/espace/indicateurs";
import { mesFils } from "@/server/espaces/locataire";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PageMessagesLocataire({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.locataire.messages");
  const format = await getFormatter();

  const fils = mesFils();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace titre={t("titre")} sousTitre={t("chapo")} />

      {fils.length === 0 ? (
        <div className="mt-8">
          <ListeVide titre={t("vide.titre")} texte={t("vide.texte")} />
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-bordure overflow-hidden rounded-carte border border-bordure bg-fond-eleve shadow-(--ombre-carte)">
          {fils.map((fil) => (
            <li key={fil.id}>
              <div className="flex items-start gap-4 px-5 py-4">
                {/* Initiale plutôt qu'une photographie : nous n'avons pas
                    d'avatar, et un cercle gris vide est plus laid qu'une
                    lettre. */}
                <span
                  aria-hidden
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-fond-doux font-medium"
                >
                  {fil.proprietaire.charAt(0)}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate font-medium">{fil.proprietaire}</p>
                    <span className="shrink-0 text-xs text-texte-attenue">
                      {format.dateTime(fil.date, {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>

                  {/* La référence à côté de l'annonce : c'est elle qui rattache
                      la conversation à une location précise, et le locataire en
                      a plusieurs du même matériel au fil des ans. */}
                  <p className="mt-0.5 truncate text-sm text-texte-attenue">
                    {fil.annonceTitre}
                    <span className="font-mono"> · {fil.reference}</span>
                  </p>

                  <p className="mt-1.5 truncate text-[0.9375rem]">
                    {/* Savoir si la balle est dans son camp évite de relire le
                        fil pour s'en assurer. */}
                    {fil.deMoi ? (
                      <span className="text-texte-attenue">{t("vous")} </span>
                    ) : null}
                    {fil.dernierMessage}
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
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
