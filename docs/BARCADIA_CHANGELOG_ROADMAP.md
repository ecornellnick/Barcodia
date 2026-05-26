# Barcadia — Running Changelog + Future Roadmap

_Last updated: May 2026 — v60 battle roadmap correction_

## Current Major Status

Barcadia has completed the first major admin-driven RPG runtime phase and has entered the tactical battle prototype phase.

The battle system direction is now: **Langrisser-inspired, square-grid tactical RPG combat**, beginning with an isolated dev-only Battle Lab and later integrating into story/hotspot runtime.

## Strong Project Rules

### Changelog Rule
Every future push/update must update this document and the relevant planning document.

Each update should record:

- changed files
- what was added/fixed
- what to test
- known limitations
- next planned step

### No Ghost / Relic Code Rule
Before launch:

- no dead buttons
- no stub text
- no fake controls
- no orphaned dev routes
- no abandoned experimental code
- no duplicated temporary battle logic

Dev-only shells are allowed during development, but reusable game logic must live in reusable modules.

For battle:

- `frontend/app/dev/battle-lab.tsx` is a temporary/dev shell
- `frontend/src/battle/*` is the permanent reusable battle engine

## Completed Recent Milestones

### RPG Runtime / Dev Mode Phase
- Story Builder / Storyboard CMS
- Location/hotspot runtime integration
- Dev Mode control panel
- runtime action executor
- flags/items/quests/battle stubs
- persistence and snapshots
- runtime QA tools
- cinematic dev viewer with portrait/landscape fullscreen options

### Battle Planning Phase
- Langrisser-style tactical system chosen
- First battle narrative defined: City Street Ambush
- battle reference art stored under `ConceptArt/BattleReferences/`
- skills/cooldowns added to roadmap
- battle lab architecture established

### Battle Foundation Phase
- Battle Lab created as isolated dev-only test screen
- battle map asset added
- terrain/map data system started
- unit movement added
- combat/HP/damage/defeat state added
- turn system and enemy thug AI added/planned in chunk sequence
- skill/cooldown foundation added/planned in chunk sequence
- combat UX/readability layer added/planned in chunk sequence

## v60 Roadmap Correction — Battle Maps, Grid, and Terrain Admin

### Important Battle Map Art Rule
Battle map images should **not** include permanent grid lines baked into the art.

The map art should be clean environment art only. Grid lines are a runtime overlay.

Reason:

- users may toggle grid on/off
- grid styling may change later
- clean art is reusable for cinematics, previews, and UI
- admin terrain editing needs coordinate data separate from image pixels

### Runtime Grid Toggle
Add a player/dev control:

```text
Grid: ON/OFF
```

Normal gameplay should avoid noisy debug grid labels. Debug movement-cost numbers should be available only in Dev Mode.

### Movement / Attack Overlay Rules
Langrisser-style overlay behavior:

- select unit = movement tiles appear
- movement tiles should be blue/green and clean
- attack tiles should be red
- attackable enemies should be visibly highlighted
- skills define their own range/shape/targeting overlay
- normal attacks and skills must not use the same hardcoded overlay if their ranges differ

### Admin Battle Map Editor Requirement
Battle Builder CMS must eventually allow editing grid metadata over a clean battle map image.

Admin controls needed:

- select/upload battle background
- define grid width/height
- toggle preview grid
- click tiles to set terrain
- mark passable/blocked cells
- set terrain movement cost
- set defense/attack modifiers
- set foot/flying movement rules
- define spawn points
- define non-combatant positions
- lock/archive/restore battle maps safely

### Movement Type Rules
- Foot units cannot pass walls/buildings.
- Foot units usually cannot cross water.
- Flyers can pass over water.
- Flyers still cannot pass through true walls/buildings unless explicitly allowed.
- Movement calculations must consider unit movement type.

## Near-Term Battle Roadmap

### v61 — Gridless Map Asset + Runtime Grid Toggle
- replace current battle background with clean no-grid version
- runtime grid toggle
- hide debug movement costs by default
- dev-only movement cost toggle

### v62 — Tactical Camera / Landscape Support
- landscape battle test mode
- pan/zoom battlefield
- fit view
- selected unit focus

### v63 — Langrisser Tactical Overlay Parity
- blue/green movement range
- red attack range
- attackable enemy highlighting
- skill-specific targeting shapes
- enemy danger zone toggle later

### v64 — Skill HUD Buttons
- lower-right skill tray
- skill icons
- cooldown overlays
- disabled/ready states
- Stand/Wait action

### v65 — Battle QA / Cleanup
- no stubs
- no dead buttons
- no ghost code
- acceptance checklist before story integration

## First Battle: Battle 001 — City Street Ambush

Story:

The hero leaves home in the city. A child pretends to need help, steals the hero's money, and runs away. The hero chases him and is stopped by 2–3 thugs. This becomes the first tactical battle.

Battle setup:

- hero in plain clothes
- 2–3 thugs
- hidden child in the back/enemy side as non-combatant
- map outside/near hero's house
- bright JRPG city neighborhood look
- no fountain required
- no baked-in grid lines

## Asset Pipeline Notes

`ConceptArt/` and `Cinematics/` may contain personal/reference assets that are not directly wired into the game. Game-ready assets should be copied into `frontend/assets/...` or served by backend/static when they become runtime assets.

Future cleanup needed:

- organize ConceptArt folders
- organize Cinematics folders
- separate reference vs runtime assets
- standard naming conventions
- battle art references
- sprite references

## Current Testing Recommendation

Wait to deeply test battle until the current battle chunks are installed. Smoke test only for crashes after each chunk.

Serious testing should begin after:

- runtime grid toggle
- movement/attack overlays
- turn system
- skill HUD
- camera/landscape behavior
- QA cleanup pass

## Update v61 — Runtime Grid Toggle + Tactical Overlay Rules

Changed Files:
- `frontend/app/dev/battle-lab.tsx`
- `docs/BATTLE_SYSTEM_PLAN.md`
- `docs/BARCADIA_CHANGELOG_ROADMAP.md`

Added:
- Runtime grid toggle in the Battle Lab.
- Move-cost debug toggle.
- Documented Langrisser-style overlay rule: movement tiles and attack/skill tiles are runtime overlays, not baked into art.
- Documented that current first battle map art is temporary because it still contains baked-in grid lines.
- Documented future Battle Builder CMS terrain/passability editor requirements.

Known Notes:
- The battle background image still needs to be regenerated cleanly without grid lines/labels.
- Runtime overlay behavior should continue moving toward Langrisser-style clarity: blue/green movement, red attack range, highlighted attackable enemies, and skill-defined targeting.

Next Planned Update:
- Continue battle system chunks with camera/landscape/pan support and cleaner tactical HUD behavior.

---

## Update v63 — Langrisser-Style Action Tray + Tactical Targeting Overlay

### Changed Files
- `frontend/app/dev/battle-lab.tsx`
- `docs/BATTLE_SYSTEM_PLAN.md`
- `docs/BARCADIA_CHANGELOG_ROADMAP.md`

### Added
- Tactical action tray in the dev-only Battle Lab.
- Explicit Move and Attack controls.
- Skill buttons with cooldown visibility.
- Green movement overlay behavior.
- Red normal attack / skill targeting overlay behavior.
- Attackable target highlighting.
- Roadmap notes for runtime grid toggle, no baked-in grid lines, skill-driven targeting shapes, and future Battle Builder terrain/passability editing.

### Architecture Reminder
- `frontend/app/dev/*` is a QA harness only.
- Reusable battle logic belongs in `frontend/src/battle/*`.
- Before launch, no ghost/relic code, no dead buttons, no stub labels, and no duplicate temporary battle systems should remain.

### Known Limitations
- Current tactical camera/pan/zoom and full landscape HUD polish still need later chunks.
- Skill targeting currently supports range-based preview foundation; advanced AoE/line/cone shapes are future roadmap.
- Current battle image may still contain old grid-line art until a clean gridless map asset is regenerated and swapped in.

### Next Planned Battle Work
- Tactical camera + landscape battle screen refinement.
- Cleaner Langrisser-style lower-right HUD placement.
- Advanced targeting shapes and danger-zone overlay.
- Battle result flow and later story-return integration.

## v64 — Combat Readability + Target Clarity Polish

- Added reusable tactical overlay helpers for movement tiles, attack tiles, and attackable target IDs.
- Battle UX rule: normal player movement should be shown as clean green/blue movement tiles, not debug numbers.
- Battle UX rule: normal attacks and skill target ranges should be shown as red targeting tiles.
- Attackable enemies should be visibly emphasized so the player can immediately tell who can be attacked.
- Debug overlays such as movement cost numbers should remain optional/dev-only.
- Roadmap reinforced: final battle maps should not include baked-in grid lines; grid visibility must be runtime-toggleable.



## Update v65 — Battle QA Cleanup + Story-Return Foundation

- Added battle result model for `active`, `victory`, and `defeat`.
- Added retry battle flow and return-to-game foundation for future Story Builder integration.
- Added Battle Lab QA checks for duplicate units, out-of-bounds units, missing sides, and required Battle 001 neutral child setup.
- Reinforced architecture rule: `frontend/app/dev/*` is a QA harness only; permanent battle logic belongs in `frontend/src/battle/*`.
- No launch builds should keep ghost/relic code, dead buttons, visible stubs, or unused dev-only code paths outside gated QA tools.

## Update v66 — Battle Lab Landscape / Langrisser Layout Correction

Changed battle lab direction from portrait debug UI to a landscape-first tactical screen.

### Added / Corrected
- Full-screen battlefield presentation.
- Tap-unit-first interaction model.
- One-finger map panning foundation.
- HUD-based Attack / Skill / Stand controls.
- Runtime grid toggle remains optional.
- Gridless battle art is now the target; grid lines must not be baked into map images.

### Strong Design Rule
The battle system should feel like a tactical SRPG screen, not a form-based debug page. Dev tools may expose extra toggles, but the core battle surface should prioritize the map, unit selection, movement, attack targeting, and skill buttons.

## Update v67 — Tactical Camera Pan/Clamp + Fit Controls

- Added reusable battle camera helpers in `frontend/src/battle/camera.ts`.
- Battle Lab camera now has clamped one-finger pan instead of unlimited drifting.
- Added Fit View, Zoom In, and Zoom Out controls for testing landscape battlefield readability.
- Camera status is visible in the Battle Lab log HUD for QA.
- The Battle Lab remains a dev QA harness only; reusable camera math lives in `frontend/src/battle/*`.
- Next Battle UX Reset chunk should focus on the full Langrisser unit interaction flow: tap unit -> blue movement tiles -> tap destination -> choose Attack/Skill/Stand from map HUD.


---

## Update v68 — Battle UX Reset: Unit Interaction Flow

### Changed Files
- `frontend/app/dev/battle-lab.tsx`
- `docs/BATTLE_SYSTEM_PLAN.md`
- `docs/BARCADIA_CHANGELOG_ROADMAP.md`

### What Changed
- Battle Lab interaction now moves toward Langrisser-style map-first play.
- Tap a ready ally to select it.
- Blue movement tiles appear for valid movement.
- Tap a blue destination to move.
- After movement, the battlefield HUD offers Attack, skills, or Stand.
- Attack/skill selection switches to red targeting tiles.
- Stand ends the unit action.

### What To Test Later
- Select Hero directly on the map.
- Confirm blue movement tiles appear.
- Tap a valid blue tile.
- Confirm the action HUD appears after movement.
- Select Attack or a skill and confirm red target previews appear.
- Tap Stand and confirm the unit becomes finished.

### Known Limitations
- This remains Battle Lab/dev-only.
- The current background art still needs a gridless replacement.
- Camera/landscape/targeting polish continues in later chunks.


---

## Update v69 — Action HUD Polish + Targeting Flow Cleanup

### What Changed
- Refined the landscape Battle Lab action HUD toward the Langrisser reference: actions now live as a compact lower-right map overlay instead of a page-like control section.
- Normal Attack and skills now share the same target-selection mental model: choose the action, then tap a highlighted target.
- Skill buttons show range and cooldown state directly in the action tray.
- Stand is promoted as the clear no-attack/end-action button after movement.
- Added Clear Target behavior so the player can reset selected attack/skill targeting without leaving battle mode.
- Improved skill targeting support so ally/self-targeted skills can resolve from the map rather than only enemy attacks.

### Battle UX Rule Reinforced
- Tap unit -> blue movement tiles -> tap destination -> lower-right action tray -> red target tiles / highlighted target -> attack, skill, or Stand.
- The battle HUD should sit on top of the battlefield, not above or below it as a form layout.
- No baked-in grid lines in final map art; grid visibility remains a runtime toggle.

### Next Planned Battle Work
- Full-screen landscape enforcement and map sizing QA.
- Better skill-specific targeting shapes.
- Danger zone / enemy threat overlay.
- Replace temporary battle art with gridless battle-map art once approved.

## v70 — Fullscreen Landscape + Map Sizing Cleanup

- Battle Lab is now landscape-first; portrait mode shows a rotate/back screen instead of the cramped tactical layout.
- The battlefield map now owns the full screen and the HUD floats over the map instead of behaving like a vertical page.
- The battle image, grid, unit tokens, and overlays are grouped inside one camera layer so pan/zoom keeps the grid aligned with the map art.
- Camera clamping now accounts for battlefield content size, not just viewport size.
- This is part of the Battle UX Reset toward a Langrisser-style map-first combat screen.

## v71 — Battle Landscape Roadmap + UX QA Guardrails

### What Changed
- Added Battle Lab UX guardrails for landscape-first testing.
- Added compact HUD toggle so the map can reclaim more screen space during tactical review.
- Added Battle Help overlay to explain the intended Langrisser-style flow: tap unit -> blue movement tiles -> tap destination -> action tray -> red targeting tiles.
- Added UX QA log check for landscape mode, runtime grid state, camera pan/zoom state, and HUD mode.

### Strong Design Notes
- Battles are now considered landscape-first.
- A future game-wide landscape migration is likely and should be treated as a major UI overhaul, not a small patch.
- Battle Lab remains a dev QA harness only; reusable systems belong under `frontend/src/battle/`.
- No ghost/relic code, no dead controls, and no stub UI should remain before launch.

### What To Test Later
- Rotate to landscape and confirm the Battle Lab opens as a full tactical screen.
- Toggle HUD Compact/Full.
- Open Help and confirm it explains the flow without blocking core testing.
- Run UX QA and Data QA from the upper-right tools.
- Confirm pan/zoom still works after HUD toggling.

## Update v72 — Enemy Danger Zone Overlay

- Added reusable enemy threat overlay helper in `frontend/src/battle/threat.ts`.
- The Battle Lab `Danger Zone` control now displays orange enemy threat tiles instead of being a dead toggle.
- Reinforced tactical overlay language:
  - blue/green = movement
  - red = attack / skill targeting
  - orange = enemy danger zone
- Updated battle roadmap to keep all battle HUD controls functional and avoid stub/dead controls before launch.

## Update v73 — Gridless Battle Map Asset Swap

Changed Files
- `frontend/assets/images/battle/first_battle_map.png`
- `frontend/app/dev/battle-lab.tsx`
- `frontend/src/battle/threat.ts`
- `frontend/src/battle/index.ts`

Added / Changed
- Replaced the temporary battle map asset with a gridless version.
- Runtime grid remains toggleable in Battle Lab; battle art itself should never contain baked-in grid lines.
- Blue movement, red attack/skill targeting, and orange enemy danger-zone overlays remain runtime UI layers, not part of the image.
- Kept the dev-only Battle Lab as the QA harness while preserving reusable battle logic in `frontend/src/battle`.

What To Test Later
- Battle map should look like clean artwork when Grid is Off.
- Grid On should reveal the runtime grid overlay only.
- Danger Zone should appear as orange overlay tiles only when enabled.
- Movement and attack overlays should still align to the underlying map coordinates.

Known Limitations
- The current grid coordinate mapping is still a prototype and may need fine-tuning once the battle map art is final.
- Future Battle Builder CMS will define passability/terrain by x/y tile coordinates instead of baking tactical information into the art.



## Update v74 — Battle Map Art Correction / Gridless Axis-Aligned Map Requirement

### Changed Files
- `frontend/assets/images/battle/first_battle_map.png`
- `docs/BATTLE_SYSTEM_PLAN.md`
- `docs/BARCADIA_CHANGELOG_ROADMAP.md`

### What Changed
- Rejected the v73 low-quality gridless battle map artifact because it became muddy/patchy and lost the clean JRPG city look.
- Temporarily restored the cleaner high-quality battle reference asset for Battle Lab testing until a proper final gridless asset is generated.
- Added a roadmap requirement that final battle maps must be generated cleanly from the start, not manually de-gridded if that damages quality.
- Added a roadmap requirement that Battle 001 should be less diagonally skewed / more x-y coordinate friendly for square-grid tactical movement.

### Battle Art Direction Now Locked
- Bright anime/JRPG city-village tone.
- Clean, readable tactical surface.
- No baked-in grid lines in the final art.
- Runtime overlays handle grid, movement, attack, danger zone, selection, and targeting.
- Final map needs to align naturally to square x/y movement and later admin terrain painting.

### Known Limitation
The restored asset is still a temporary reference and may contain baked-in tactical marks. It is acceptable only until the final gridless, x/y-friendly Battle 001 map is generated and approved.

### Next Planned Battle Work
- Continue tactical UX reset chunks.
- Generate/approve a cleaner final Battle 001 map before finalizing tile passability data.
- Build Battle Builder terrain/passability editing later so walls, water, fences, and obstacles can be set per tile.

## Update v75 — Battle Grid Mapping / X-Y Calibration Foundation

### Changed Files
- `frontend/app/dev/battle-lab.tsx`
- `frontend/src/battle/gridMapping.ts`
- `frontend/src/battle/index.ts`
- `docs/BATTLE_SYSTEM_PLAN.md`
- `docs/BARCADIA_CHANGELOG_ROADMAP.md`

### What Changed
- Added explicit battle grid mapping helpers so runtime overlays and unit tokens can share one x/y coordinate system.
- Battle Lab now uses `getBattleTileRectStyle()` and `getBattleUnitPositionStyle()` instead of hardcoding grid math directly in the screen.
- Added visible dev calibration status so it is clear the current Battle 001 art is still using placeholder rectangular mapping.

### Why This Matters
This prevents battle coordinate logic from becoming ghost/relic code tied to a single image. Future final map art can be calibrated by changing the mapping data instead of rewriting the battle screen.

### Known Limitation
The current Battle 001 map remains temporary. It is not the final gridless, x/y-friendly battle map. Final art must be generated/approved before terrain passability is locked.

### Next Planned Battle Work
- Continue Battle UX reset and QA chunks.
- Regenerate final Battle 001 map art with no baked grid/UI and a more square-grid-friendly camera angle.
- Later add Battle Builder CMS controls for grid calibration and terrain/passability painting.


## Update v76 — Battle Map Axis Alignment + Calibration Guardrails

Changed files:
- `frontend/app/dev/battle-lab.tsx`
- `frontend/src/battle/gridMapping.ts`
- `frontend/src/battle/index.ts`
- `docs/BATTLE_SYSTEM_PLAN.md`
- `docs/BARCADIA_CHANGELOG_ROADMAP.md`

Added:
- Explicit roadmap requirement that Battle 001 final art must be clean, gridless, bright, and more x/y-friendly than the current angled reference.
- Battle grid metadata now flags current map art as reference-only and still needing final regeneration.
- Dev-only XY calibration overlay to help verify coordinate placement.

Known limitation:
- The current map image is still a placeholder reference. It should not be considered final battle art.

Next:
- Continue battle UX cleanup while preserving the requirement to regenerate the final Battle 001 map before production testing.

## Update v77 — Battle Dynamic Actors / Map Purity Rule

### What Changed
- Added the critical rule that final battle maps must contain environment art only.
- Added roadmap requirement for Admin Battle Builder actor placement.
- Added prototype runtime sprite assets for the hero, three thug variants, and the pickpocket child.
- Updated Battle Lab so movable actors render as runtime sprites instead of relying on actors baked into the background art.

### Why It Matters
Battle maps must be reusable tactical environments. Dynamic actors need to be controlled by battle data so they can move, attack, be defeated, spawn, disappear, or be swapped by story/party state.

### Files Updated
- frontend/app/dev/battle-lab.tsx
- frontend/assets/images/battle/units/hero_plain_clothes.png
- frontend/assets/images/battle/units/thug_grunt.png
- frontend/assets/images/battle/units/thug_brawler.png
- frontend/assets/images/battle/units/thug_knife.png
- frontend/assets/images/battle/units/pickpocket_child.png
- docs/BATTLE_SYSTEM_PLAN.md
- docs/BARCADIA_CHANGELOG_ROADMAP.md

### Known Limitations
- Current Battle 001 background is still a reference asset and is not accepted as final.
- Final Battle 001 art still needs to be regenerated as clean, bright, gridless, x/y-friendly environment-only art.
- Actor sprites are prototype clip-art placeholders and will later be replaced with proper JRPG battle sprites.

### Next Planned Work
Continue Battle Lab UX cleanup and begin preparing the future Battle Builder CMS requirements for terrain and actor placement.
