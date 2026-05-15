import { CaretRightOutlined } from "@ant-design/icons";
import type { TableColumnsType } from "antd";
import { Badge, Card, Space, Table, Typography, theme } from "antd";
import { formatUptime } from "../../../shared/utils/time.js";
import { commandFor, formatDate, topModel } from "../format.js";
import { providerLabel } from "../labels.js";
import type { Session } from "../types.js";
import { SessionDetails } from "./SessionDetails.js";

const { Text } = Typography;

interface SessionsTableProps {
  sessions: Session[];
  expandedKeys: string[];
  onToggleExpanded: (id: string, expanded: boolean) => void;
}

export function SessionsTable({ sessions, expandedKeys, onToggleExpanded }: SessionsTableProps) {
  const { token } = theme.useToken();

  const columns: TableColumnsType<Session> = [
    {
      title: "Status",
      key: "status",
      width: 110,
      render: (_, s) => (
        <Badge
          status={
            s.status === "running" ? "processing" : s.status === "crashed" ? "error" : "default"
          }
          text={s.status}
        />
      ),
    },
    {
      title: "Command",
      key: "command",
      ellipsis: true,
      render: (_, s) => (
        <Space direction="vertical" size={2}>
          <Text style={{ fontFamily: "monospace", color: token.colorSuccessText }}>
            {commandFor(s)}
          </Text>
          <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            {s.modelMode === "all" ? "all-providers" : `single: ${providerLabel(s.activeProvider)}`}
          </Text>
        </Space>
      ),
    },
    {
      title: "Top model",
      key: "model",
      ellipsis: true,
      render: (_, s) => {
        const top = topModel(s);
        return top ? (
          <Text
            style={{
              fontFamily: "monospace",
              color: token.colorInfoText,
              fontSize: token.fontSizeSM,
            }}
          >
            {top}
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        );
      },
    },
    {
      title: "Started",
      key: "started",
      width: 160,
      render: (_, s) => <Text type="secondary">{formatDate(s.startedAt)}</Text>,
    },
    {
      title: "Duration",
      key: "duration",
      width: 90,
      render: (_, s) => (
        <Text style={{ fontFamily: "monospace" }}>{formatUptime(s.durationMs)}</Text>
      ),
    },
    {
      title: "Requests",
      dataIndex: "totalRequests",
      key: "requests",
      width: 90,
      align: "right",
      render: (v: number) => (
        <Text strong style={{ fontFamily: "monospace" }}>
          {v}
        </Text>
      ),
    },
    {
      title: "Errors",
      dataIndex: "totalErrors",
      key: "errors",
      width: 75,
      align: "right",
      render: (v: number) =>
        v > 0 ? (
          <Text type="danger" strong style={{ fontFamily: "monospace" }}>
            {v}
          </Text>
        ) : (
          <Text type="secondary" style={{ fontFamily: "monospace" }}>
            0
          </Text>
        ),
    },
  ];

  return (
    <Card styles={{ body: { padding: 0 } }}>
      <Table<Session>
        dataSource={sessions}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={false}
        onRow={(record) => ({
          style: {
            borderLeft: `3px solid ${
              record.status === "running"
                ? token.colorPrimary
                : record.status === "crashed"
                  ? token.colorError
                  : "transparent"
            }`,
          },
        })}
        expandable={{
          expandedRowKeys: expandedKeys,
          onExpand: (expanded, record) => onToggleExpanded(record.id, expanded),
          expandedRowRender: (record) => <SessionDetails session={record} />,
          expandIcon: ({ expanded, onExpand, record }) => (
            <CaretRightOutlined
              rotate={expanded ? 90 : 0}
              style={{ cursor: "pointer", transition: "transform 0.15s" }}
              onClick={(e) => onExpand(record, e)}
            />
          ),
        }}
      />
    </Card>
  );
}
