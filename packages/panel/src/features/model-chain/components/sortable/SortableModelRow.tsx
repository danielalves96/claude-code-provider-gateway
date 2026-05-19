import { DeleteOutlined, HolderOutlined } from "@ant-design/icons";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Flex, Tag, Typography, theme } from "antd";
import { ProviderLogo } from "../../../providers/components/grid/ProviderLogo.js";
import type { ModelFallbackEntry, RoutingOption } from "../../domain/types.js";

const { Text } = Typography;

interface SortableModelRowProps {
  id: string;
  index: number;
  entry: ModelFallbackEntry;
  options: RoutingOption[];
  onRemove: () => void;
}

export function SortableModelRow({ id, index, entry, options, onRemove }: SortableModelRowProps) {
  const { token } = theme.useToken();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const provider = options.find((option) => option.id === entry.providerId);
  const model = provider?.models.find((item) => item.id === entry.model);

  return (
    <Flex
      ref={setNodeRef}
      align="center"
      gap={token.padding}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        padding: token.paddingSM,
        borderRadius: token.borderRadius,
        border: `1px solid ${isDragging ? token.colorPrimary : token.colorBorderSecondary}`,
        background: isDragging ? `${token.colorPrimary}0A` : token.colorBgContainer,
        zIndex: isDragging ? 10 : 1,
        position: "relative",
      }}
    >
      <div
        {...attributes}
        {...listeners}
        style={{ cursor: "grab", display: "flex", color: token.colorTextTertiary }}
      >
        <HolderOutlined />
      </div>
      <Tag
        color={index === 0 ? "blue" : "default"}
        bordered={false}
        style={{ fontFamily: "monospace" }}
      >
        #{index + 1}
      </Tag>
      <ProviderLogo
        providerId={entry.providerId}
        label={provider?.label ?? entry.providerId}
        size={22}
      />
      <Flex vertical style={{ flex: 1, minWidth: 0 }}>
        <Text strong ellipsis>
          {provider?.label ?? entry.providerId}
        </Text>
        <Text type="secondary" ellipsis style={{ fontSize: 12 }}>
          {model?.display_name ?? entry.model}
        </Text>
      </Flex>
      <Button danger type="text" icon={<DeleteOutlined />} onClick={onRemove} />
    </Flex>
  );
}
