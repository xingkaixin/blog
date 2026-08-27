import { useEffect, useState } from "react";
import { SearchPanel } from "@/components/search-panel";
import { OPEN_SEARCH_EVENT } from "@/lib/site-events";

export function SearchDialog() {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const open = () => setOpen(true);
    window.addEventListener(OPEN_SEARCH_EVENT, open);
    return () => window.removeEventListener(OPEN_SEARCH_EVENT, open);
  }, []);

  return <SearchPanel open={open} onOpenChange={setOpen} />;
}
