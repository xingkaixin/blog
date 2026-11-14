import { useEffect, useLayoutEffect, useState } from "react";
import { SearchPanel, type SearchOpenSource } from "@/components/search-panel";
import { OPEN_SEARCH_EVENT } from "@/lib/site-events";

export type OpenSearchOptions = {
  source?: SearchOpenSource;
  triggerElement?: HTMLElement | null;
};

type SearchDialogProps = {
  initialSource?: SearchOpenSource;
  initialTriggerElement?: HTMLElement | null;
};

export function SearchDialog({
  initialSource = "keyboard",
  initialTriggerElement = null,
}: SearchDialogProps) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<SearchOpenSource>(initialSource);
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(initialTriggerElement);

  useLayoutEffect(() => {
    setOpen(true);
  }, []);

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const detail =
        event instanceof CustomEvent ? (event.detail as OpenSearchOptions | undefined) : undefined;
      setSource(detail?.source === "pointer" ? "pointer" : "keyboard");
      setTriggerElement(detail?.triggerElement ?? null);
      setOpen(true);
    };
    window.addEventListener(OPEN_SEARCH_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_SEARCH_EVENT, handleOpen);
  }, []);

  return (
    <SearchPanel
      open={open}
      onOpenChange={setOpen}
      source={source}
      onSourceChange={setSource}
      triggerElement={triggerElement}
    />
  );
}
