export type BattleGridMapping = {
  id: string;
  cols: number;
  rows: number;
  /** Percentage of the background image width where playable grid begins. */
  leftPct: number;
  /** Percentage of the background image height where playable grid begins. */
  topPct: number;
  /** Percentage of the background image width occupied by the playable grid. */
  widthPct: number;
  /** Percentage of the background image height occupied by the playable grid. */
  heightPct: number;
  /** Temporary state until final battle art is regenerated for clean x/y tactical movement. */
  status: "placeholder_rectangular" | "final_calibrated";
  /** Whether the current art reads as a true x/y tactical map or an angled reference image. */
  artProjection: "angled_reference" | "axis_aligned_tactical";
  /** True while the image is only a visual placeholder and not the final tactical map. */
  requiresFinalArt: boolean;
  notes: string;
};

export const cityStreetAmbushGridMapping: BattleGridMapping = {
  id: "city_street_ambush_v1_placeholder",
  cols: 12,
  rows: 8,
  leftPct: 0,
  topPct: 0,
  widthPct: 100,
  heightPct: 100,
  status: "placeholder_rectangular",
  artProjection: "angled_reference",
  requiresFinalArt: true,
  notes:
    "Temporary high-quality reference art. It is still too angled for final x/y tactical movement. Final Battle 001 art must be regenerated as clean, bright, gridless, more top-down/orthographic x/y-friendly tactical art, then calibrated here by x/y percentages.",
};

export function getBattleTileRectStyle(mapping: BattleGridMapping, x: number, y: number) {
  const cellW = mapping.widthPct / mapping.cols;
  const cellH = mapping.heightPct / mapping.rows;
  return {
    left: `${mapping.leftPct + x * cellW}%`,
    top: `${mapping.topPct + y * cellH}%`,
    width: `${cellW}%`,
    height: `${cellH}%`,
  };
}

export function getBattleUnitPositionStyle(mapping: BattleGridMapping, x: number, y: number) {
  const cellW = mapping.widthPct / mapping.cols;
  const cellH = mapping.heightPct / mapping.rows;
  return {
    left: `${mapping.leftPct + (x + 0.5) * cellW}%`,
    top: `${mapping.topPct + (y + 0.5) * cellH}%`,
  };
}

export function battleMapCalibrationStatus(mapping: BattleGridMapping) {
  if (mapping.status === "final_calibrated" && mapping.artProjection === "axis_aligned_tactical") {
    return `Map grid calibrated: ${mapping.cols}x${mapping.rows}`;
  }
  return "Map grid: placeholder calibration. Final art still needs clean x/y-friendly regeneration.";
}

export function battleMapArtStatus(mapping: BattleGridMapping) {
  if (!mapping.requiresFinalArt && mapping.artProjection === "axis_aligned_tactical") {
    return "Map art accepted for tactical x/y movement.";
  }
  return "Map art is reference-only: still too angled for final x/y movement. Generate clean axis-aligned art before production testing.";
}
