import { Flex, Table, Tooltip, Typography } from "antd";
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
        bordered
        pagination={false}
        columns={[
          {
            title: "Provider",
            key: "n",
            render: ([id]: Row) => providerLabel(id),
          },
          {
            title: "Requests",
            key: "req",
            width: 85,
            align: "right",
            render: ([, s]: Row) => (
              <Text strong style={{ fontFamily: "monospace" }}>
                {s.requests}
              </Text>
            ),
          },
          {
            title: "Errors",
            key: "err",
            width: 70,
            align: "right",
            render: ([, s]: Row) =>
              s.errors > 0 ? (
                <Text type="danger" style={{ fontFamily: "monospace" }}>
                  {s.errors}
                </Text>
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
