import { lazy, Suspense, useEffect, useState } from "react";
import { OPEN_SEARCH_EVENT } from "@/lib/site-events";

const SearchPanel = lazy(() =>
  import("@/components/search-panel").then((module) => ({ default: module.SearchPanel })),
);

type SearchDialogProps = {
  initialOpen?: boolean;
};

type PanelState = "unmounted" | "open" | "closed";

export function SearchDialog({ initialOpen = false }: SearchDialogProps) {
  const [panelState, setPanelState] = useState<PanelState>(initialOpen ? "open" : "unmounted");

  useEffect(() => {
    const open = () => setPanelState("open");
    window.addEventListener(OPEN_SEARCH_EVENT, open);
    return () => window.removeEventListener(OPEN_SEARCH_EVENT, open);
  }, []);

  return (
    panelState !== "unmounted" && (
      <Suspense fallback={null}>
        <SearchPanel
          open={panelState === "open"}
          onOpenChange={(open) => setPanelState(open ? "open" : "closed")}
        />
      </Suspense>
    )
  );
}
