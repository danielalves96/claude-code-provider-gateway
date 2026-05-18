import { DeleteOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Flex, Space, Typography } from "antd";
import { PageHeader } from "../../../shared/components/PageHeader.js";

const { Text } = Typography;

interface HistoryHeaderProps {
  onRefresh: () => void;
  onRequestClear: () => void;
  canClear: boolean;
  pollIntervalMs: number;
}

export function HistoryHeader({
  onRefresh,
  onRequestClear,
  canClear,
  pollIntervalMs,
}: HistoryHeaderProps) {
  const pollSeconds = Math.round(pollIntervalMs / 1000);

  return (
    <Flex justify="space-between" align="flex-start">
      <Flex vertical gap={2}>
        <PageHeader
          title="History"
          description="Session timeline, routed models, provider stats, and request log."
        />
        <Text type="secondary" style={{ fontSize: 12 }}>
          Auto-refresh every {pollSeconds}s
        </Text>
      </Flex>
      <Space>
        <Button type="dashed" icon={<ReloadOutlined />} onClick={onRefresh}>
          Refresh
        </Button>
        <Button danger type="text" icon={<DeleteOutlined />} disabled={!canClear} onClick={onRequestClear}>
          Clear history
        </Button>
      </Space>
    </Flex>
  );
}
