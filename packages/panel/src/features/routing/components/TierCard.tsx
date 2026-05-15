import { Alert, Card, Col, Row, Select, Space, Switch, Tag, Typography, theme } from "antd";
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

  return (
    <Card
      style={{ width: "100%", display: "flex", flexDirection: "column" }}
      styles={{
        body: { flex: 1, display: "flex", flexDirection: "column" },
      }}
      title={
        <Space>
          <Tag
            color={TIER_META[tier].color}
            style={{ fontFamily: "monospace", textTransform: "capitalize" }}
          >
            {tier}
          </Tag>
          <Text type="secondary">{TIER_META[tier].description}</Text>
        </Space>
      }
      extra={
        <Space>
          <Text type={rule.enabled ? "success" : "secondary"}>
            {rule.enabled ? "Enabled" : "Disabled"}
          </Text>
          <Switch
            checked={rule.enabled}
            disabled={!canEnable}
            onChange={(v) => onChange({ enabled: v })}
            title={!canEnable ? "Select a provider and model first" : undefined}
          />
        </Space>
      }
    >
      <Row gutter={token.padding}>
        <Col span={12}>
          <FieldLabel>Provider</FieldLabel>
          <Select
            style={{ width: "100%" }}
            value={rule.providerId || undefined}
            placeholder="Select provider"
            onChange={(v) => onChange({ providerId: v, model: "" })}
            options={options.map((p) => ({ value: p.id, label: p.label }))}
            allowClear
            onClear={() => onChange({ providerId: "", model: "", enabled: false })}
          />
        </Col>
        <Col span={12}>
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
        </Col>
      </Row>
      {modelMissing && (
        <Alert
          type="warning"
          message="This model is not in the provider's enabled list"
          showIcon
          style={{ marginTop: token.paddingSM }}
        />
      )}
    </Card>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  const { token } = theme.useToken();
  return (
    <Text type="secondary" style={{ display: "block", marginBottom: token.marginXS }}>
      {children}
    </Text>
  );
}
