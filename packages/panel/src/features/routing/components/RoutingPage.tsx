import { Alert, Col, Flex, Row, theme } from "antd";
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
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <Flex vertical gap={token.paddingLG} style={{ flex: 1, paddingBottom: token.paddingLG * 2 }}>
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
      </Flex>

      <div
        style={{
          position: "sticky",
          bottom: -token.paddingLG,
          marginTop: "auto",
          padding: `${token.padding}px ${token.paddingLG}px`,
          margin: `0 -${token.paddingLG}px -${token.paddingLG}px -${token.paddingLG}px`,
          background: "rgba(38, 38, 36, 0.8)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 10,
        }}
      >
        <ThinkingToggle checked={thinking} onChange={setThinking} />
        <SaveButton onClick={save} saving={saving} saved={saved} label="Save routing" />
      </div>
    </div>
  );
}
