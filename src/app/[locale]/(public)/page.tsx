import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

import { Link } from "@/i18n/navigation";

export default function AccueilPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  setRequestLocale(locale);

  const t = useTranslations("accueil");
  const tNav = useTranslations("navigation");

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-20">
      <p className="text-sm font-medium uppercase tracking-widest text-accent">
        Socle technique — phase 1
      </p>
      <h1 className="mt-4 text-balance text-4xl font-semibold sm:text-5xl">
        {t("titre")}
      </h1>
      <p className="mt-6 max-w-2xl text-pretty text-lg text-texte-attenue">
        {t("sousTitre")}
      </p>

      <ul className="mt-10 grid gap-4 sm:grid-cols-3">
        <li className="rounded-carte border border-bordure bg-fond-eleve p-5">
          {t("reassurance.assurance")}
        </li>
        <li className="rounded-carte border border-bordure bg-fond-eleve p-5">
          {t("reassurance.paiement")}
        </li>
        <li className="rounded-carte border border-bordure bg-fond-eleve p-5">
          {t("reassurance.proximite")}
        </li>
      </ul>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/recherche"
          className="rounded-champ bg-accent px-5 py-3 font-medium text-accent-contraste"
        >
          {tNav("louer")}
        </Link>
        <Link
          href="/mettre-en-location"
          className="rounded-champ border border-bordure px-5 py-3 font-medium"
        >
          {tNav("mettreEnLocation")}
        </Link>
      </div>
    </main>
  );
}
