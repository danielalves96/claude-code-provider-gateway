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
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Col, Row } from "antd";
import type { ProviderInfo, TestResult } from "../types.js";
import { ProviderCard } from "./ProviderCard.js";

interface SortableProviderCardProps {
  provider: ProviderInfo;
  testResult?: TestResult;
  onClick: (provider: ProviderInfo) => void;
  onToggleEnabled: (id: string, currentlyEnabled: boolean) => void;
  onToggleFavorite: (provider: ProviderInfo, event: React.MouseEvent) => void;
}

function SortableProviderCard({
  provider,
  testResult,
  onClick,
  onToggleEnabled,
  onToggleFavorite,
}: SortableProviderCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: provider.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    height: "100%",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ProviderCard
        provider={provider}
        testResult={testResult}
        onClick={onClick}
        onToggleEnabled={onToggleEnabled}
        isFavorite={true}
        onToggleFavorite={onToggleFavorite}
      />
    </div>
  );
}

interface SortableFavoritesGridProps {
  favoriteIds: string[];
  providers: ProviderInfo[];
  testResults: Record<string, TestResult>;
  onProviderSelect: (provider: ProviderInfo) => void;
  onToggleEnabled: (id: string, currentlyEnabled: boolean) => void;
  onToggleFavorite: (provider: ProviderInfo, event: React.MouseEvent) => void;
  onReorder: (newOrder: string[]) => void;
}

export function SortableFavoritesGrid({
  favoriteIds,
  providers,
  testResults,
  onProviderSelect,
  onToggleEnabled,
  onToggleFavorite,
  onReorder,
}: SortableFavoritesGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = favoriteIds.indexOf(active.id as string);
      const newIndex = favoriteIds.indexOf(over.id as string);

      if (oldIndex >= 0 && newIndex >= 0) {
        onReorder(arrayMove(favoriteIds, oldIndex, newIndex));
      }
    }
  };

  // Map favoriteIds to ProviderInfo objects, filtering out any missing ones
  const favoriteProviders = favoriteIds
    .map((id) => providers.find((p) => p.id === id))
    .filter((p): p is ProviderInfo => p !== undefined);

  if (favoriteProviders.length === 0) {
    return null;
  }

  const renderedIds = favoriteProviders.map((p) => p.id);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={renderedIds} strategy={rectSortingStrategy}>
        <Row gutter={[16, 16]} align="stretch">
          {favoriteProviders.map((provider) => (
            <Col xs={24} sm={12} lg={8} xl={6} key={provider.id}>
              <SortableProviderCard
                provider={provider}
                testResult={testResults[provider.id]}
                onClick={onProviderSelect}
                onToggleEnabled={onToggleEnabled}
                onToggleFavorite={onToggleFavorite}
              />
            </Col>
          ))}
        </Row>
      </SortableContext>
    </DndContext>
  );
}
