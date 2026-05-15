import { Alert, Card, Col, Flex, Row, theme } from "antd";
import { LoadingState } from "../../../shared/components/LoadingState.js";
import { PageHeader } from "../../../shared/components/PageHeader.js";
import { SaveButton } from "../../../shared/components/SaveButton.js";
import { TIERS } from "../constants.js";
import { useRouting } from "../hooks/useRouting.js";
import { ThinkingToggle } from "./ThinkingToggle.js";
import { TierCard } from "./TierCard.js";

export default function RoutingPage() {
  const { token } = theme.useToken();
  const { rules, thinking, setThinking, options, updateRule, loaded, saving, saved, save } =
    useRouting();

  if (!loaded) return <LoadingState />;

  return (
    <Flex vertical gap={token.paddingLG}>
      <PageHeader
        title="Routing"
        description="Override which provider and model handles each Claude tier. When disabled, requests pass through unchanged."
      />

      {options.length === 0 && (
        <Alert
          type="warning"
          showIcon
          message="No providers enabled"
          description="Enable and configure a provider on the Providers page before setting up routing."
        />
      )}

      <Row gutter={[token.paddingLG, token.paddingLG]} align="stretch">
        {TIERS.map((tier) => (
          <Col xs={24} xl={12} key={tier} style={{ display: "flex" }}>
            <TierCard
              tier={tier}
              rule={rules[tier]}
              options={options}
              onChange={(patch) => updateRule(tier, patch)}
            />
          </Col>
        ))}
      </Row>

      <Card>
        <Flex justify="space-between" align="center">
          <ThinkingToggle checked={thinking} onChange={setThinking} />
          <SaveButton onClick={save} saving={saving} saved={saved} label="Save routing" />
        </Flex>
      </Card>
    </Flex>
  );
}
