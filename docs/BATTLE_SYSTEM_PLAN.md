# Barcadia Battle System Plan

_Last updated: May 2026 — v60 roadmap update_

## Battle System Direction

Barcadia's battle system is moving toward a Langrisser-inspired, square-grid tactical RPG system. The first prototype remains isolated inside the dev-only Battle Lab until accepted. The reusable battle engine should live under `frontend/src/battle/`, while the dev route under `frontend/app/dev/battle-lab.tsx` is a temporary shell only.

## Core Rule: No Ghost / Relic Code

- Dev-only wrappers may exist temporarily for testing.
- Reusable logic must live in the battle engine modules.
- Before launch, remove or hide dev-only routes/buttons.
- No dead buttons, stub labels, placeholder behavior, orphaned files, or old experimental code should remain.
- If a visible control exists, it must do something real.

## Battle Map Art Rule

Battle map background images must **never contain baked-in grid lines**.

The battle art should be clean environment art only. The grid is a runtime overlay controlled by the game.

### Runtime Grid Behavior

- Grid visible: user/dev toggle ON.
- Grid hidden: user/dev toggle OFF.
- Movement tiles and attack tiles still appear when tactically relevant.
- Normal player mode should not show debug movement-cost numbers.
- Movement cost/debug labels belong behind a Dev Mode toggle only.

## Battle Map Coordinate System

Each battle map should be treated as a coordinate grid over a clean background image.

Example:

```text
battle_id: city_street_ambush
image: frontend/assets/images/battle/city_street_ambush.png
width: 12
height: 8
coords: x/y grid positions
```

The map art is visual. The battle data defines:

- grid width/height
- tile terrain type
- passability
- movement cost
- defense modifier
- attack modifier if needed
- spawn points
- blocked cells
- special cells/events

## Terrain and Passability

The admin must eventually support editing terrain and passability per grid tile.

### Example Terrain Types

| Terrain | Foot Units | Flying Units | Notes |
|---|---|---|---|
| Stone Road | Passable | Passable | Normal movement |
| Grass | Passable | Passable | Default terrain |
| Forest | Passable, higher cost | Passable | Defensive bonus / cover |
| Water | Blocked or high cost | Passable | Flyers can cross; foot usually cannot |
| Wall / Building | Blocked | Blocked | No unit can pass |
| Crates / Barrels | Blocked or cover | Passable/blocked depending height | Could provide cover |
| Fence | Blocked or partial | Passable | Battle-specific |
| Mountain / Cliff | Usually blocked or high cost | Passable | Defensive/high-ground logic later |

### Movement Rules

- Infantry/foot units cannot pass through walls/buildings.
- Foot units usually cannot cross water unless special terrain/bridge exists.
- Flyers can pass over water and some terrain obstacles.
- Flyers cannot pass through true walls/buildings unless explicitly allowed.
- Terrain movement cost must be unit-type-aware.

## Admin Battle Map Controls — Future Requirement

The Battle Builder CMS should include a grid/terrain editor.

Admin controls needed:

- upload/select clean battle map art
- define grid width and height
- preview runtime grid overlay
- click tile to set terrain type
- click tile to mark passable/blocked
- define movement cost by unit type
- define defense bonus
- define attack bonus if needed
- define spawn tiles for player/enemy/non-combatants
- define special event tiles
- lock important battle maps against accidental deletion
- archive/restore battle maps safely

## Langrisser-Style Tactical Overlay Rules

### Unit Selection

When the player selects a unit:

- Blue/green movement tiles appear for valid movement squares.
- Reachability must be terrain-aware.
- Occupied and blocked tiles must be excluded.
- Debug numbers should not appear in normal mode.

### Normal Attack

When the player chooses normal attack or has an enemy in range:

- Red attack tiles appear.
- Attackable enemies are highlighted clearly.
- Player should immediately know who can be attacked.

### Skill Targeting

Skills define their own targeting rules.

A skill should define:

- range
- shape
- target type: enemy, ally, self, tile, area
- cooldown
- whether it can counterattack / be counterattacked
- effect type: damage, heal, buff, debuff, movement, etc.

Examples:

```text
Normal Attack
range: 1
shape: adjacent
target: enemy
```

```text
Recover
range: 2
shape: single target
target: ally
cooldown: 2
```

```text
Line Slash
range: 3
shape: line
target: enemy
cooldown: 3
```

The renderer should generate targeting overlays from the skill definition rather than hardcoding them.

## Skill Buttons / Battle HUD

The battle HUD should include Langrisser-inspired skill buttons, likely lower-right in landscape mode.

Skill buttons should show:

- icon
- name or short label
- cooldown overlay
- disabled state if unusable
- selected/active state
- target preview when selected

Future controls:

- Attack
- Skill 1
- Skill 2
- Skill 3
- Stand / Wait / End Action
- End Turn
- Danger Zone
- Grid On/Off

## First Battle: Battle 001 — City Street Ambush

Narrative:

The hero leaves home in the JRPG city. A child pretends to need help, steals the hero's money, and runs away. When the hero chases him, two or three thugs block the way and attack. The child is hidden in the back of the enemy area as a non-combatant.

### Requirements

- Hero is in plain real-world clothes.
- Battle occurs outside/near the hero's home, not in a giant plaza.
- Map should be bright, vibrant, anime/JRPG style.
- No baked-in grid lines on the art.
- Runtime grid overlays the clean map.
- Child is non-combatant: cannot move, cannot attack, does not count as enemy defeated.
- Enemies: 2–3 thugs.
- Terrain: stone road, fences/walls, crates/barrels, grass/flowerbeds, possible alley/cover.

## Current Chunk Roadmap

### v51 — Battle Lab Foundation
- Isolated dev-only battle screen
- First battle map asset
- Basic grid overlay
- Hero + thugs + hidden child

### v52 — Terrain + Map Data
- reusable terrain definitions
- City Street Ambush scenario data
- terrain-aware movement preview

### v53 — Unit Movement
- selectable unit
- move range
- movement execution
- blocked/occupied tile prevention

### v54 — Combat / HP / Damage
- attack selection
- attack range visualization
- HP/damage
- defeat state

### v57 — Turn System + Enemy AI
- player phase / enemy phase
- End Turn
- simple thug AI
- victory/defeat

### v58 — Skills + Cooldowns
- skill definitions
- cooldowns
- shared/exclusive skills
- skill availability states

### v59 — Combat UX Layer
- combat preview
- terrain bonus readout
- cooldown display
- attack readability

### v60 — Roadmap Correction: Clean Maps + Runtime Grid + Admin Terrain Editor
- battle maps must not include baked-in grid lines
- add runtime grid toggle
- add movement/attack overlay rules
- add admin terrain/passability requirements
- add flyer/foot movement distinction

## Upcoming

### v61 — Gridless Map Asset + Runtime Grid Toggle
- replace current battle background with clean no-grid art
- runtime grid toggle
- remove debug cost numbers from normal mode
- dev-only movement-cost labels

### v62 — Tactical Camera / Landscape
- landscape battle lab mode
- pan/zoom
- fit view
- focus selected unit

### v63 — Langrisser Overlay Parity
- blue/green movement tiles
- red attack tiles
- enemy target highlight
- skill-defined target overlays

### v64 — Skill HUD Buttons
- lower-right skill tray
- cooldown icons
- Stand/Wait action

### v65 — Battle QA / Cleanup
- no stubs
- no ghost code
- no dead controls
- clean acceptance checklist

## v61 — Runtime Grid Toggle + Tactical Overlay Correction

### Implemented / Planned Rule
Battle map images should be clean art only. Grid lines are not baked into the map art. The runtime owns all tactical overlays.

### Runtime Overlay Rules
- Grid toggle OFF by default for clean battle art.
- Grid toggle ON shows the square tactical grid.
- Blue/green movement overlay shows valid movement tiles for the selected unit.
- Red attack overlay shows normal attack or selected skill target range.
- Attackable enemies should glow/highlight clearly.
- Move-cost numbers are debug-only and should be hidden from normal player view.

### Current Note
The current first battle art still contains baked-in grid lines from the concept mockup. It remains acceptable only as a temporary development reference. A final replacement map should be regenerated without any grid lines, labels, UI, or annotations.

### Future Admin Requirement
Battle Builder CMS must eventually let us paint terrain/passability over a clean map image using x/y grid coordinates. Examples:
- foot units cannot pass walls or high barriers
- foot units may be slowed by rough terrain
- flyers can pass water
- flyers still cannot pass true walls / map boundaries
- terrain tiles define movement cost, defense modifier, and passability by movement type

---

## v63 Roadmap Update — Langrisser-Style Action Tray + Targeting Overlays

### Implemented in this chunk
- Added a tactical action tray in the Battle Lab so selected units expose clear actions instead of burying skills in lower cards.
- Added explicit **Move** and **Attack** action buttons.
- Added selected-unit skill buttons with cooldown number display.
- Added active targeting mode behavior:
  - **Green tiles** = valid movement tiles.
  - **Red tiles** = normal attack or selected skill targeting tiles.
  - Attackable targets receive red target highlighting.
- Added skill-defined targeting preview foundation so future skills can drive their own range instead of hardcoding attack overlays.

### Required future behavior
- Normal battle maps must not contain baked-in grid lines. The grid is a runtime overlay only.
- The runtime grid must be user/dev toggleable.
- Move cost numbers are dev-only and should not appear in normal player mode.
- Skills should define their targeting behavior through data: range, min range, target type, shape, cooldown, and later AoE.
- The eventual Battle Builder CMS must edit terrain/passability by x/y grid coordinates instead of relying on drawn grid lines in art.

### Langrisser-style battle UX target
- Select unit -> show movement / action affordances.
- Choose Move -> green reachable tiles.
- Choose Attack -> red normal attack tiles and attackable target highlights.
- Choose Skill -> skill-specific target overlay and cooldown-aware skill button state.
- Lower-right style skill/action tray remains a target UX direction for landscape combat mode.

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

## Update v66 — Landscape Tactical Layout Correction

The Battle Lab must now treat the Langrisser reference as the immediate UX target, not the portrait debug layout.

### Required Battle Lab UX
- Battle view is landscape-first and full-screen.
- The map is the main screen, not a card inside a scrolling page.
- Tap a unit on the map to select that unit.
- Selected ally shows blue/green movement squares only while in Move mode.
- Tap a valid movement tile to move.
- After movement, player chooses Attack, a Skill, or Stand from the battle HUD.
- Attack and skill targeting show red tiles and highlight targets in range.
- One-finger drag pans the battle map.
- Skill/action buttons live on the map HUD, not in a large form panel above the map.
- Battle map art must not contain baked-in grid lines; grid is a runtime toggle only.

### Current Implementation Note
`frontend/app/dev/battle-lab.tsx` remains a dev QA shell. Core battle logic remains in `frontend/src/battle/*` and should be reusable by story/runtime integration later.

## Update v67 — Tactical Camera Pan/Clamp + Fit Controls

- Added reusable battle camera helpers in `frontend/src/battle/camera.ts`.
- Battle Lab camera now has clamped one-finger pan instead of unlimited drifting.
- Added Fit View, Zoom In, and Zoom Out controls for testing landscape battlefield readability.
- Camera status is visible in the Battle Lab log HUD for QA.
- The Battle Lab remains a dev QA harness only; reusable camera math lives in `frontend/src/battle/*`.
- Next Battle UX Reset chunk should focus on the full Langrisser unit interaction flow: tap unit -> blue movement tiles -> tap destination -> choose Attack/Skill/Stand from map HUD.


---

## Update v68 — Langrisser-style Unit Interaction Flow

### Intent
The battle lab is being reset away from a vertical/debug prototype and toward a Langrisser-style tactical interaction model.

### Added / Changed
- Unit selection is now map-first: tap the ally unit on the battlefield.
- Selecting a ready ally shows blue reachable movement tiles.
- Tapping a valid blue tile moves the selected unit.
- After movement, the map HUD opens with Attack, skills, and Stand.
- Attack/skill selection switches from movement preview to red targeting preview.
- Stand ends the selected unit action without attacking.
- The HUD now explains the current flow: tap unit → blue move tile → Attack/Skill/Stand.

### Roadmap Notes
- Blue tiles are movement/reachable tiles.
- Red tiles are normal attack or skill targeting tiles.
- Skills must eventually define their own range/shape/targeting rules.
- Battle maps must not include baked-in grid lines; runtime toggles render grid/overlays.
- Current Battle Lab remains a dev-only QA harness. Core logic must stay in reusable `frontend/src/battle/*` modules.


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

## v71 — Landscape-First Battle UX Guardrails

Battle screens are now treated as landscape-first. The current Battle Lab should remain isolated to `frontend/app/dev/battle-lab.tsx`, but the reusable camera, combat, terrain, movement, skill, cooldown, and QA logic must continue living under `frontend/src/battle/`.

### Added UX Guardrails
- Compact HUD toggle for real-estate testing.
- Battle Help overlay documenting the intended player flow.
- UX QA action that logs landscape/grid/camera/HUD state.

### Future Major UI Work
A full app-wide landscape migration is likely. This must be handled as its own major UI milestone because it will affect:

- world/location screens
- dialogue presentation
- bottom navigation
- cinematic playback
- admin-authored hotspot placement assumptions
- tactical battles
- story cutscenes

Do not quietly mix full-game landscape migration into unrelated battle chunks.

## v72 — Enemy Danger Zone Overlay

### What Changed
- The Danger Zone button is now a real tactical overlay instead of an inactive control.
- Enemy threat tiles render as an orange overlay when the toggle is on.
- The overlay is separate from the player action overlays:
  - blue/green = valid movement
  - red = selected attack or skill target range
  - orange = enemy danger/threat range
- The threat system lives in `frontend/src/battle/threat.ts` so it can later be reused by real battles and future admin QA tools.

### Roadmap Notes
- Danger Zone should remain toggleable, similar to common tactical RPG/SRPG UX.
- Future versions should refine threat overlays by enemy selected, enemy class, enemy skill range, terrain blockers, and skill-specific threat patterns.
- Do not leave inactive toggles in battle UI. If a battle button is visible, it must perform a real action.

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



## Update v74 — Battle Map Art Correction: Gridless + Axis-Aligned Requirement

### Why this update exists
The v73 gridless battle map asset was rejected because it degraded the artwork quality and became muddy/patchy compared to the approved bright city reference. The old high-quality image had better lighting and clarity, but it still contains baked-in grid lines and uses a more angled/isometric layout than ideal for direct x/y coordinate movement.

### Corrected Battle Map Art Rule
Final battle maps must be generated as **clean, high-quality environment art** with:

- no baked-in grid lines
- no UI labels, title plaques, selection bases, or annotations
- bright JRPG/anime lighting like the approved city references
- readable terrain boundaries
- a camera angle suitable for square x/y grid movement
- less extreme diagonal/isometric skew so runtime grid coordinates align naturally
- enough open tactical space for movement, attack range, and danger-zone overlays

### Temporary Asset Decision
Until a better axis-aligned gridless map is generated and approved, the Battle Lab may temporarily use the higher-quality reference map rather than the degraded v73 gridless artifact. This is temporary only. The final accepted map must be regenerated cleanly and then mapped to x/y tile data.

### Upcoming Required Work
- Regenerate Battle 001 map as clean, gridless, brighter JRPG town-street art.
- Use a more top-down/orthographic tactical angle that supports square x/y coordinates.
- Keep all grid, movement, attack, danger-zone, selection, and target indicators as runtime overlays only.
- Once approved, replace `frontend/assets/images/battle/first_battle_map.png` with the final clean asset.
- Update `cityStreetAmbush.ts` x/y tile metadata to match the final map.
- Later, Battle Builder CMS must allow manual terrain/passability painting by x/y tile.

### Strong Reminder
Do not attempt to remove grid lines from an existing image with a low-quality blur/inpaint pass if it visibly damages the artwork. It is better to temporarily keep a high-quality reference asset and regenerate proper art than ship muddy battle maps.

## Update v75 — Battle Grid Mapping / X-Y Calibration Foundation

### Why this update exists
Battle 001 still needs final clean art, but the runtime should not assume that every battle image maps perfectly to a simple full-image flex grid. Tactical battle maps need explicit x/y calibration so the game and future Battle Builder CMS can agree on where each tile exists.

### Added Architecture
- Added a reusable battle grid mapping module: `frontend/src/battle/gridMapping.ts`.
- Grid/overlay cells now use explicit percentage-based x/y calibration data instead of an implicit flex grid.
- Unit token placement now uses the same grid mapping helper as movement/attack overlays.

### Current Calibration Status
- Battle 001 uses a temporary rectangular full-image calibration.
- This is intentionally marked as placeholder status in code.
- Final Battle 001 art still needs to be regenerated as clean, gridless, brighter, x/y-friendly tactical art.

### Future Admin Requirement
The Battle Builder CMS must eventually let us:
- choose the battle map image
- set grid columns/rows
- calibrate playable grid bounds over the image
- paint terrain and passability per x/y tile
- mark impassable tiles for foot units
- mark flyer-permitted tiles
- mark hard blockers like walls/buildings that no unit can cross

### Strong Rule
Battle art is environment art only. Tactical information belongs in runtime/admin data, not baked into the image.


## Update v76 — Battle Map Axis-Aligned Art Requirement + Calibration Guardrails

### Why this update exists
The current high-quality Battle 001 reference is visually better than the rejected muddy gridless pass, but it is still too diagonally skewed for final square x/y tactical movement. The final battle map must be regenerated as clean, bright, gridless tactical environment art that naturally supports rectangular row/column movement.

### Final Battle 001 Map Requirements
- Bright JRPG/anime town neighborhood lighting matching the approved visual references.
- No baked-in grid lines, UI labels, title plaques, unit bases, target markers, or annotations.
- More top-down / orthographic tactical camera than the current angled reference.
- Playable ground should read as clean x/y lanes so square grid coordinates feel natural.
- Buildings, walls, fences, crates, gardens, and roofs must clearly imply passable vs blocked spaces.
- Child thief remains a non-combatant in the rear/background area, outside normal attack logic.

### Runtime / Dev Tooling Added
- Battle map metadata now explicitly marks the current art as `angled_reference` and `requiresFinalArt`.
- Battle Lab now exposes a temporary `XY` calibration overlay to show x/y tile coordinates for dev mapping checks.
- Runtime status warns that the current map is reference-only until proper axis-aligned art is approved.

### Future Battle Builder Requirement
The Battle Builder CMS must eventually allow:
- choosing a battle map image
- setting rows/columns
- calibrating the playable rectangle over the art
- painting terrain by x/y tile
- marking foot-blocked, flyer-passable, and hard-blocker tiles
- previewing blue movement, red attack, and orange danger overlays on that map

## Update v77 — Dynamic Actor Layer and Map Asset Purity

### Critical Battle Map Rule
Final battle map images must contain **environment art only**. They must not include any actor or object that the game needs to move, target, damage, hide, spawn, remove, or interact with dynamically.

Final battle maps must not include:
- the hero
- hero allies / party members
- enemies / thugs / monsters
- non-combatant story characters who need runtime placement
- selection bases
- baked target markers
- baked grid lines
- UI labels or title plaques

The map image is the battlefield background. All units are runtime entities placed by battle data.

### Runtime Actor Placement Rule
For Battle Lab testing, we can temporarily spawn the hero, thugs, and non-combatant child in code. For production, the Admin Battle Builder must decide:
- which party members spawn
- which enemies spawn
- where each unit starts on the x/y grid
- which non-combatants appear
- which units are controllable, enemy-controlled, neutral, or scripted

### Future Battle Builder CMS Requirement
The Battle Builder CMS must include an actor placement layer:
- choose battle map
- define grid rows/columns and playable bounds
- paint terrain/passability
- place player starting positions
- place enemy starting positions
- place neutral/non-combatant story actors
- mark reinforcements/spawn waves later
- link victory/defeat outcomes to story scenes

### v77 Implementation Note
Battle Lab now begins separating runtime actor visuals from the map by using actor sprite assets for the movable hero, thugs, and pickpocket child. This is still a prototype asset layer, but it enforces the correct architecture: **actors are runtime sprites, not part of the battle map image**.

### Strong Reminder
The current Battle 001 map is still reference-only because it contains visual/story elements that may not belong in final production art. The final accepted Battle 001 map must be regenerated as a clean x/y-friendly environment-only battlefield.
