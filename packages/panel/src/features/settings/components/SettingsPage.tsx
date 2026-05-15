import { Alert, Col, Flex, Row, theme } from "antd";
import { LoadingState } from "../../../shared/components/LoadingState.js";
import { PageHeader } from "../../../shared/components/PageHeader.js";
import { SaveButton } from "../../../shared/components/SaveButton.js";
import { useSettings } from "../hooks/useSettings.js";
import { ProxyCard } from "./ProxyCard.js";
import { ServerCard } from "./ServerCard.js";
import { TokenSaversCard } from "./TokenSaversCard.js";
import { WebToolsCard } from "./WebToolsCard.js";

export default function SettingsPage() {
  const { token } = theme.useToken();
  const {
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
  } = useSettings();

  if (!loaded) return <LoadingState />;

  return (
    <Flex vertical gap={token.paddingLG}>
      <PageHeader title="Settings" />

      <Row gutter={[token.padding, token.padding]}>
        <Col xs={24} lg={12}>
          <ServerCard form={serverForm} />
        </Col>
        <Col xs={24} lg={12}>
          <WebToolsCard value={webTools} onChange={updateWebTools} />
        </Col>
        <Col xs={24} lg={12}>
          <ProxyCard value={proxy} onChange={updateProxy} />
        </Col>
        <Col xs={24} lg={12}>
          <TokenSaversCard value={tokenSavers} onChange={updateTokenSavers} />
        </Col>
      </Row>

      <Alert
        type="info"
        showIcon
        message="Port and proxy changes require a gateway restart to take effect."
      />

      <Flex>
        <SaveButton onClick={save} saving={saving} saved={saved} label="Save settings" />
      </Flex>
    </Flex>
  );
}
