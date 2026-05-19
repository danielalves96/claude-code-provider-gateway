import { Flex, Table, theme } from "antd";
import type { RequestLogEntry } from "../../domain/types.js";
import { RequestDetails } from "../details/RequestDetails.js";
import { useRequestLogColumns } from "./requestLogColumns.js";
import { SectionLabel } from "./SectionLabel.js";
import { TableExpandButton } from "./TableExpandButton.js";

const PAGE_SIZE = 50;

interface RequestLogTableProps {
  entries: RequestLogEntry[];
}

export function RequestLogTable({ entries }: RequestLogTableProps) {
  const { token } = theme.useToken();
  const columns = useRequestLogColumns();

  return (
    <Flex vertical gap={token.paddingXS}>
      <SectionLabel>Requests ({entries.length})</SectionLabel>
      <Table<RequestLogEntry>
        dataSource={entries}
        rowKey="id"
        size="small"
        pagination={
          entries.length > PAGE_SIZE
            ? {
                pageSize: PAGE_SIZE,
                showSizeChanger: false,
                showTotal: (total) => `${total} requests`,
              }
            : false
        }
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
