import { getTranslations, setRequestLocale } from "next-intl/server";

import { EnTeteEspace } from "@/components/espace/coquille-espace";
import { Bouton } from "@/components/ui/bouton";
import { ENABLED_MARKETS, getMarket, MARKETS } from "@/config/markets";
import { syntheseLocataire } from "@/server/espaces/locataire";

type Props = { params: Promise<{ locale: string }> };

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PageParametresLocataire({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("espaces.locataire.parametres");
  const synthese = syntheseLocataire();

  // La suppression est refusée tant qu'une caution est immobilisée ou qu'une
  // location court : effacer le compte laisserait des fonds gelés sans
  // titulaire pour les réclamer. La règle est appliquée ici, pas seulement
  // énoncée dans le texte d'avertissement.
  const suppressionPossible =
    synthese.cautionsNombre === 0 && synthese.enCours === 0 && synthese.aVenir === 0;

  // Le marché courant vient de la configuration, jamais d'une constante
  // écrite ici : la devise d'affichage est une donnée de marché — règle 7.
  const marcheCourant = getMarket(
    ENABLED_MARKETS.includes(locale as never)
      ? (locale as (typeof ENABLED_MARKETS)[number])
      : ENABLED_MARKETS[0],
  );
  const marchesAvenir = Object.keys(MARKETS).length - ENABLED_MARKETS.length;

  const NOTIFICATIONS = [
    { cle: "reservations", courriel: true, sms: true },
    { cle: "messagesNotif", courriel: true, sms: false },
    { cle: "cautions", courriel: true, sms: false },
    { cle: "promotions", courriel: false, sms: false },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-10">
      <EnTeteEspace titre={t("titre")} sousTitre={t("chapo")} />

      <form className="mt-8 space-y-8">
        {/* ---------- Notifications ---------- */}
        <fieldset className="rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
          <legend className="px-2 text-[0.9375rem] font-semibold">
            {t("notifications")}
          </legend>
          <p className="mt-2 text-[0.9375rem] text-texte-attenue">
            {t("notificationsAide")}
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-[0.9375rem]">
              <thead className="border-b border-bordure text-sm text-texte-attenue">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    <span className="sr-only">{t("notifications")}</span>
                  </th>
                  <th scope="col" className="px-3 py-2 text-center font-medium">
                    {t("parCourriel")}
                  </th>
                  <th scope="col" className="px-3 py-2 text-center font-medium">
                    {t("parSms")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bordure">
                {NOTIFICATIONS.map((ligne) => (
                  <tr key={ligne.cle}>
                    <th scope="row" className="py-3 pr-4 font-normal">
                      {t(ligne.cle as never)}
                    </th>
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        name={`${ligne.cle}-courriel`}
                        defaultChecked={ligne.courriel}
                        aria-label={`${t(ligne.cle as never)} — ${t("parCourriel")}`}
                        className="size-4 accent-[var(--accent)]"
                      />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        name={`${ligne.cle}-sms`}
                        defaultChecked={ligne.sms}
                        aria-label={`${t(ligne.cle as never)} — ${t("parSms")}`}
                        className="size-4 accent-[var(--accent)]"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>

        {/* ---------- Langue et région ---------- */}
        <fieldset className="rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
          <legend className="px-2 text-[0.9375rem] font-semibold">
            {t("langue")}
          </legend>

          {/* Un seul marché est ouvert à ce jour. Un sélecteur à une entrée
              est un faux choix : il promet un réglage qui n'existe pas et se
              recette « fonctionnel » alors qu'il ne fait rien. Tant que la
              deuxième vague n'est pas ouverte, l'écran affiche l'état, et le
              dit. */}
          <dl className="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-texte-attenue">
                {t("langueLibelle")}
              </dt>
              <dd className="mt-1 font-medium">{marcheCourant.language}</dd>
            </div>
            <div>
              <dt className="text-sm text-texte-attenue">{t("devise")}</dt>
              <dd className="mt-1 font-medium tabular-nums">
                {marcheCourant.currency}
              </dd>
              <p className="mt-2 text-sm text-texte-attenue">{t("deviseAide")}</p>
            </div>
          </dl>

          {marchesAvenir > 0 ? (
            <p className="mt-5 text-sm text-texte-attenue">
              {t("marchesAvenir", { nombre: marchesAvenir })}
            </p>
          ) : null}
        </fieldset>

        <Bouton type="submit">{t("enregistrer")}</Bouton>
      </form>

      {/* ---------- Confidentialité ---------- */}
      <section className="mt-12">
        <h2 className="text-[1.0625rem] font-semibold">{t("confidentialite")}</h2>

        <div className="mt-4 rounded-carte border border-bordure bg-fond-eleve p-6 shadow-(--ombre-carte)">
          <h3 className="text-[0.9375rem] font-semibold">{t("telecharger")}</h3>
          <p className="mt-2 max-w-xl text-[0.9375rem] text-texte-attenue">
            {t("telechargerTexte")}
          </p>
          <Bouton
            type="button"
            variante="secondaire"
            taille="petit"
            className="mt-4"
          >
            {t("telechargerAction")}
          </Bouton>
        </div>

        <div className="mt-4 rounded-carte border border-danger/30 bg-danger/5 p-6">
          <h3 className="text-[0.9375rem] font-semibold text-danger">
            {t("supprimer")}
          </h3>
          <p className="mt-2 max-w-xl text-[0.9375rem] text-texte-attenue">
            {t("supprimerTexte")}
          </p>
          <button
            type="button"
            disabled={!suppressionPossible}
            className="mt-4 rounded-champ border border-danger px-4 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger hover:text-white disabled:cursor-not-allowed disabled:border-bordure disabled:text-texte-attenue disabled:hover:bg-transparent"
          >
            {t("supprimerAction")}
          </button>
        </div>
      </section>
    </div>
  );
}
