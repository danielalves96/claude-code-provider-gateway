import { Card, Empty, Flex, Typography, theme } from "antd";
import { useState } from "react";
import { useHistory } from "../hooks/useHistory.js";
import { ClearHistoryModal } from "./ClearHistoryModal.js";
import { HistoryHeader } from "./HistoryHeader.js";
import { HistorySummary } from "./HistorySummary.js";
import { ProvidersTable } from "./ProvidersTable.js";
import { SessionsTable } from "./SessionsTable.js";

const { Text } = Typography;

export default function HistoryPage() {
  const { token } = theme.useToken();
  const {
    sessions,
    totals,
    globalProviderRows,
    expandedKeys,
    toggleExpanded,
    refresh,
    clearArchive,
    clearing,
    canClear,
    pollIntervalMs,
  } = useHistory();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleConfirmClear = async () => {
    await clearArchive();
    setConfirmOpen(false);
  };

  return (
    <Flex vertical gap={token.paddingLG}>
      <HistoryHeader
        onRefresh={refresh}
        onRequestClear={() => setConfirmOpen(true)}
        canClear={canClear}
        pollIntervalMs={pollIntervalMs}
      />

      <HistorySummary
        sessionCount={sessions.length}
        archived={totals.archived}
        totalRequests={totals.requests}
        totalErrors={totals.errors}
      />

      {globalProviderRows.length > 0 && (
        <Card>
          <ProvidersTable rows={globalProviderRows} title="Gateway Providers" />
        </Card>
      )}

      {sessions.length === 0 ? (
        <Card>
          <Empty description={<Text type="secondary">No sessions recorded yet.</Text>} />
        </Card>
      ) : (
        <SessionsTable
          sessions={sessions}
          expandedKeys={expandedKeys}
          onToggleExpanded={toggleExpanded}
        />
      )}

      <ClearHistoryModal
        open={confirmOpen}
        loading={clearing}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirmClear}
      />
    </Flex>
  );
}
