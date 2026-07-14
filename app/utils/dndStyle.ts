import type { CSSProperties } from 'react';
import type { DraggingStyle, NotDraggingStyle } from '@hello-pangea/dnd';

/**
 * @hello-pangea/dnd uses position:fixed while dragging.
 * Parent transforms (e.g. fade-in animations) break that positioning so the
 * card drifts away from the cursor. Clearing left/top keeps transform-based movement.
 */
export function fixDraggableStyle(
  style?: DraggingStyle | NotDraggingStyle | CSSProperties
): CSSProperties | undefined {
  if (!style) return undefined;
  return {
    ...style,
    left: 'auto',
    top: 'auto',
  };
}
