import type { ReactNode } from "react";

import { CoquilleEspace } from "@/components/espace/coquille-espace";
import { NAVIGATION_LOUEUR } from "@/components/espace/navigation-espace";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <CoquilleEspace espace="loueur" navigation={NAVIGATION_LOUEUR}>
      {children}
    </CoquilleEspace>
  );
}
