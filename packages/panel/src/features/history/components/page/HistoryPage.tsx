import { Card, Empty, Flex, Typography, theme } from "antd";
import { useHistoryPage } from "../../hooks/useHistoryPage.js";
import { ProvidersTable } from "../tables/ProvidersTable.js";
import { SessionsTable } from "../tables/SessionsTable.js";
import { ClearHistoryModal } from "./ClearHistoryModal.js";
import { HistoryHeader } from "./HistoryHeader.js";
import { HistorySummary } from "./HistorySummary.js";
import { HistoryTopStats } from "./HistoryTopStats.js";

const { Text } = Typography;

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

      <HistoryTopStats topProvider={page.topProviderInfo} topModel={page.topModelInfo} />

      <HistorySummary
        sessionCount={page.sessions.length}
        archived={page.totals.archived}
        totalRequests={page.totals.requests}
        totalErrors={page.totals.errors}
      />

      {page.globalProviderRows.length > 0 && (
        <Card>
          <ProvidersTable rows={page.globalProviderRows} title="Gateway Providers" />
        </Card>
      )}

      {page.sessions.length === 0 ? (
        <Card>
          <Empty description={<Text type="secondary">No sessions recorded yet.</Text>} />
        </Card>
      ) : (
        <SessionsTable
          sessions={page.sessions}
          expandedKeys={page.expandedKeys}
          onToggleExpanded={page.toggleExpanded}
        />
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
