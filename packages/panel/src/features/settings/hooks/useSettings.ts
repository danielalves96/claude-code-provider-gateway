import { useEffect, useState } from "react";
import { Form } from "antd";
import { useSaveFeedback } from "../../../shared/hooks/useSaveFeedback.js";
import { settingsService } from "../settingsService.js";
import type { ServerConfig, WebToolsConfig, ProxyConfig } from "../types.js";

const DEFAULT_WEB_TOOLS: WebToolsConfig = {
  enabled: true,
  allowPrivateNetworks: false,
};

const DEFAULT_PROXY: ProxyConfig = {
  enabled: false,
  url: "",
};

export function useSettings() {
  const [serverForm] = Form.useForm<ServerConfig>();
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);
  const [webTools, setWebTools] = useState<WebToolsConfig>(DEFAULT_WEB_TOOLS);
  const [proxy, setProxy] = useState<ProxyConfig>(DEFAULT_PROXY);
  const [loaded, setLoaded] = useState(false);
  const { saving, saved, wrap } = useSaveFeedback();

  useEffect(() => {
    settingsService
      .get()
      .then((c) => {
        setServerConfig(c.server);
        serverForm.setFieldsValue(c.server);
        setWebTools(c.webTools);
        setProxy(c.proxy);
      })
      .finally(() => setLoaded(true));
  }, [serverForm]);

  const updateWebTools = (patch: Partial<WebToolsConfig>) =>
    setWebTools((w) => ({ ...w, ...patch }));

  const updateProxy = (patch: Partial<ProxyConfig>) =>
    setProxy((p) => ({ ...p, ...patch }));

  const save = () => {
    const nextServer = serverForm.getFieldsValue();
    return wrap(() => settingsService.save(nextServer, webTools, proxy)).then(() => {
      setServerConfig((current) => ({ ...(current ?? serverForm.getFieldsValue(true)), ...nextServer }));
    });
  };

  return {
    serverForm,
    webTools,
    updateWebTools,
    proxy,
    updateProxy,
    loaded,
    saving,
    saved,
    save,
  };
}
