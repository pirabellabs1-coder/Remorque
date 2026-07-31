import type { ReactNode } from "react";

import { CoquilleEspace } from "@/components/espace/coquille-espace";
import { NAVIGATION_ADMIN } from "@/components/espace/navigation-espace";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <CoquilleEspace espace="admin" navigation={NAVIGATION_ADMIN}>
      {children}
    </CoquilleEspace>
  );
}
