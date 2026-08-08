"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { basculerMaintenance } from "@/server/administration/parametres";

/**
 * Bascule du mode maintenance.
 *
 * Elle demande confirmation, et c'est la seule action de l'administration à le
 * faire : couper l'accès public d'un clic, sur un écran qu'on parcourt, est
 * exactement le genre d'accident qui arrive un vendredi soir. La confirmation
 * dit ce qui va se passer, pas « êtes-vous sûr ? ».
 */
export function BasculeMaintenance({ actif }: { actif: boolean }) {
  const t = useTranslations("espaces.admin.parametres");
  const router = useRouter();
  const [confirme, setConfirme] = useState(false);
  const [enCours, demarrer] = useTransition();

  function basculer() {
    demarrer(async () => {
      await basculerMaintenance(!actif);
      setConfirme(false);
      router.refresh();
    });
  }

  if (!confirme) {
    return (
      <button
        type="button"
        onClick={() => setConfirme(true)}
        className={cn(
          "mt-4 rounded-champ border px-4 py-2.5 text-sm font-medium transition-colors",
          actif
            ? "border-succes text-succes hover:bg-succes hover:text-white"
            : "border-danger text-danger hover:bg-danger hover:text-white",
        )}
      >
        {actif ? t("desactiverMaintenance") : t("activerMaintenance")}
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-champ border border-danger bg-fond-eleve p-4">
      <p className="text-[0.9375rem] font-medium">
        {actif ? t("confirmationReprise") : t("confirmationCoupure")}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={basculer}
          disabled={enCours}
          className="rounded-champ bg-danger px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {enCours ? t("bascule") : t("confirmer")}
        </button>
        <button
          type="button"
          onClick={() => setConfirme(false)}
          className="rounded-champ border border-bordure px-4 py-2 text-sm font-medium transition-colors hover:border-accent"
        >
          {t("annuler")}
        </button>
      </div>
    </div>
  );
}
