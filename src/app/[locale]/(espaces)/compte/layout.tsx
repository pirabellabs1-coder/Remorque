import type { ReactNode } from "react";

import { CoquilleEspace } from "@/components/espace/coquille-espace";
import { NAVIGATION_LOCATAIRE } from "@/components/espace/navigation-espace";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <CoquilleEspace espace="locataire" navigation={NAVIGATION_LOCATAIRE}>
      {children}
    </CoquilleEspace>
  );
}
