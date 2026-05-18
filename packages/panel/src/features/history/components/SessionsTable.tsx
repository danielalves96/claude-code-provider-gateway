import {
  CaretRightOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import type { TableColumnsType } from "antd";
import { Card, Space, Table, Tag, Typography, theme } from "antd";
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
      width: 130,
      render: (_, s) => {
        if (s.status === "running") {
          return (
            <Tag icon={<SyncOutlined spin />} color="blue" bordered={false}>
              RUNNING
            </Tag>
          );
        }
        if (s.status === "crashed") {
          return (
            <Tag icon={<CloseCircleOutlined />} color="error" bordered={false}>
              CRASHED
            </Tag>
          );
        }
        return (
          <Tag icon={<CheckCircleOutlined />} color="success" bordered={false}>
            COMPLETED
          </Tag>
        );
      },
    },
    {
      title: "Command",
      key: "command",
      ellipsis: true,
      render: (_, s) => (
        <Space direction="vertical" size={4}>
          <Text style={{ fontFamily: "monospace", color: token.colorSuccessText }}>
            {commandFor(s)}
          </Text>
          <Space size="small">
            <Tag
              color="default"
              style={{ margin: 0, border: `1px solid ${token.colorBorderSecondary}` }}
            >
              {s.modelMode === "all" ? "all-providers" : "single"}
            </Tag>
            {s.modelMode !== "all" && (
              <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                {providerLabel(s.activeProvider)}
              </Text>
            )}
          </Space>
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
        <Tag color="blue" bordered={false} style={{ margin: 0, fontFamily: "monospace" }}>
          {v}
        </Tag>
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
          <Tag color="error" bordered={false} style={{ margin: 0, fontFamily: "monospace" }}>
            {v}
          </Tag>
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
            <button
              type="button"
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: expanded ? token.colorFillSecondary : "transparent",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.2s ease",
                padding: 0,
              }}
              onClick={(e) => onExpand(record, e)}
            >
              <CaretRightOutlined
                rotate={expanded ? 90 : 0}
                style={{
                  color: expanded ? token.colorPrimary : token.colorTextSecondary,
                  transition: "transform 0.2s",
                  fontSize: 16,
                }}
              />
            </button>
          ),
        }}
      />
    </Card>
  );
}
