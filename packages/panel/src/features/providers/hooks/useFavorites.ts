import { useCallback, useEffect, useState } from "react";
import { http } from "../../../shared/api/http.js";

interface PanelConfigResponse {
  panelSettings?: {
    favoriteProviders?: string[];
    favoritesTipDismissed?: boolean;
  };
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [tipDismissed, setTipDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    http
      .get<PanelConfigResponse>("/config")
      .then((config: PanelConfigResponse) => {
        const backendFavorites = config.panelSettings?.favoriteProviders;
        if (Array.isArray(backendFavorites)) {
          setFavorites(backendFavorites);
        }
        setTipDismissed(!!config.panelSettings?.favoritesTipDismissed);
      })
      .catch(() => undefined)
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const saveToBackend = useCallback((newFavorites: string[]) => {
    http
      .put("/config", { panelSettings: { favoriteProviders: newFavorites } })
      .catch(() => undefined);
  }, []);

  const toggleFavorite = useCallback(
    (id: string) => {
      setFavorites((prev) => {
        const next = prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id];
        saveToBackend(next);
        return next;
      });
    },
    [saveToBackend],
  );

  const reorderFavorites = useCallback(
    (newOrder: string[]) => {
      setFavorites(newOrder);
      saveToBackend(newOrder);
    },
    [saveToBackend],
  );

  const dismissTip = useCallback(() => {
    setTipDismissed(true);
    http.put("/config", { panelSettings: { favoritesTipDismissed: true } }).catch(() => undefined);
  }, []);

  return {
    favorites,
    loading,
    tipDismissed,
    toggleFavorite,
    reorderFavorites,
    dismissTip,
  };
}
