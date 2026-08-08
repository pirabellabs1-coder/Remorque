import { getFormatter, getTranslations } from "next-intl/server";

import { ActionsLitige } from "@/components/espace/actions-litige";
import { PRIX_AFFICHE } from "@/lib/cn";
import type { LitigeDossier } from "@/server/litiges/depot";

/**
 * Corps d'un dossier de litige, commun aux trois espaces.
 *
 * Locataire, propriétaire et administration voient le **même** dossier : les
 * mêmes montants, le même motif, la même décision. C'est une exigence de fond,
 * pas une économie de code — un litige où chacun lirait sa version n'est plus
 * instruit, il est raconté deux fois.
 */
export async function DossierLitige({ litige }: { litige: LitigeDossier }) {
  const t = await getTranslations("espaces.litige");
  const format = await getFormatter();

  const montant = (centimes: number | null) =>
    centimes === null
      ? "—"
      : format.number(centimes / 100, {
          ...PRIX_AFFICHE,
          currency: litige.devise,
        });

  const date = (valeur: Date | null) =>
    valeur
      ? format.dateTime(valeur, { day: "numeric", month: "long", year: "numeric" })
      : "—";

  const clos = litige.statut === "resolu" || litige.statut === "clos_sans_suite";

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={
            clos
              ? "inline-block rounded-full bg-succes/15 px-3 py-1 text-sm font-medium text-succes"
              : "inline-block rounded-full bg-attention/15 px-3 py-1 text-sm font-medium text-attention"
          }
        >
          {t(`statuts.${litige.statut}` as never)}
        </span>

        {/* Le gel est la conséquence qui intéresse les deux parties : il
            mérite d'être dit à côté du statut, pas en bas de page. Mais on ne
            l'annonce que s'il a réellement eu lieu — sur une location close
            depuis longtemps, la caution est libérée et le reversement envoyé,
            et prétendre les immobiliser serait faux. */}
        {!clos ? (
          <span className="text-sm text-texte-attenue">
            {litige.cautionGelee || litige.reversementGele
              ? t("fondsGeles")
              : t("fondsDejaVerses")}
          </span>
        ) : null}
      </div>

      <section className="rounded-carte border border-bordure bg-fond-eleve p-5 shadow-(--ombre-carte)">
        <h2 className="text-[0.9375rem] font-semibold">{t("reclamation")}</h2>
        <dl className="mt-3 space-y-2 text-[0.9375rem]">
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-texte-attenue">{t("motif")}</dt>
            <dd className="font-medium">
              {t(`formulaire.motifs.${litige.motif}` as never)}
            </dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-texte-attenue">{t("ouvertLe")}</dt>
            <dd>{date(litige.ouvertLe)}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-texte-attenue">{t("montantReclame")}</dt>
            <dd className="font-medium tabular-nums">
              {montant(litige.montantReclame)}
            </dd>
          </div>
          {litige.montantPropose !== null ? (
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-texte-attenue">{t("montantPropose")}</dt>
              <dd className="font-medium tabular-nums">
                {montant(litige.montantPropose)}
              </dd>
            </div>
          ) : null}
        </dl>

        {litige.description ? (
          <p className="mt-4 rounded-champ bg-fond-doux p-3 whitespace-pre-wrap text-[0.9375rem]">
            {litige.description}
          </p>
        ) : null}
      </section>

      {/* La décision, quand elle existe : montant et motif ensemble. Un montant
          sans motif serait indéfendable devant la partie perdante. */}
      {litige.statut === "resolu" ? (
        <section className="rounded-carte border border-succes/40 bg-succes/5 p-5">
          <h2 className="text-[0.9375rem] font-semibold">{t("decision")}</h2>
          <dl className="mt-3 space-y-2 text-[0.9375rem]">
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-texte-attenue">{t("montantAccorde")}</dt>
              <dd className="font-medium tabular-nums">
                {montant(litige.montantAccorde)}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-texte-attenue">{t("renduLe")}</dt>
              <dd>{date(litige.resoluLe)}</dd>
            </div>
          </dl>

          {litige.decisionMotif ? (
            <p className="mt-4 rounded-champ bg-fond-eleve p-3 whitespace-pre-wrap text-[0.9375rem]">
              {litige.decisionMotif}
            </p>
          ) : null}
        </section>
      ) : null}

      {litige.statut === "clos_sans_suite" ? (
        <p className="rounded-carte border border-bordure bg-fond-eleve p-5 text-[0.9375rem] text-texte-attenue">
          {t("closSansSuite")}
        </p>
      ) : null}

      <ActionsLitige
        litigeId={litige.id}
        statut={litige.statut}
        role={litige.monRole}
        ouvertParMoi={litige.ouvertParMoi}
        plafondEuros={(litige.montantReclame ?? litige.caution) / 100}
      />
    </div>
  );
}
