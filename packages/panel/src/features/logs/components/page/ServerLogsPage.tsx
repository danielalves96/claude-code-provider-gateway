import { Badge, Card, Flex, Typography, theme } from "antd";
import { PageHeader } from "../../../../shared/components/PageHeader.js";
import { useServerLogs } from "../../hooks/useServerLogs.js";
import { LogsSummary } from "../summary/LogsSummary.js";
import { LogsToolbar } from "../terminal/LogsToolbar.js";
import { LogViewer } from "../terminal/LogViewer.js";

const { Text } = Typography;

export default function ServerLogsPage() {
  const { token } = theme.useToken();
  const {
    logs,
    filteredLogs,
    stats,
    paused,
    togglePaused,
    clear,
    search,
    setSearch,
    levelFilter,
    setLevelFilter,
    wrapLines,
    toggleWrap,
    showLineNumbers,
    toggleLineNumbers,
    downloadLogs,
  } = useServerLogs();

  const pageHeight = `calc(100vh - 56px - ${token.paddingLG * 2}px)`;

  return (
    <Flex vertical gap={token.paddingLG} style={{ height: pageHeight }}>
      <Flex justify="space-between" align="center">
        <PageHeader
          title="Server Logs"
          description="Real-time gateway log stream — up to 5,000 lines buffered"
        />
        <Badge
          status={paused ? "warning" : "processing"}
          text={
            <Text type="secondary" style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>
              {paused ? "PAUSED" : "LIVE"}
            </Text>
          }
        />
      </Flex>

      <LogsSummary
        totalLines={logs.length}
        errors={stats.errors}
        warns={stats.warns}
        infos={stats.infos}
        debugs={stats.debugs}
      />

      <Card
        styles={{ body: { padding: 0 } }}
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderColor: token.colorBorderSecondary,
          background: "#0d0d0d",
          boxShadow: token.boxShadow,
        }}
      >
        <LogsToolbar
          search={search}
          levelFilter={levelFilter}
          matchCount={filteredLogs.length}
          paused={paused}
          wrapLines={wrapLines}
          showLineNumbers={showLineNumbers}
          hasLogs={logs.length > 0}
          onSearchChange={setSearch}
          onLevelFilterChange={setLevelFilter}
          onTogglePaused={togglePaused}
          onToggleWrap={toggleWrap}
          onToggleLineNumbers={toggleLineNumbers}
          onClear={clear}
          onDownload={downloadLogs}
        />
        <LogViewer
          logs={filteredLogs}
          paused={paused}
          wrapLines={wrapLines}
          showLineNumbers={showLineNumbers}
        />
      </Card>
    </Flex>
  );
}
