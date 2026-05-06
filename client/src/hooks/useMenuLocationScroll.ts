import { useEffect } from "react";

type UseMenuLocationScrollOptions = {
  isMenuOpen: boolean;
  pendingLocationScrollId: string | null;
  clearPendingLocationScrollId: () => void;
};

export function useMenuLocationScroll({
  isMenuOpen,
  pendingLocationScrollId,
  clearPendingLocationScrollId,
}: UseMenuLocationScrollOptions): void {
  useEffect(() => {
    if (!isMenuOpen || !pendingLocationScrollId) {
      return;
    }

    const timer = window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(
        `[data-location-id="${pendingLocationScrollId}"]`,
      );
      if (!target) {
        return;
      }

      target.scrollIntoView({ behavior: "smooth", block: "start" });
      target.classList.add("location-card-highlight");
      window.setTimeout(() => target.classList.remove("location-card-highlight"), 1200);
      clearPendingLocationScrollId();
    }, 240);

    return () => window.clearTimeout(timer);
  }, [isMenuOpen, pendingLocationScrollId, clearPendingLocationScrollId]);
}
