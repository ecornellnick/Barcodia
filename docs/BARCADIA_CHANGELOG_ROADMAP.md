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
