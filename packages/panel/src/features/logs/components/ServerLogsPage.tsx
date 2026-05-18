import {
  AlignLeftOutlined,
  ClearOutlined,
  DownloadOutlined,
  NumberOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import {
  Badge,
  Button,
  Card,
  Flex,
  Input,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  theme,
} from "antd";
import { PageHeader } from "../../../shared/components/PageHeader.js";
import { useServerLogs } from "../hooks/useServerLogs.js";
import { LogsSummary } from "./LogsSummary.js";
import { LogViewer } from "./LogViewer.js";

const { Text } = Typography;

const LEVEL_OPTIONS = [
  { value: "all", label: "All levels" },
  { value: "error", label: "Errors only" },
  { value: "warn", label: "Warnings only" },
  { value: "info", label: "Info only" },
  { value: "debug", label: "Debug only" },
];

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

  const isFiltered = search.trim() !== "" || levelFilter !== "all";
  const pageHeight = `calc(100vh - 56px - ${token.paddingLG * 2}px)`;

  return (
    <Flex vertical gap={token.paddingLG} style={{ height: pageHeight }}>
      {/* Header */}
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

      {/* KPI Cards */}
      <LogsSummary
        totalLines={logs.length}
        errors={stats.errors}
        warns={stats.warns}
        infos={stats.infos}
        debugs={stats.debugs}
      />

      {/* Terminal Console */}
      <Card
        styles={{ body: { padding: 0 } }}
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderColor: token.colorBorderSecondary,
          background: "#0d0d0d", // Match inner terminal background
          boxShadow: token.boxShadow,
        }}
      >
        {/* Terminal Header / Toolbar */}
        <Flex
          gap={token.paddingSM}
          align="center"
          justify="space-between"
          wrap="wrap"
          style={{
            padding: `${token.paddingXS}px ${token.paddingSM}px`,
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            borderTopLeftRadius: token.borderRadiusLG,
            borderTopRightRadius: token.borderRadiusLG,
          }}
        >
          <Space>
            <Input.Search
              placeholder="Search logs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              style={{ width: 280 }}
            />
            <Select
              value={levelFilter}
              onChange={setLevelFilter}
              options={LEVEL_OPTIONS}
              style={{ width: 150 }}
            />
            {isFiltered && (
              <Tag
                color="blue"
                closable
                onClose={() => {
                  setSearch("");
                  setLevelFilter("all");
                }}
                style={{ margin: 0 }}
              >
                {filteredLogs.length} match{filteredLogs.length !== 1 ? "es" : ""}
              </Tag>
            )}
          </Space>

          <Space>
            <Space.Compact>
              <Tooltip title="Toggle line numbers">
                <Button
                  icon={<NumberOutlined />}
                  onClick={toggleLineNumbers}
                  type={showLineNumbers ? "primary" : "default"}
                />
              </Tooltip>
              <Tooltip title="Toggle word wrap">
                <Button
                  icon={<AlignLeftOutlined />}
                  onClick={toggleWrap}
                  type={wrapLines ? "primary" : "default"}
                />
              </Tooltip>
            </Space.Compact>

            <Space.Compact>
              <Button
                icon={paused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
                onClick={togglePaused}
                danger={paused}
                type={paused ? "primary" : "default"}
              >
                {paused ? "Resume" : "Pause"}
              </Button>
              <Tooltip title="Clear log buffer">
                <Button icon={<ClearOutlined />} onClick={clear} />
              </Tooltip>
            </Space.Compact>

            <Tooltip title="Download full log buffer as .log file">
              <Button
                icon={<DownloadOutlined />}
                onClick={downloadLogs}
                disabled={logs.length === 0}
              >
                Download
              </Button>
            </Tooltip>
          </Space>
        </Flex>

        {/* Inner Log Viewer */}
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
