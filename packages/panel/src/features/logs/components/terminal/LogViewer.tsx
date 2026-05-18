import { VerticalAlignBottomOutlined } from "@ant-design/icons";
import { Button, Flex, Tag, Typography, theme } from "antd";
import {
  getLogLevelColor,
  getLogLineBackground,
  parseLogLine,
} from "../../domain/logPresentation.js";
import { useLogViewerScroll } from "../../hooks/useLogViewerScroll.js";
import { detectLogLevel } from "../../hooks/useServerLogs.js";

const { Text } = Typography;

interface LogViewerProps {
  logs: string[];
  paused: boolean;
  wrapLines: boolean;
  showLineNumbers: boolean;
}

export function LogViewer({ logs, paused, wrapLines, showLineNumbers }: LogViewerProps) {
  const { token } = theme.useToken();
  const { containerRef, isAtBottom, handleScroll, scrollToBottom } = useLogViewerScroll({
    lineCount: logs.length,
    paused,
  });

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          height: "100%",
          overflowY: "auto",
          padding: `${token.paddingSM}px`,
          background: "#0d0d0d",
          fontFamily: token.fontFamilyCode,
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        {logs.length === 0 ? (
          <Text style={{ opacity: 0.4, color: "#a0a0a0" }}>Waiting for log activity…</Text>
        ) : (
          logs.map((line, i) => (
            <LogLine
              key={i}
              line={line}
              index={i}
              showLineNumber={showLineNumbers}
              wrap={wrapLines}
            />
          ))
        )}
      </div>

      {!isAtBottom && (
        <Button
          aria-label="Scroll to bottom"
          icon={<VerticalAlignBottomOutlined />}
          onClick={scrollToBottom}
          type="primary"
          shape="circle"
          size="large"
          style={{
            position: "absolute",
            bottom: 24,
            right: 24,
            boxShadow: token.boxShadow,
            background: token.colorPrimary,
            border: "none",
          }}
        />
      )}
    </div>
  );
}

function LogLine({
  line,
  index,
  showLineNumber,
  wrap,
}: {
  line: string;
  index: number;
  showLineNumber: boolean;
  wrap: boolean;
}) {
  const { token } = theme.useToken();
  const level = detectLogLevel(line);
  const parsed = parseLogLine(line);

  return (
    <Flex
      gap={8}
      style={{
        minHeight: 22,
        padding: "2px 8px",
        borderRadius: 4,
        background: getLogLineBackground(level),
        marginBottom: 2,
        transition: "background 0.2s ease",
      }}
    >
      {showLineNumber && (
        <span
          style={{
            minWidth: 44,
            textAlign: "right",
            userSelect: "none",
            color: "#4a4a4a",
            fontFamily: token.fontFamilyCode,
            fontSize: 12,
            flexShrink: 0,
            paddingRight: 12,
            borderRight: "1px solid #2a2a2a",
            marginRight: 4,
          }}
        >
          {index + 1}
        </span>
      )}

      <div
        style={{
          whiteSpace: wrap ? "pre-wrap" : "pre",
          wordBreak: wrap ? "break-all" : undefined,
          fontFamily: token.fontFamilyCode,
          fontSize: 13,
          color: "#d4d4d4",
          flex: 1,
        }}
      >
        {parsed.time && (
          <>
            <span style={{ color: "#6e7681", marginRight: 8 }}>{parsed.time}</span>
            <Tag
              color={getLogLevelColor(parsed.level ?? "")}
              bordered={false}
              style={{
                fontFamily: token.fontFamilyCode,
                fontSize: 11,
                lineHeight: "16px",
                padding: "0 4px",
                marginRight: 8,
                minWidth: 46,
                textAlign: "center",
              }}
            >
              {parsed.level}
            </Tag>
            <span style={{ color: "#3fb950", marginRight: 8 }}>[{parsed.module}]</span>
            <span
              style={{
                color:
                  level === "error"
                    ? token.colorError
                    : level === "warn"
                      ? token.colorWarning
                      : "#d4d4d4",
              }}
            >
              {parsed.message}
            </span>
          </>
        )}
        {!parsed.time && (
          <span
            style={{
              color:
                level === "error"
                  ? token.colorError
                  : level === "warn"
                    ? token.colorWarning
                    : "#d4d4d4",
            }}
          >
            {parsed.message}
          </span>
        )}
      </div>
    </Flex>
  );
}
