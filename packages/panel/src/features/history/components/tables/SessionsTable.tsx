import { Card, Table, theme } from "antd";
import type { Session } from "../../domain/types.js";
import { SessionDetails } from "../details/SessionDetails.js";
import { getSessionStatusBorderColor, useSessionColumns } from "./sessionColumns.js";
import { TableExpandButton } from "./TableExpandButton.js";

interface SessionsTableProps {
  sessions: Session[];
  expandedKeys: string[];
  onToggleExpanded: (id: string, expanded: boolean) => void;
}

export function SessionsTable({ sessions, expandedKeys, onToggleExpanded }: SessionsTableProps) {
  const { token } = theme.useToken();
  const columns = useSessionColumns();

  return (
    <Card styles={{ body: { padding: 0 } }}>
      <Table<Session>
        dataSource={sessions}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={false}
        onRow={(record) => ({
          style: {
            borderLeft: `3px solid ${getSessionStatusBorderColor(record.status, token)}`,
          },
        })}
        expandable={{
          expandedRowKeys: expandedKeys,
          onExpand: (expanded, record) => onToggleExpanded(record.id, expanded),
          expandedRowRender: (record) => <SessionDetails session={record} />,
          expandIcon: ({ expanded, onExpand, record }) => (
            <TableExpandButton expanded={expanded} record={record} onExpand={onExpand} />
          ),
        }}
      />
    </Card>
  );
}
