import {
  CompressOutlined,
  GlobalOutlined,
  SafetyOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Alert, Col, Flex, Row, theme } from "antd";
import { LoadingState } from "../../../shared/components/LoadingState.js";
import { PageHeader } from "../../../shared/components/PageHeader.js";
import { SaveButton } from "../../../shared/components/SaveButton.js";
import { useSettings } from "../hooks/useSettings.js";
import { ProxyCard } from "./ProxyCard.js";
import { ServerCard } from "./ServerCard.js";
import { SettingsCard } from "./SettingsCard.js";
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
      <PageHeader
        title="Settings"
        description="Manage gateway configuration, integrations, and tools."
      />

      <Row gutter={[token.paddingLG, token.paddingLG]}>
        <Col xs={24} lg={12}>
          <SettingsCard title="Server" icon={<SettingOutlined />}>
            <ServerCard form={serverForm} />
          </SettingsCard>
        </Col>

        <Col xs={24} lg={12}>
          <SettingsCard title="Web Tools" icon={<GlobalOutlined />}>
            <WebToolsCard value={webTools} onChange={updateWebTools} />
          </SettingsCard>
        </Col>

        <Col xs={24} lg={12}>
          <SettingsCard title="Outbound Proxy" icon={<SafetyOutlined />}>
            <ProxyCard value={proxy} onChange={updateProxy} />
          </SettingsCard>
        </Col>

        <Col xs={24} lg={12}>
          <SettingsCard title="Token Savers" icon={<CompressOutlined />}>
            <TokenSaversCard value={tokenSavers} onChange={updateTokenSavers} />
          </SettingsCard>
        </Col>
      </Row>

      <Alert
        type="info"
        showIcon
        message="Port and proxy changes require a gateway restart to take effect."
      />

      <Flex>
        <SaveButton onClick={save} saving={saving} saved={saved} label="Save Settings" />
      </Flex>
    </Flex>
  );
}
