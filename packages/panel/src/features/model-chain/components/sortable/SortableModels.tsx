import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { App, Empty, Flex } from "antd";
import type { ModelFallbackEntry, RoutingOption } from "../../domain/types.js";
import type { DraftChain } from "../../hooks/useChainDraft.js";
import { SortableModelRow } from "./SortableModelRow.js";

interface SortableModelsProps {
  draft: DraftChain;
  options: RoutingOption[];
  onChange: (models: ModelFallbackEntry[]) => void;
}

export function SortableModels({ draft, options, onChange }: SortableModelsProps) {
  const { message } = App.useApp();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = draft.models.map((entry, index) => `${entry.providerId}/${entry.model}/${index}`);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex >= 0 && newIndex >= 0) onChange(arrayMove(draft.models, oldIndex, newIndex));
  };

  if (draft.models.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Add at least one model" />;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <Flex vertical gap={8}>
          {draft.models.map((entry, index) => (
            <SortableModelRow
              key={ids[index]}
              id={ids[index]}
              index={index}
              entry={entry}
              options={options}
              onRemove={() => {
                onChange(draft.models.filter((_, i) => i !== index));
                message.success("Model removed");
              }}
            />
          ))}
        </Flex>
      </SortableContext>
    </DndContext>
  );
}
