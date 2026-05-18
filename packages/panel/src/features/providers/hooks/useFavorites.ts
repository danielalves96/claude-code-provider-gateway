import { App } from "antd";
import { useCallback, useEffect, useState } from "react";
import { http } from "../../../shared/api/http.js";

interface PanelConfigResponse {
  panelSettings?: {
    favoriteProviders?: string[];
    favoritesTipDismissed?: boolean;
  };
}

export function useFavorites() {
  const { message } = App.useApp();
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
      .catch(() => {
        void message.error("Failed to load favorites");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [message]);

  const saveToBackend = useCallback(
    (newFavorites: string[]) =>
      http.put("/config", { panelSettings: { favoriteProviders: newFavorites } }),
    [],
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      setFavorites((prev) => {
        const next = prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id];
        saveToBackend(next).catch(() => {
          void message.error("Failed to save favorites");
          setFavorites(prev);
        });
        return next;
      });
    },
    [saveToBackend, message],
  );

  const reorderFavorites = useCallback(
    (newOrder: string[]) => {
      const prev = favorites;
      setFavorites(newOrder);
      saveToBackend(newOrder).catch(() => {
        void message.error("Failed to save favorites");
        setFavorites(prev);
      });
    },
    [saveToBackend, favorites, message],
  );

  const dismissTip = useCallback(() => {
    setTipDismissed(true);
    http.put("/config", { panelSettings: { favoritesTipDismissed: true } }).catch(() => {
      void message.error("Failed to save setting");
      setTipDismissed(false);
    });
  }, [message]);

  return {
    favorites,
    loading,
    tipDismissed,
    toggleFavorite,
    reorderFavorites,
    dismissTip,
  };
}
