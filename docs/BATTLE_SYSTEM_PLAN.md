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
