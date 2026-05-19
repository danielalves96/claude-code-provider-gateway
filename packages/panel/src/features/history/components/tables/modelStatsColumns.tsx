import type { TableColumnsType } from "antd";
import { Tag, Tooltip, Typography, theme } from "antd";
import { ProviderLogo } from "../../../providers/components/grid/ProviderLogo.js";
import { formatNumber } from "../../domain/format.js";
import { providerLabel } from "../../domain/labels.js";
import type { ModelStat } from "../../domain/types.js";

const { Text } = Typography;

export type ModelStatsRow = [string, ModelStat];

export function useModelStatsColumns(): TableColumnsType<ModelStatsRow> {
  const { token } = theme.useToken();

  return [
    {
      title: "Requested model",
      key: "m",
      ellipsis: true,
      render: ([model]) => (
        <Text
          style={{
            fontFamily: "monospace",
            color: token.colorInfoText,
            fontSize: token.fontSizeSM,
          }}
        >
          {model}
        </Text>
      ),
    },
    {
      title: "Last routed to",
      key: "r",
      ellipsis: true,
      render: ([, stat]) => <LastProviderModel stat={stat} />,
    },
    {
      title: "Requests",
      key: "req",
      width: 85,
      align: "right",
      render: ([, stat]) => <CountTag color="blue" value={stat.requests} />,
    },
    {
      title: "Tokens in",
      key: "tok",
      width: 110,
      align: "right",
      render: ([, stat]) => <MutedMonoText value={formatNumber(stat.inputTokens)} />,
    },
    {
      title: "Avg latency",
      key: "lat",
      width: 100,
      align: "right",
      render: ([, stat]) => <MutedMonoText value={`${stat.avgLatencyMs}ms`} />,
    },
    {
      title: "Errors",
      key: "err",
      width: 70,
      align: "right",
      render: ([, stat]) => <ErrorCount stat={stat} />,
    },
  ];
}

function LastProviderModel({ stat }: { stat: ModelStat }) {
  const { token } = theme.useToken();

  if (!stat.lastProviderId) {
    return <Text style={{ fontFamily: "monospace", fontSize: token.fontSizeSM }}>—</Text>;
  }

  const label = providerLabel(stat.lastProviderId);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <ProviderLogo providerId={stat.lastProviderId} label={label} size={16} />
      <Text style={{ fontFamily: "monospace", fontSize: token.fontSizeSM }}>
        {label}
        {stat.lastProviderModel ? `/${stat.lastProviderModel}` : ""}
      </Text>
    </div>
  );
}

function CountTag({ color, value }: { color: string; value: number }) {
  return (
    <Tag color={color} bordered={false} style={{ margin: 0, fontFamily: "monospace" }}>
      {value}
    </Tag>
  );
}

function MutedMonoText({ value }: { value: string }) {
  return (
    <Text type="secondary" style={{ fontFamily: "monospace" }}>
      {value}
    </Text>
  );
}

function ErrorCount({ stat }: { stat: ModelStat }) {
  if (stat.errors === 0) return <MutedMonoText value="0" />;

  return (
    <Tooltip title={stat.lastError ?? ""}>
      <CountTag color="error" value={stat.errors} />
    </Tooltip>
  );
}
