import { Card, Table, theme } from "antd";
import type { Session } from "../../domain/types.js";
import { SessionDetails } from "../details/SessionDetails.js";
import { getSessionStatusBorderColor, useSessionColumns } from "./sessionColumns.js";
import { TableExpandButton } from "./TableExpandButton.js";

const PAGE_SIZE = 15;

interface SessionsTableProps {
  sessions: Session[];
  expandedKeys: string[];
  onToggleExpanded: (id: string, expanded: boolean) => void;
  onDeleteSession: (id: string) => void;
  deletingId: string | null;
}

export function SessionsTable({
  sessions,
  expandedKeys,
  onToggleExpanded,
  onDeleteSession,
  deletingId,
}: SessionsTableProps) {
  const { token } = theme.useToken();
  const columns = useSessionColumns({ onDelete: onDeleteSession, deletingId });

  return (
    <Card styles={{ body: { padding: 0 } }}>
      <Table<Session>
        dataSource={sessions}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={
          sessions.length > PAGE_SIZE ? { pageSize: PAGE_SIZE, showSizeChanger: false } : false
        }
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
