import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Badge, Button, Card, Empty, Flex, Skeleton, Tag, Typography, theme } from "antd";
import { MetricSummaryGrid } from "../../../shared/components/MetricSummaryGrid.js";
import { PageHeader } from "../../../shared/components/PageHeader.js";
import { formatUptime } from "../../../shared/utils/time.js";
import { SessionMetadataCards } from "../../history/components/details/SessionMetadataCards.js";
import { ModelsUsedTable } from "../../history/components/tables/ModelsUsedTable.js";
import { ProvidersTable } from "../../history/components/tables/ProvidersTable.js";
import { RequestLogTable } from "../../history/components/tables/RequestLogTable.js";
import { useLiveSession } from "../hooks/useLiveSession.js";

const { Text } = Typography;

export default function LiveSessionPage() {
  const { token } = theme.useToken();
  const { session, isLoading, refresh, pollIntervalMs } = useLiveSession();

  const pollSeconds = Math.round(pollIntervalMs / 1000);

  const requestLog = session ? [...(session.requestLog ?? [])].reverse() : [];
  const usedModels = session
    ? Object.entries(session.modelStats ?? {}).sort(([, a], [, b]) => b.requests - a.requests)
    : [];
  const providerRows = session
    ? Object.entries(session.providerStats ?? {})
        .filter(([, s]) => s.requests > 0)
        .sort(([, a], [, b]) => b.requests - a.requests)
        .map(([id, stat]) => [id, stat] as const)
    : [];

  const avgLatencyMs =
    session && requestLog.length > 0
      ? Math.round(requestLog.reduce((sum, r) => sum + r.latencyMs, 0) / requestLog.length)
      : 0;

  return (
    <Flex vertical gap={token.paddingLG}>
      {/* Header */}
      <Flex justify="space-between" align="flex-start">
        <Flex vertical gap={2}>
          <Flex align="center" gap={token.paddingSM}>
            <PageHeader title="Live Session" />
            {!isLoading &&
              (session ? (
                <Badge
                  status="processing"
                  text={
                    <Tag
                      color="blue"
                      bordered={false}
                      icon={<ThunderboltOutlined />}
                      style={{ margin: 0 }}
                    >
                      RUNNING
                    </Tag>
                  }
                />
              ) : (
                <Tag bordered={false} style={{ margin: 0, color: token.colorTextSecondary }}>
                  IDLE
                </Tag>
              ))}
          </Flex>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Auto-refresh every {pollSeconds}s
          </Text>
        </Flex>
        <Button type="dashed" icon={<ReloadOutlined />} onClick={refresh}>
          Refresh
        </Button>
      </Flex>

      {/* Loading */}
      {isLoading ? (
        <Card>
          <Skeleton active paragraph={{ rows: 4 }} />
        </Card>
      ) : !session ? (
        /* Empty state */
        <Card>
          <Empty
            description={
              <Flex vertical align="center" gap={token.paddingXS}>
                <Text type="secondary">No active session</Text>
                <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                  Start the gateway to see the live session here.
                </Text>
              </Flex>
            }
          />
        </Card>
      ) : (
        <>
          {/* Metrics */}
          <MetricSummaryGrid
            items={[
              {
                id: "requests",
                title: "Requests",
                value: session.totalRequests,
                icon: <CheckCircleOutlined />,
                color: token.colorSuccess,
                active: session.totalRequests > 0,
              },
              {
                id: "errors",
                title: "Errors",
                value: session.totalErrors,
                icon: <WarningOutlined />,
                color: token.colorError,
                active: session.totalErrors > 0,
              },
              {
                id: "duration",
                title: "Duration",
                value: Math.round(session.durationMs / 1000),
                icon: <ClockCircleOutlined />,
                color: token.colorPrimary,
                active: session.durationMs > 0,
              },
              {
                id: "latency",
                title: "Avg Latency (ms)",
                value: avgLatencyMs,
                icon: <ThunderboltOutlined />,
                color: token.colorWarning,
                active: avgLatencyMs > 0,
              },
            ]}
          />

          {/* Session metadata */}
          <SessionMetadataCards session={session} />

          {/* Provider stats */}
          {providerRows.length > 0 && (
            <Card size="small" styles={{ body: { padding: token.padding } }}>
              <ProvidersTable rows={providerRows} title="Session Providers" />
            </Card>
          )}

          {/* Models used */}
          {usedModels.length > 0 && (
            <Card size="small" styles={{ body: { padding: token.padding } }}>
              <ModelsUsedTable rows={usedModels} />
            </Card>
          )}

          {/* Request log */}
          {requestLog.length > 0 ? (
            <Card size="small" styles={{ body: { padding: token.padding } }}>
              <RequestLogTable entries={requestLog} />
            </Card>
          ) : (
            <Card size="small">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<Text type="secondary">No requests yet</Text>}
              />
            </Card>
          )}

          {/* Session ID footer */}
          <Flex justify="space-between" align="center">
            <Text
              type="secondary"
              style={{ fontFamily: "monospace", fontSize: token.fontSizeSM - 1 }}
            >
              session id: {session.id}
            </Text>
            <Text
              type="secondary"
              style={{ fontFamily: "monospace", fontSize: token.fontSizeSM - 1 }}
            >
              uptime: {formatUptime(session.durationMs)}
            </Text>
          </Flex>
        </>
      )}
    </Flex>
  );
}
