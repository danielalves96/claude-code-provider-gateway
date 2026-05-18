import { Descriptions, Flex, Tag, Typography, theme } from "antd";
import type { RequestLogEntry } from "../../domain/types.js";
import { SectionLabel } from "../tables/SectionLabel.js";

const { Text } = Typography;

interface RequestDetailsProps {
  entry: RequestLogEntry;
}

export function RequestDetails({ entry: r }: RequestDetailsProps) {
  const { token } = theme.useToken();

  return (
    <Flex
      vertical
      gap={token.paddingLG}
      style={{ padding: `${token.paddingSM}px ${token.paddingLG}px` }}
    >
      <Descriptions size="small" column={2} bordered>
        <Descriptions.Item label="ID">{r.id}</Descriptions.Item>
        <Descriptions.Item label="Timestamp">
          {new Date(r.timestamp).toLocaleString()}
        </Descriptions.Item>
        <Descriptions.Item label="Requested Model">{r.requestedModel}</Descriptions.Item>
        <Descriptions.Item label="Provider">{r.providerId}</Descriptions.Item>
        <Descriptions.Item label="Provider Model">{r.providerModel}</Descriptions.Item>
        <Descriptions.Item label="Input Tokens">{r.inputTokens}</Descriptions.Item>
        <Descriptions.Item label="Latency (ms)">{r.latencyMs}</Descriptions.Item>
        <Descriptions.Item label="Status">
          <Tag color={r.status === "ok" ? "success" : "error"} style={{ margin: 0 }}>
            {r.status}
          </Tag>
        </Descriptions.Item>
        {r.error && (
          <Descriptions.Item label="Error" span={2}>
            <Text type="danger">{r.error}</Text>
          </Descriptions.Item>
        )}
      </Descriptions>

      {r.prompt && <CodeBlock label="Prompt" content={r.prompt} />}
      {r.response && <CodeBlock label="Response" content={r.response} />}
    </Flex>
  );
}

interface CodeBlockProps {
  label: string;
  content: string;
}

function CodeBlock({ label, content }: CodeBlockProps) {
  const { token } = theme.useToken();
  return (
    <Flex vertical gap={4}>
      <SectionLabel>{label}</SectionLabel>
      <Text
        style={{
          fontFamily: "monospace",
          fontSize: token.fontSizeSM,
          whiteSpace: "pre-wrap",
          background: token.colorFillSecondary,
          padding: token.paddingSM,
          borderRadius: token.borderRadiusSM,
          maxHeight: 300,
          overflow: "auto",
        }}
      >
        {content}
      </Text>
    </Flex>
  );
}
