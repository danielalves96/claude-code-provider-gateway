import type { TableColumnsType } from "antd";
import { Space, Tag, Tooltip, Typography, theme } from "antd";
import { formatNumber, formatTime } from "../../domain/format.js";
import { providerLabel } from "../../domain/labels.js";
import type { RequestLogEntry } from "../../domain/types.js";

const { Text } = Typography;

export function useRequestLogColumns(): TableColumnsType<RequestLogEntry> {
  const { token } = theme.useToken();

  return [
    {
      title: "Time",
      key: "t",
      width: 90,
      render: (_, entry) => (
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {formatTime(entry.timestamp)}
        </Text>
      ),
    },
    {
      title: "Requested",
      dataIndex: "requestedModel",
      key: "req",
      ellipsis: true,
      render: (value: string) => <ModelText value={value} color={token.colorInfoText} />,
    },
    {
      title: "Provider model",
      key: "pm",
      ellipsis: true,
      render: (_, entry) => (
        <ModelText value={`${providerLabel(entry.providerId)}/${entry.providerModel}`} />
      ),
    },
    {
      title: "Tokens",
      dataIndex: "inputTokens",
      key: "tok",
      width: 80,
      align: "right",
      render: (value: number) => <MutedMonoText value={formatNumber(value)} />,
    },
    {
      title: "Latency",
      dataIndex: "latencyMs",
      key: "lat",
      width: 80,
      align: "right",
      render: (value: number) => <MutedMonoText value={`${value}ms`} />,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "s",
      width: 70,
      render: (value: RequestLogEntry["status"]) => (
        <BooleanTag color={value === "ok" ? "success" : "error"} label={value} />
      ),
    },
    {
      title: "Savers",
      key: "tokenSavers",
      width: 160,
      render: (_, entry) => <TokenSaversCell entry={entry} />,
    },
    {
      title: "Response",
      key: "has_resp",
      width: 90,
      render: (_, entry) => <YesNoTag active={!!entry.response} />,
    },
    {
      title: "Preview",
      key: "has_preview",
      width: 85,
      render: (_, entry) => <YesNoTag active={!!entry.requestPreview} />,
    },
    {
      title: "Warnings",
      key: "warnings",
      width: 95,
      render: (_, entry) => <WarningsCell entry={entry} />,
    },
    {
      title: "User Input",
      key: "has_user",
      width: 95,
      render: (_, entry) => <YesNoTag active={hasUserInput(entry)} />,
    },
    {
      title: "Error",
      dataIndex: "error",
      key: "err",
      ellipsis: true,
      render: (value: string | null) => <ErrorText value={value} />,
    },
  ];
}

function WarningsCell({ entry }: { entry: RequestLogEntry }) {
  const warnings = entry.warnings ?? [];
  if (warnings.length === 0) return <EmptyCell />;
  return (
    <Tooltip title={warnings.map((warning) => warning.message).join("\n")}>
      <Tag color="warning" bordered={false} style={{ fontFamily: "monospace", margin: 0 }}>
        {warnings.length}
      </Tag>
    </Tooltip>
  );
}

function ModelText({ value, color }: { value: string; color?: string }) {
  const { token } = theme.useToken();

  return (
    <Text
      style={{
        fontFamily: "monospace",
        color,
        fontSize: token.fontSizeSM,
      }}
    >
      {value}
    </Text>
  );
}

function MutedMonoText({ value }: { value: string }) {
  const { token } = theme.useToken();

  return (
    <Text type="secondary" style={{ fontFamily: "monospace", fontSize: token.fontSizeSM }}>
      {value}
    </Text>
  );
}

function TokenSaversCell({ entry }: { entry: RequestLogEntry }) {
  const tokenSavers = entry.tokenSavers;

  if (!tokenSavers) return <EmptyCell />;

  const savedBytes = tokenSavers.rtkBytesBefore - tokenSavers.rtkBytesAfter;
  const savedPercent = getSavedPercent(tokenSavers.rtkBytesBefore, savedBytes);
  const hasRtkSavings = tokenSavers.rtkHits > 0;
  const hasCavemanLevel = !!tokenSavers.cavemanLevel;

  if (!hasRtkSavings && !hasCavemanLevel) return <EmptyCell />;

  return (
    <Space size={4} wrap>
      {hasRtkSavings && (
        <Tooltip
          title={`RTK saved ${savedBytes}B (${savedPercent}%) via ${tokenSavers.rtkFilters.join(
            ", ",
          )}`}
        >
          <SaversTag color="geekblue">RTK -{savedPercent}%</SaversTag>
        </Tooltip>
      )}
      {hasCavemanLevel && (
        <Tooltip title={`Caveman ${tokenSavers.cavemanLevel} injected into system prompt`}>
          <SaversTag color="orange">Caveman ({tokenSavers.cavemanLevel})</SaversTag>
        </Tooltip>
      )}
    </Space>
  );
}

function SaversTag({ color, children }: { color: string; children: React.ReactNode }) {
  const { token } = theme.useToken();

  return (
    <Tag
      color={color}
      bordered={false}
      style={{
        margin: 0,
        fontFamily: "monospace",
        fontSize: token.fontSizeSM,
      }}
    >
      {children}
    </Tag>
  );
}

function YesNoTag({ active }: { active: boolean }) {
  return <BooleanTag color={active ? "success" : "error"} label={active ? "yes" : "no"} />;
}

function BooleanTag({ color, label }: { color: string; label: string }) {
  return (
    <Tag color={color} bordered={false} style={{ fontFamily: "monospace" }}>
      {label}
    </Tag>
  );
}

function ErrorText({ value }: { value: string | null }) {
  const { token } = theme.useToken();

  return (
    <Tooltip title={value ?? ""}>
      <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
        {value ? value.slice(0, 80) : "—"}
      </Text>
    </Tooltip>
  );
}

function EmptyCell() {
  const { token } = theme.useToken();

  return (
    <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
      —
    </Text>
  );
}

function hasUserInput(entry: RequestLogEntry): boolean {
  return !!entry.prompt && entry.prompt.toLowerCase().includes("[user]");
}

function getSavedPercent(bytesBefore: number, savedBytes: number): string {
  if (bytesBefore <= 0) return "0";
  return ((savedBytes / bytesBefore) * 100).toFixed(0);
}
