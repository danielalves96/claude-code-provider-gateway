import { ArrowRightOutlined } from "@ant-design/icons";
import { Alert, Card, Flex, Select, Space, Switch, Tag, Typography, theme } from "antd";
import type { GlobalToken } from "antd/es/theme/interface";
import { ProviderLogo } from "../../providers/components/ProviderLogo.js";
import { TIER_META } from "../constants.js";
import type { RoutingOption, RoutingRule, Tier } from "../types.js";

const { Text } = Typography;

interface TierCardProps {
  tier: Tier;
  rule: RoutingRule;
  options: RoutingOption[];
  onChange: (patch: Partial<RoutingRule>) => void;
}

export function TierCard({ tier, rule, options, onChange }: TierCardProps) {
  const { token } = theme.useToken();
  const providerOpts = options.find((o) => o.id === rule.providerId);
  const modelMissing =
    !!rule.providerId &&
    !!rule.model &&
    providerOpts !== undefined &&
    !providerOpts.models.some((m) => m.id === rule.model);
  const canEnable = !!rule.providerId && !!rule.model;

  const isEnabled = rule.enabled;
  const glowColor = isEnabled ? getGlowColor(tier, token) : token.colorBorderSecondary;

  return (
    <Card
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        borderColor: glowColor,
        transition: "all 0.3s ease",
        boxShadow: isEnabled ? `0 0 16px 1px ${glowColor}25` : undefined,
      }}
      styles={{
        body: { flex: 1, display: "flex", flexDirection: "column", padding: token.paddingLG },
      }}
    >
      <Flex justify="space-between" align="flex-start" style={{ marginBottom: token.marginLG }}>
        <Space size="middle" align="center">
          <Tag
            color={TIER_META[tier].color}
            style={{
              fontFamily: "monospace",
              textTransform: "capitalize",
              margin: 0,
              fontSize: 14,
              padding: "4px 8px",
              border: `1px solid ${isEnabled ? glowColor : token.colorBorderSecondary}`,
            }}
          >
            {tier}
          </Tag>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {TIER_META[tier].description}
          </Text>
        </Space>

        <Space size="small">
          <Text
            type={isEnabled ? "success" : "secondary"}
            strong
            style={{ fontSize: 12, letterSpacing: 0.5 }}
          >
            {isEnabled ? "ACTIVE" : "INACTIVE"}
          </Text>
          <Switch
            checked={isEnabled}
            disabled={!canEnable}
            onChange={(v) => onChange({ enabled: v })}
            title={!canEnable ? "Select a provider and model first" : undefined}
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
            onChange={(v) => onChange({ providerId: v, model: "" })}
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
            options={[
              ...(providerOpts?.models.map((m) => ({
                value: m.id,
                label: m.display_name,
              })) ?? []),
              ...(modelMissing
                ? [
                    {
                      value: rule.model,
                      label: `${rule.model} (not in enabled list)`,
                    },
                  ]
                : []),
            ]}
            allowClear
            onClear={() => onChange({ model: "", enabled: false })}
          />
        </div>
      </Flex>

      {modelMissing && (
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

function getGlowColor(tier: Tier, token: GlobalToken) {
  switch (tier) {
    case "opus":
      return "#722ed1"; // Ant Design Purple
    case "sonnet":
      return "#1677ff"; // Ant Design Blue
    case "haiku":
      return "#13c2c2"; // Ant Design Cyan
    default:
      return token.colorTextSecondary;
  }
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
