import { Flex, Table, Tooltip, Typography, Tag } from "antd";
import { ProviderLogo } from "../../providers/components/ProviderLogo.js";
import { formatTime } from "../format.js";
import { providerLabel } from "../labels.js";
import type { ProviderStat } from "../types.js";
import { SectionLabel } from "./SectionLabel.js";

const { Text } = Typography;

type Row = readonly [string, ProviderStat];

interface ProvidersTableProps {
  rows: Row[];
  title?: string;
}

export function ProvidersTable({ rows, title = "Providers" }: ProvidersTableProps) {
  return (
    <Flex vertical gap={4}>
      <SectionLabel>{title}</SectionLabel>
      <Table<Row>
        dataSource={rows}
        rowKey={([id]) => id}
        size="small"
        pagination={false}
        columns={[
          {
            title: "Provider",
            key: "n",
            render: ([id]: Row) => (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ProviderLogo providerId={id} label={providerLabel(id)} size={16} />
                <span>{providerLabel(id)}</span>
              </div>
            ),
          },
          {
            title: "Requests",
            key: "req",
            width: 85,
            align: "right",
            render: ([, s]: Row) => (
              <Tag color="blue" bordered={false} style={{ margin: 0, fontFamily: "monospace" }}>
                {s.requests}
              </Tag>
            ),
          },
          {
            title: "Errors",
            key: "err",
            width: 70,
            align: "right",
            render: ([, s]: Row) =>
              s.errors > 0 ? (
                <Tag color="error" bordered={false} style={{ margin: 0, fontFamily: "monospace" }}>
                  {s.errors}
                </Tag>
              ) : (
                <Text type="secondary" style={{ fontFamily: "monospace" }}>
                  0
                </Text>
              ),
          },
          {
            title: "Avg latency",
            key: "lat",
            width: 100,
            align: "right",
            render: ([, s]: Row) => (
              <Text type="secondary" style={{ fontFamily: "monospace" }}>
                {s.avgLatencyMs}ms
              </Text>
            ),
          },
          {
            title: "Last activity",
            key: "la",
            render: ([, s]: Row) => (
              <Text type="secondary">{s.lastActivityAt ? formatTime(s.lastActivityAt) : "—"}</Text>
            ),
          },
          {
            title: "Last error",
            key: "le",
            ellipsis: true,
            render: ([, s]: Row) => (
              <Tooltip title={s.lastError ?? ""}>
                <Text type="secondary">{s.lastError ? s.lastError.slice(0, 60) : "—"}</Text>
              </Tooltip>
            ),
          },
        ]}
      />
    </Flex>
  );
}
