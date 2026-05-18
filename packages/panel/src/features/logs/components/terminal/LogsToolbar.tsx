import {
  AlignLeftOutlined,
  ClearOutlined,
  DownloadOutlined,
  NumberOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import { Button, Flex, Input, Select, Space, Tag, Tooltip, theme } from "antd";
import type { LogLevel } from "../../hooks/useServerLogs.js";

const LEVEL_OPTIONS: Array<{ value: LogLevel; label: string }> = [
  { value: "all", label: "All levels" },
  { value: "error", label: "Errors only" },
  { value: "warn", label: "Warnings only" },
  { value: "info", label: "Info only" },
  { value: "debug", label: "Debug only" },
];

interface LogsToolbarProps {
  search: string;
  levelFilter: LogLevel;
  matchCount: number;
  paused: boolean;
  wrapLines: boolean;
  showLineNumbers: boolean;
  hasLogs: boolean;
  onSearchChange: (value: string) => void;
  onLevelFilterChange: (value: LogLevel) => void;
  onTogglePaused: () => void;
  onToggleWrap: () => void;
  onToggleLineNumbers: () => void;
  onClear: () => void;
  onDownload: () => void;
}

export function LogsToolbar({
  search,
  levelFilter,
  matchCount,
  paused,
  wrapLines,
  showLineNumbers,
  hasLogs,
  onSearchChange,
  onLevelFilterChange,
  onTogglePaused,
  onToggleWrap,
  onToggleLineNumbers,
  onClear,
  onDownload,
}: LogsToolbarProps) {
  const { token } = theme.useToken();
  const isFiltered = search.trim() !== "" || levelFilter !== "all";

  return (
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
          onChange={(event) => onSearchChange(event.target.value)}
          allowClear
          style={{ width: 280 }}
        />
        <Select
          value={levelFilter}
          onChange={onLevelFilterChange}
          options={LEVEL_OPTIONS}
          style={{ width: 150 }}
        />
        {isFiltered && (
          <Tag
            color="blue"
            closable
            onClose={() => {
              onSearchChange("");
              onLevelFilterChange("all");
            }}
            style={{ margin: 0 }}
          >
            {matchCount} match{matchCount !== 1 ? "es" : ""}
          </Tag>
        )}
      </Space>

      <Space>
        <Space.Compact>
          <Tooltip title="Toggle line numbers">
            <Button
              aria-label="Toggle line numbers"
              aria-pressed={showLineNumbers}
              icon={<NumberOutlined />}
              onClick={onToggleLineNumbers}
              type={showLineNumbers ? "primary" : "default"}
            />
          </Tooltip>
          <Tooltip title="Toggle word wrap">
            <Button
              aria-label="Toggle word wrap"
              aria-pressed={wrapLines}
              icon={<AlignLeftOutlined />}
              onClick={onToggleWrap}
              type={wrapLines ? "primary" : "default"}
            />
          </Tooltip>
        </Space.Compact>

        <Space.Compact>
          <Button
            aria-label={paused ? "Resume log" : "Pause log"}
            aria-pressed={paused}
            icon={paused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
            onClick={onTogglePaused}
            danger={paused}
            type={paused ? "primary" : "default"}
          >
            {paused ? "Resume" : "Pause"}
          </Button>
          <Tooltip title="Clear log buffer">
            <Button aria-label="Clear log buffer" icon={<ClearOutlined />} onClick={onClear} />
          </Tooltip>
        </Space.Compact>

        <Tooltip title="Download full log buffer as .log file">
          <Button icon={<DownloadOutlined />} onClick={onDownload} disabled={!hasLogs}>
            Download
          </Button>
        </Tooltip>
      </Space>
    </Flex>
  );
}
