import { describe, expect, it } from "vitest";
import { getMinimapLayout, getViewportWorldRectangle, isWorldRectangleVisible, minimapPointFromWorld, worldPointFromMinimap } from "./minimap";
import { createInitialWorkflow } from "../workflow/types";

describe("workflow minimap geometry", () => {
  const workflow = createInitialWorkflow();
  const viewport = { x: 760, y: 370, zoom: 1 };
  const canvas = { width: 1280, height: 720 };

  it("includes the existing graph and visible canvas in one derived overview", () => {
    const layout = getMinimapLayout(workflow.nodes, viewport, canvas);
    const visible = getViewportWorldRectangle(viewport, canvas);
    expect(layout.bounds.left).toBeLessThanOrEqual(visible.left);
    expect(layout.bounds.top).toBeLessThanOrEqual(visible.top);
    expect(layout.bounds.left + layout.bounds.width).toBeGreaterThanOrEqual(visible.left + visible.width);
    expect(layout.scale).toBeGreaterThan(0);
  });

  it("converts a minimap location to the same world point and back", () => {
    const layout = getMinimapLayout(workflow.nodes, viewport, canvas);
    const target = { x: 250, y: 160 };
    const miniPoint = minimapPointFromWorld(layout, target);
    expect(worldPointFromMinimap(layout, miniPoint)).toEqual(target);
  });

  it("identifies visible rectangles so the canvas can avoid mounting distant node UI", () => {
    const visible = { left: 0, top: 0, width: 100, height: 100 };
    expect(isWorldRectangleVisible({ left: 90, top: 20, width: 30, height: 20 }, visible)).toBe(true);
    expect(isWorldRectangleVisible({ left: 150, top: 20, width: 30, height: 20 }, visible, 20)).toBe(false);
  });
});
