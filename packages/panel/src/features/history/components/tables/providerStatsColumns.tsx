import type { TableColumnsType } from "antd";
import { Tag, Tooltip, Typography } from "antd";
import { ProviderLogo } from "../../../providers/components/grid/ProviderLogo.js";
import { formatTime } from "../../domain/format.js";
import { providerLabel } from "../../domain/labels.js";
import type { ProviderStat } from "../../domain/types.js";

const { Text } = Typography;

export type ProviderStatsRow = readonly [string, ProviderStat];

export function getProviderStatsColumns(): TableColumnsType<ProviderStatsRow> {
  return [
    {
      title: "Provider",
      key: "n",
      render: ([id]) => <ProviderName providerId={id} />,
    },
    {
      title: "Requests",
      key: "req",
      width: 85,
      align: "right",
      render: ([, stat]) => <CountTag color="blue" value={stat.requests} />,
    },
    {
      title: "Errors",
      key: "err",
      width: 70,
      align: "right",
      render: ([, stat]) => <ErrorCount value={stat.errors} />,
    },
    {
      title: "Avg latency",
      key: "lat",
      width: 100,
      align: "right",
      render: ([, stat]) => <MutedMonoText value={`${stat.avgLatencyMs}ms`} />,
    },
    {
      title: "Last activity",
      key: "la",
      render: ([, stat]) => (
        <Text type="secondary">{stat.lastActivityAt ? formatTime(stat.lastActivityAt) : "—"}</Text>
      ),
    },
    {
      title: "Last error",
      key: "le",
      ellipsis: true,
      render: ([, stat]) => <LastErrorText value={stat.lastError} maxLength={60} />,
    },
  ];
}

function ProviderName({ providerId }: { providerId: string }) {
  const label = providerLabel(providerId);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <ProviderLogo providerId={providerId} label={label} size={16} />
      <span>{label}</span>
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

function ErrorCount({ value }: { value: number }) {
  if (value > 0) return <CountTag color="error" value={value} />;

  return <MutedMonoText value="0" />;
}

function MutedMonoText({ value }: { value: string }) {
  return (
    <Text type="secondary" style={{ fontFamily: "monospace" }}>
      {value}
    </Text>
  );
}

function LastErrorText({ value, maxLength }: { value: string | null; maxLength: number }) {
  return (
    <Tooltip title={value ?? ""}>
      <Text type="secondary">{value ? value.slice(0, maxLength) : "—"}</Text>
    </Tooltip>
  );
}
