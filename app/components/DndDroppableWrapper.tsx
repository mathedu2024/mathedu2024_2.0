'use client';

import { Droppable as DndDroppable } from '@hello-pangea/dnd';

export function DndDroppableWrapper(props: React.ComponentProps<typeof DndDroppable>) {
  return <DndDroppable {...props} />;
}
