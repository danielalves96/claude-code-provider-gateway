import { Form } from "antd";
import { useEffect, useState } from "react";
import { useSaveFeedback } from "../../../shared/hooks/useSaveFeedback.js";
import { settingsService } from "../settingsService.js";
import type { ProxyConfig, ServerConfig, TokenSaversConfig, WebToolsConfig } from "../types.js";

const DEFAULT_WEB_TOOLS: WebToolsConfig = {
  enabled: true,
  allowPrivateNetworks: false,
};

const DEFAULT_PROXY: ProxyConfig = {
  enabled: false,
  url: "",
};

const DEFAULT_TOKEN_SAVERS: TokenSaversConfig = {
  rtkEnabled: false,
  cavemanEnabled: false,
  cavemanLevel: "lite",
};

export function useSettings() {
  const [serverForm] = Form.useForm<ServerConfig>();
  const [webTools, setWebTools] = useState<WebToolsConfig>(DEFAULT_WEB_TOOLS);
  const [proxy, setProxy] = useState<ProxyConfig>(DEFAULT_PROXY);
  const [tokenSavers, setTokenSavers] = useState<TokenSaversConfig>(DEFAULT_TOKEN_SAVERS);
  const [loaded, setLoaded] = useState(false);
  const { saving, saved, wrap } = useSaveFeedback();

  useEffect(() => {
    settingsService
      .get()
      .then((c) => {
        serverForm.setFieldsValue(c.server);
        setWebTools(c.webTools);
        setProxy(c.proxy);
        setTokenSavers(c.tokenSavers);
      })
      .finally(() => setLoaded(true));
  }, [serverForm]);

  const updateWebTools = (patch: Partial<WebToolsConfig>) =>
    setWebTools((w) => ({ ...w, ...patch }));

  const updateProxy = (patch: Partial<ProxyConfig>) => setProxy((p) => ({ ...p, ...patch }));

  const updateTokenSavers = (patch: Partial<TokenSaversConfig>) =>
    setTokenSavers((t) => ({ ...t, ...patch }));

  const save = () => {
    const nextServer = serverForm.getFieldsValue();
    return wrap(() => settingsService.save(nextServer, webTools, proxy, tokenSavers));
  };

  return {
    serverForm,
    webTools,
    updateWebTools,
    proxy,
    updateProxy,
    tokenSavers,
    updateTokenSavers,
    loaded,
    saving,
    saved,
    save,
  };
}
