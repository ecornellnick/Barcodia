export type BattleCamera = {
  x: number;
  y: number;
  zoom: number;
};

export type BattleCameraBounds = {
  viewportWidth: number;
  viewportHeight: number;
  zoom: number;
  contentWidth?: number;
  contentHeight?: number;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 1.75;

export function clampZoom(zoom: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number.isFinite(zoom) ? zoom : 1));
}

export function getCameraLimit(bounds: BattleCameraBounds) {
  const zoom = clampZoom(bounds.zoom);
  const contentWidth = bounds.contentWidth ?? bounds.viewportWidth;
  const contentHeight = bounds.contentHeight ?? bounds.viewportHeight;
  const renderedWidth = contentWidth * zoom;
  const renderedHeight = contentHeight * zoom;
  const extraWidth = Math.max(0, renderedWidth - bounds.viewportWidth);
  const extraHeight = Math.max(0, renderedHeight - bounds.viewportHeight);

  return {
    x: Math.max(0, extraWidth / 2),
    y: Math.max(0, extraHeight / 2),
  };
}

export function clampBattleCamera(camera: BattleCamera, bounds: BattleCameraBounds): BattleCamera {
  const zoom = clampZoom(camera.zoom);
  const limit = getCameraLimit({ ...bounds, zoom });

  return {
    zoom,
    x: Math.max(-limit.x, Math.min(limit.x, Number.isFinite(camera.x) ? camera.x : 0)),
    y: Math.max(-limit.y, Math.min(limit.y, Number.isFinite(camera.y) ? camera.y : 0)),
  };
}

export function resetBattleCamera(): BattleCamera {
  return { x: 0, y: 0, zoom: 1 };
}

export function zoomBattleCamera(camera: BattleCamera, delta: number, bounds: Omit<BattleCameraBounds, "zoom">): BattleCamera {
  const zoom = clampZoom(camera.zoom + delta);
  return clampBattleCamera({ ...camera, zoom }, { ...bounds, zoom });
}
