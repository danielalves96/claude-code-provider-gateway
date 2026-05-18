import { CaretRightOutlined } from "@ant-design/icons";
import type { TableColumnsType } from "antd";
import { Flex, Space, Table, Tag, Tooltip, Typography, theme } from "antd";
import { formatNumber, formatTime } from "../format.js";
import { providerLabel } from "../labels.js";
import type { RequestLogEntry } from "../types.js";
import { RequestDetails } from "./RequestDetails.js";
import { SectionLabel } from "./SectionLabel.js";

const { Text } = Typography;

interface RequestLogTableProps {
  entries: RequestLogEntry[];
}

export function RequestLogTable({ entries }: RequestLogTableProps) {
  const { token } = theme.useToken();

  const columns: TableColumnsType<RequestLogEntry> = [
    {
      title: "Time",
      key: "t",
      width: 90,
      render: (_, e) => (
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {formatTime(e.timestamp)}
        </Text>
      ),
    },
    {
      title: "Requested",
      dataIndex: "requestedModel",
      key: "req",
      ellipsis: true,
      render: (v: string) => (
        <Text
          style={{
            fontFamily: "monospace",
            color: token.colorInfoText,
            fontSize: token.fontSizeSM,
          }}
        >
          {v}
        </Text>
      ),
    },
    {
      title: "Provider model",
      key: "pm",
      ellipsis: true,
      render: (_, e) => (
        <Text style={{ fontFamily: "monospace", fontSize: token.fontSizeSM }}>
          {providerLabel(e.providerId)}/{e.providerModel}
        </Text>
      ),
    },
    {
      title: "Tokens",
      dataIndex: "inputTokens",
      key: "tok",
      width: 80,
      align: "right",
      render: (v: number) => (
        <Text type="secondary" style={{ fontFamily: "monospace", fontSize: token.fontSizeSM }}>
          {formatNumber(v)}
        </Text>
      ),
    },
    {
      title: "Latency",
      dataIndex: "latencyMs",
      key: "lat",
      width: 80,
      align: "right",
      render: (v: number) => (
        <Text type="secondary" style={{ fontFamily: "monospace", fontSize: token.fontSizeSM }}>
          {v}ms
        </Text>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "s",
      width: 70,
      render: (v: string) => (
        <Tag color={v === "ok" ? "success" : "error"} bordered={false} style={{ fontFamily: "monospace" }}>
          {v}
        </Tag>
      ),
    },
    {
      title: "Savers",
      key: "tokenSavers",
      width: 160,
      render: (_, e) => {
        const ts = e.tokenSavers;
        if (!ts)
          return (
            <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              —
            </Text>
          );
        const saved = ts.rtkBytesBefore - ts.rtkBytesAfter;
        const pct = ts.rtkBytesBefore > 0 ? ((saved / ts.rtkBytesBefore) * 100).toFixed(0) : "0";
        return (
          <Space size={4} wrap>
            {ts.rtkHits > 0 && (
              <Tooltip title={`RTK saved ${saved}B (${pct}%) via ${ts.rtkFilters.join(", ")}`}>
                <Tag
                  color="geekblue"
                  bordered={false}
                  style={{
                    margin: 0,
                    fontFamily: "monospace",
                    fontSize: token.fontSizeSM,
                  }}
                >
                  RTK -{pct}%
                </Tag>
              </Tooltip>
            )}
            {ts.cavemanLevel && (
              <Tooltip title={`Caveman ${ts.cavemanLevel} injected into system prompt`}>
                <Tag
                  color="orange"
                  bordered={false}
                  style={{
                    margin: 0,
                    fontFamily: "monospace",
                    fontSize: token.fontSizeSM,
                  }}
                >
                  Caveman ({ts.cavemanLevel})
                </Tag>
              </Tooltip>
            )}
            {ts.rtkHits === 0 && !ts.cavemanLevel && (
              <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                —
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: "Response",
      key: "has_resp",
      width: 90,
      render: (_, e) => (
        <Tag color={e.response ? "success" : "error"} bordered={false} style={{ fontFamily: "monospace" }}>
          {e.response ? "yes" : "no"}
        </Tag>
      ),
    },
    {
      title: "User Input",
      key: "has_user",
      width: 95,
      render: (_, e) => {
        const hasUser = !!e.prompt && e.prompt.toLowerCase().includes("[user]");
        return (
          <Tag color={hasUser ? "success" : "error"} bordered={false} style={{ fontFamily: "monospace" }}>
            {hasUser ? "yes" : "no"}
          </Tag>
        );
      },
    },
    {
      title: "Error",
      dataIndex: "error",
      key: "err",
      ellipsis: true,
      render: (v: string | null) => (
        <Tooltip title={v ?? ""}>
          <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            {v ? v.slice(0, 80) : "—"}
          </Text>
        </Tooltip>
      ),
    },
  ];

  return (
    <Flex vertical gap={token.paddingXS}>
      <Space>
        <SectionLabel>Recent requests</SectionLabel>
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          (last {entries.length})
        </Text>
      </Space>
      <Table<RequestLogEntry>
        dataSource={entries}
        rowKey="id"
        size="small"
        pagination={false}
        columns={columns}
        expandable={{
          rowExpandable: () => true,
          expandedRowRender: (r) => <RequestDetails entry={r} />,
          expandIcon: ({ expanded, onExpand, record }) => (
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: expanded ? token.colorFillSecondary : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onClick={(e) => onExpand(record, e)}
            >
              <CaretRightOutlined
                rotate={expanded ? 90 : 0}
                style={{
                  color: expanded ? token.colorPrimary : token.colorTextSecondary,
                  transition: "transform 0.2s",
                  fontSize: 14,
                }}
              />
            </div>
          ),
        }}
      />
    </Flex>
  );
}
