import { lazy, Suspense, useEffect, useState } from "react";

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
    window.addEventListener("site:open-search", open);
    return () => window.removeEventListener("site:open-search", open);
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
