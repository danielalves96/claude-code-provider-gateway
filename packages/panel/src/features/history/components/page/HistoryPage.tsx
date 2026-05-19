import { Card, Col, Empty, Flex, Row, Skeleton, Typography, theme } from "antd";
import { useHistoryPage } from "../../hooks/useHistoryPage.js";
import { ProvidersTable } from "../tables/ProvidersTable.js";
import { SessionsTable } from "../tables/SessionsTable.js";
import { ClearHistoryModal } from "./ClearHistoryModal.js";
import { HistoryHeader } from "./HistoryHeader.js";
import { HistorySummary } from "./HistorySummary.js";
import { HistoryTopStats } from "./HistoryTopStats.js";

const { Text } = Typography;

function HistorySkeletonTopStats() {
  const { token } = theme.useToken();
  return (
    <Row gutter={[token.paddingLG, token.paddingLG]}>
      {[0, 1].map((i) => (
        <Col xs={24} md={12} key={i}>
          <Card styles={{ body: { padding: `${token.paddingLG}px ${token.paddingXL}px` } }}>
            <Flex align="center" gap={token.paddingLG}>
              <Skeleton.Avatar active size={48} shape="circle" />
              <Flex vertical flex={1} gap={8}>
                <Skeleton.Input active size="small" style={{ width: "40%" }} />
                <Skeleton.Input active size="default" style={{ width: "65%" }} />
              </Flex>
            </Flex>
          </Card>
        </Col>
      ))}
    </Row>
  );
}

function HistorySkeletonSummary() {
  const { token } = theme.useToken();
  return (
    <Flex gap={token.paddingSM} wrap="wrap">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ flex: "1 1 150px", minWidth: 0 }}>
          <Card size="small" styles={{ body: { padding: "8px 12px" } }}>
            <Flex align="center" justify="space-between">
              <Flex align="center" gap={6}>
                <Skeleton.Avatar
                  active
                  size="small"
                  shape="circle"
                  style={{ width: 14, height: 14 }}
                />
                <Skeleton.Input active size="small" style={{ width: 80 }} />
              </Flex>
              <Skeleton.Input active size="small" style={{ width: 32 }} />
            </Flex>
          </Card>
        </div>
      ))}
    </Flex>
  );
}

export default function HistoryPage() {
  const { token } = theme.useToken();
  const page = useHistoryPage();

  return (
    <Flex vertical gap={token.paddingLG}>
      <HistoryHeader
        onRefresh={page.refresh}
        onRequestClear={page.openClearConfirm}
        canClear={page.canClear}
        pollIntervalMs={page.pollIntervalMs}
      />

      {page.isLoading ? (
        <HistorySkeletonTopStats />
      ) : (
        <HistoryTopStats topProvider={page.topProviderInfo} topModel={page.topModelInfo} />
      )}

      {page.isLoading ? (
        <HistorySkeletonSummary />
      ) : (
        <HistorySummary
          archived={page.totals.archived}
          totalRequests={page.totals.requests}
          totalErrors={page.totals.errors}
        />
      )}

      {page.isLoading ? (
        <Card>
          <Skeleton active paragraph={{ rows: 4 }} />
        </Card>
      ) : page.sessions.length === 0 ? (
        <Card>
          <Empty description={<Text type="secondary">No sessions recorded yet.</Text>} />
        </Card>
      ) : (
        <>
          {page.globalProviderRows.length > 0 && <ProvidersTable rows={page.globalProviderRows} />}
          <SessionsTable
            sessions={page.sessions}
            expandedKeys={page.expandedKeys}
            onToggleExpanded={page.toggleExpanded}
            onDeleteSession={page.deleteSession}
            deletingId={page.deletingId}
          />
        </>
      )}

      <ClearHistoryModal
        open={page.confirmOpen}
        loading={page.clearing}
        onCancel={page.closeClearConfirm}
        onConfirm={page.confirmClearArchive}
      />
    </Flex>
  );
}
