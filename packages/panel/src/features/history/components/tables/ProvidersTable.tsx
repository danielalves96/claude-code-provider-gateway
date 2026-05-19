import { Flex, Table } from "antd";
import { getProviderStatsColumns, type ProviderStatsRow } from "./providerStatsColumns.js";
import { SectionLabel } from "./SectionLabel.js";

interface ProvidersTableProps {
  rows: ProviderStatsRow[];
  title?: string;
}

export function ProvidersTable({ rows, title = "Providers" }: ProvidersTableProps) {
  const columns = getProviderStatsColumns();

  return (
    <Flex vertical gap={4}>
      <SectionLabel>{title}</SectionLabel>
      <Table<ProviderStatsRow>
        dataSource={rows}
        rowKey={([id]) => id}
        size="small"
        pagination={false}
        columns={columns}
      />
    </Flex>
  );
}
