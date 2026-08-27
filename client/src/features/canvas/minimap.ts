import { getNodeDimensions, WorkflowNode } from "../workflow/types";

export type CanvasViewport = { x: number; y: number; zoom: number };
export type CanvasSize = { width: number; height: number };
export type WorldRectangle = { left: number; top: number; width: number; height: number };
export type MinimapLayout = {
  width: number;
  height: number;
  bounds: WorldRectangle;
  scale: number;
  offsetX: number;
  offsetY: number;
};

export const MINIMAP_WIDTH = 180;
export const MINIMAP_HEIGHT = 120;

export function getViewportWorldRectangle(viewport: CanvasViewport, canvas: CanvasSize): WorldRectangle {
  const zoom = Math.max(viewport.zoom, 0.01);
  return {
    left: -viewport.x / zoom,
    top: -viewport.y / zoom,
    width: canvas.width / zoom,
    height: canvas.height / zoom,
  };
}

export function getMinimapLayout(
  nodes: WorkflowNode[],
  viewport: CanvasViewport,
  canvas: CanvasSize,
  width = MINIMAP_WIDTH,
  height = MINIMAP_HEIGHT,
): MinimapLayout {
  const viewportBounds = getViewportWorldRectangle(viewport, canvas);
  const extents = nodes.flatMap(node => {
    const dimensions = getNodeDimensions(node);
    return [
      { x: node.position.x, y: node.position.y },
      { x: node.position.x + dimensions.width, y: node.position.y + dimensions.height },
    ];
  });
  const points = [
    ...extents,
    { x: viewportBounds.left, y: viewportBounds.top },
    { x: viewportBounds.left + viewportBounds.width, y: viewportBounds.top + viewportBounds.height },
  ];
  const minX = Math.min(...points.map(point => point.x));
  const maxX = Math.max(...points.map(point => point.x));
  const minY = Math.min(...points.map(point => point.y));
  const maxY = Math.max(...points.map(point => point.y));
  const padding = 160;
  const bounds = {
    left: minX - padding,
    top: minY - padding,
    width: Math.max(1, maxX - minX + padding * 2),
    height: Math.max(1, maxY - minY + padding * 2),
  };
  const inset = 9;
  const scale = Math.min((width - inset * 2) / bounds.width, (height - inset * 2) / bounds.height);
  const drawnWidth = bounds.width * scale;
  const drawnHeight = bounds.height * scale;
  return {
    width,
    height,
    bounds,
    scale,
    offsetX: (width - drawnWidth) / 2,
    offsetY: (height - drawnHeight) / 2,
  };
}

export function minimapPointFromWorld(layout: MinimapLayout, point: { x: number; y: number }) {
  return {
    x: layout.offsetX + (point.x - layout.bounds.left) * layout.scale,
    y: layout.offsetY + (point.y - layout.bounds.top) * layout.scale,
  };
}

export function worldPointFromMinimap(layout: MinimapLayout, point: { x: number; y: number }) {
  return {
    x: layout.bounds.left + (point.x - layout.offsetX) / layout.scale,
    y: layout.bounds.top + (point.y - layout.offsetY) / layout.scale,
  };
}

export function isWorldRectangleVisible(rectangle: WorldRectangle, viewport: WorldRectangle, padding = 0) {
  return rectangle.left + rectangle.width >= viewport.left - padding
    && rectangle.left <= viewport.left + viewport.width + padding
    && rectangle.top + rectangle.height >= viewport.top - padding
    && rectangle.top <= viewport.top + viewport.height + padding;
}
