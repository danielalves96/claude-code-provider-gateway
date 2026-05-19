import { ArrowRightOutlined } from "@ant-design/icons";
import { Alert, Card, Flex, Select, Space, Switch, Tag, Typography, theme } from "antd";
import { ProviderLogo } from "../../../providers/components/grid/ProviderLogo.js";
import type { RoutingOption, RoutingRule, Tier } from "../../domain/types.js";
import { getTierGlowColor, useTierCard } from "../../hooks/useTierCard.js";

const { Text } = Typography;

interface TierCardProps {
  tier: Tier;
  rule: RoutingRule;
  options: RoutingOption[];
  onChange: (patch: Partial<RoutingRule>) => void;
}

export function TierCard({ tier, rule, options, onChange }: TierCardProps) {
  const { token } = theme.useToken();
  const view = useTierCard({ tier, rule, options });
  const glowColor = view.isEnabled ? getTierGlowColor(tier, token) : token.colorBorderSecondary;

  return (
    <Card
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        borderColor: glowColor,
        transition: "all 0.3s ease",
        boxShadow: view.isEnabled ? `0 0 16px 1px ${glowColor}25` : undefined,
      }}
      styles={{
        body: { flex: 1, display: "flex", flexDirection: "column", padding: token.paddingLG },
      }}
    >
      <Flex justify="space-between" align="flex-start" style={{ marginBottom: token.marginLG }}>
        <Space size="middle" align="center">
          <Tag
            color={view.meta.color}
            style={{
              fontFamily: "monospace",
              textTransform: "capitalize",
              margin: 0,
              fontSize: 14,
              padding: "4px 8px",
              border: `1px solid ${view.isEnabled ? glowColor : token.colorBorderSecondary}`,
            }}
          >
            {tier}
          </Tag>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {view.meta.description}
          </Text>
        </Space>

        <Space size="small">
          <Text
            type={view.isEnabled ? "success" : "secondary"}
            strong
            style={{ fontSize: 12, letterSpacing: 0.5 }}
          >
            {view.isEnabled ? "ACTIVE" : "INACTIVE"}
          </Text>
          <Switch
            checked={view.isEnabled}
            disabled={!view.canEnable}
            onChange={(v) => onChange({ enabled: v })}
            title={!view.canEnable ? "Select a provider and model first" : undefined}
          />
        </Space>
      </Flex>

      <Flex align="center" gap={token.padding} style={{ flex: 1 }}>
        <div style={{ flex: 1 }}>
          <FieldLabel>Provider</FieldLabel>
          <Select
            style={{ width: "100%" }}
            value={rule.providerId || undefined}
            placeholder="Select provider"
            onChange={(v) => onChange({ providerId: v, model: "", enabled: false })}
            options={options.map((p) => ({
              value: p.id,
              label: (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ProviderLogo providerId={p.id} label={p.label} size={16} />
                  <span>{p.label}</span>
                </div>
              ),
            }))}
            allowClear
            onClear={() => onChange({ providerId: "", model: "", enabled: false })}
          />
        </div>

        <div
          style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 22 }}
        >
          <ArrowRightOutlined style={{ color: token.colorTextQuaternary, fontSize: 16 }} />
        </div>

        <div style={{ flex: 1 }}>
          <FieldLabel>Model</FieldLabel>
          <Select
            style={{ width: "100%" }}
            value={rule.model || undefined}
            placeholder={rule.providerId ? "Select model" : "Select provider first"}
            disabled={!rule.providerId}
            onChange={(v) => onChange({ model: v })}
            options={view.modelOptions}
            allowClear
            onClear={() => onChange({ model: "", enabled: false })}
          />
        </div>
      </Flex>

      {view.modelMissing && (
        <Alert
          type="warning"
          message="This model is not in the provider's enabled list"
          showIcon
          style={{ marginTop: token.paddingLG }}
        />
      )}
    </Card>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  const { token } = theme.useToken();
  return (
    <Text
      type="secondary"
      style={{
        display: "block",
        marginBottom: token.marginXS,
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: 0.5,
      }}
    >
      {children}
    </Text>
  );
}
