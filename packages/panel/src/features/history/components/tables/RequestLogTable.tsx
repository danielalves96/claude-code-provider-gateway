import { Flex, Space, Table, Typography, theme } from "antd";
import type { RequestLogEntry } from "../../domain/types.js";
import { RequestDetails } from "../details/RequestDetails.js";
import { useRequestLogColumns } from "./requestLogColumns.js";
import { SectionLabel } from "./SectionLabel.js";
import { TableExpandButton } from "./TableExpandButton.js";

const { Text } = Typography;

interface RequestLogTableProps {
  entries: RequestLogEntry[];
}

export function RequestLogTable({ entries }: RequestLogTableProps) {
  const { token } = theme.useToken();
  const columns = useRequestLogColumns();

  return (
    <Flex vertical gap={token.paddingXS}>
      <Space>
        <SectionLabel>Recent requests</SectionLabel>
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          (last {entries.length})
        </Text>
      </Space>
      <Table<RequestLogEntry>
        dataSource={entries}
        rowKey="id"
        size="small"
        pagination={false}
        columns={columns}
        expandable={{
          rowExpandable: () => true,
          expandedRowRender: (r) => <RequestDetails entry={r} />,
          expandIcon: ({ expanded, onExpand, record }) => (
            <TableExpandButton
              expanded={expanded}
              record={record}
              size={24}
              iconSize={14}
              onExpand={onExpand}
            />
          ),
        }}
      />
    </Flex>
  );
}
