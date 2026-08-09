import { getFormatter, getTranslations } from "next-intl/server";

import { ActionsSinistre } from "@/components/espace/actions-sinistre";
import { PRIX_AFFICHE } from "@/lib/cn";
import type { SinistreDossier } from "@/server/sinistres/depot";

/**
 * Corps d'un dossier de sinistre, commun aux trois espaces.
 *
 * Comme pour le litige : locataire, propriétaire et administration lisent le
 * même dossier — même estimation, même référence, même verdict. La seule
 * différence est ce qu'on peut y faire, et cela appartient aux actions.
 */
export async function DossierSinistre({ sinistre }: { sinistre: SinistreDossier }) {
  const t = await getTranslations("espaces.sinistre");
  const format = await getFormatter();

  const montant = (centimes: number | null) =>
    centimes === null
      ? "—"
      : format.number(centimes / 100, {
          ...PRIX_AFFICHE,
          currency: sinistre.devise,
        });

  const date = (valeur: Date | null) =>
    valeur
      ? format.dateTime(valeur, { day: "numeric", month: "long", year: "numeric" })
      : "—";

  const clos = sinistre.statut === "indemnise" || sinistre.statut === "refuse";

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={
            clos
              ? sinistre.statut === "indemnise"
                ? "inline-block rounded-full bg-succes/15 px-3 py-1 text-sm font-medium text-succes"
                : "inline-block rounded-full bg-danger/15 px-3 py-1 text-sm font-medium text-danger"
              : "inline-block rounded-full bg-attention/15 px-3 py-1 text-sm font-medium text-attention"
          }
        >
          {t(`statuts.${sinistre.statut}` as never)}
        </span>

        {/* Le gel est la conséquence qui intéresse les deux parties : il se
            dit à côté du statut, pas en bas de page. */}
        {!clos ? (
          <span className="text-sm text-texte-attenue">{t("fondsGeles")}</span>
        ) : null}
      </div>

      <section className="rounded-carte border border-bordure bg-fond-eleve p-5 shadow-(--ombre-carte)">
        <h2 className="text-[0.9375rem] font-semibold">{t("declaration")}</h2>
        <dl className="mt-3 space-y-2 text-[0.9375rem]">
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-texte-attenue">{t("declareLe")}</dt>
            <dd>{date(sinistre.declareLe)}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-texte-attenue">{t("montantEstime")}</dt>
            <dd className="font-medium tabular-nums">
              {montant(sinistre.montantEstime)}
            </dd>
          </div>
        </dl>

        <p className="mt-4 rounded-champ bg-fond-doux p-3 whitespace-pre-wrap text-[0.9375rem]">
          {sinistre.description}
        </p>
      </section>

      {/* La transmission, quand elle a eu lieu : la référence de l'assureur
          est ce que les parties citeront dans chaque échange avec lui. */}
      {sinistre.transmisLe ? (
        <section className="rounded-carte border border-bordure bg-fond-eleve p-5 shadow-(--ombre-carte)">
          <h2 className="text-[0.9375rem] font-semibold">{t("transmission")}</h2>
          <dl className="mt-3 space-y-2 text-[0.9375rem]">
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-texte-attenue">{t("transmisLe")}</dt>
              <dd>{date(sinistre.transmisLe)}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-texte-attenue">{t("referenceAssureur")}</dt>
              <dd className="font-mono text-sm">{sinistre.referenceAssureur ?? "—"}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {/* Le verdict : un montant pour l'indemnisation, un motif pour le refus.
          Jamais l'un sans l'autre versant — un refus muet serait indéfendable. */}
      {sinistre.statut === "indemnise" ? (
        <section className="rounded-carte border border-succes/40 bg-succes/5 p-5">
          <h2 className="text-[0.9375rem] font-semibold">{t("verdict")}</h2>
          <dl className="mt-3 space-y-2 text-[0.9375rem]">
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-texte-attenue">{t("montantIndemnise")}</dt>
              <dd className="font-medium tabular-nums">
                {montant(sinistre.montantIndemnise)}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-texte-attenue">{t("clotureLe")}</dt>
              <dd>{date(sinistre.clotureLe)}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {sinistre.statut === "refuse" ? (
        <section className="rounded-carte border border-danger/40 bg-danger/5 p-5">
          <h2 className="text-[0.9375rem] font-semibold">{t("refusTitre")}</h2>
          <p className="mt-2 text-sm text-texte-attenue">
            {t("refusLe", { date: date(sinistre.clotureLe) })}
          </p>
          {sinistre.refusMotif ? (
            <p className="mt-3 rounded-champ bg-fond-eleve p-3 whitespace-pre-wrap text-[0.9375rem]">
              {sinistre.refusMotif}
            </p>
          ) : null}
        </section>
      ) : null}

      <ActionsSinistre
        sinistreId={sinistre.id}
        statut={sinistre.statut}
        role={sinistre.monRole}
      />
    </div>
  );
}
