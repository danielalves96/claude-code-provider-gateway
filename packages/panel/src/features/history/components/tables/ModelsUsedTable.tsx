import { Flex, Table, theme } from "antd";
import { type ModelStatsRow, useModelStatsColumns } from "./modelStatsColumns.js";
import { SectionLabel } from "./SectionLabel.js";

interface ModelsUsedTableProps {
  rows: ModelStatsRow[];
}

export function ModelsUsedTable({ rows }: ModelsUsedTableProps) {
  const { token } = theme.useToken();
  const columns = useModelStatsColumns();

  return (
    <Flex vertical gap={token.paddingXS}>
      <SectionLabel>Models used</SectionLabel>
      <Table<ModelStatsRow>
        dataSource={rows}
        rowKey={([m]) => m}
        size="small"
        pagination={false}
        columns={columns}
      />
    </Flex>
  );
}
