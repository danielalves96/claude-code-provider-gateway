import { SearchOutlined } from "@ant-design/icons";
import { Flex, Input, Select, theme } from "antd";
import {
  PROVIDER_STATUS_OPTIONS,
  type ProviderStatusFilter,
} from "../../domain/providerFilters.js";

interface ProviderToolbarProps {
  searchTerm: string;
  statusFilter: ProviderStatusFilter;
  onSearchTermChange: (value: string) => void;
  onStatusFilterChange: (value: ProviderStatusFilter) => void;
}

export function ProviderToolbar({
  searchTerm,
  statusFilter,
  onSearchTermChange,
  onStatusFilterChange,
}: ProviderToolbarProps) {
  const { token } = theme.useToken();

  return (
    <Flex gap={token.paddingSM} align="center" wrap>
      <Input
        placeholder="Search providers..."
        prefix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
        value={searchTerm}
        onChange={(event) => onSearchTermChange(event.target.value)}
        style={{ maxWidth: 300 }}
        allowClear
      />
      <Select
        value={statusFilter}
        onChange={onStatusFilterChange}
        options={PROVIDER_STATUS_OPTIONS}
        style={{ width: 160 }}
      />
    </Flex>
  );
}
