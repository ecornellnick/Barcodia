# Barcadia — Tactical Battle System Plan

_Last updated: May 2026_

## Direction
The Barcadia battle system will become a Langrisser-inspired, turn-based tactical RPG system using a square grid.

The battle system will start in an isolated **Battle Test Lab** so it does not break the current story/location runtime.

## First Battle Milestone

### Battle 001 — City Street Ambush
The hero leaves home and is tricked by a child pretending to need help. The child steals his money and runs away. When the hero gives chase, 2–3 thugs block him near the street outside his house.

The child is present in the back/corner as a non-combatant:
- cannot move
- cannot attack
- not a win/loss target unless scripted later
- exists for story context

## Visual References
Battle references are stored in:

```text
ConceptArt/BattleReferences/
```

Current references:
- `conceptArtBattle.png` — bright JRPG tactical battle art direction reference
- `firstBattleMap.png` — first battle map mockup outside hero's home

Strong visual rule:
> Battle maps should stay bright, readable, vibrant, anime/JRPG-inspired, and not muddy/dark/grainy.

## Prototype Chunks

### v51 — Battle Lab + Battlefield Foundation
- isolated dev battle screen
- square grid
- first battle map shell
- terrain tiles
- units placed
- blue move overlay
- red attack overlay preview

### v52 — Terrain + Map Data Foundation
- reusable battle engine folder
- terrain definitions
- City Street Ambush scenario data
- terrain-aware movement preview

### v53 — Unit Movement
- select unit
- terrain-aware move range
- pathing
- tap legal blue tile to move
- blocked/occupied tile prevention
- moved-state tracking

### v54 — Combat / HP / Damage / Defeat State
- basic attacks
- attack range targeting
- HP bars
- terrain defense modifiers
- melee/ranged rules
- simple counterattack
- defeated unit state
- victory/defeat condition detection

### v55 — Turns + Enemy AI
- player phase
- enemy phase
- each unit acts once
- simple thug AI
- win/loss screen

### v56 — Langrisser Feel Layer
- unit info panel
- combat preview
- terrain tooltip
- floating damage
- movement tween
- attack effects
- placeholder sprites

### v57 — Story Integration
- story choice or hotspot starts battle
- battle victory triggers story scene/effects
- battle defeat triggers alternate story scene/effects

## Terrain Plan

| Terrain | Move Cost | Defense | Notes |
|---|---:|---:|---|
| Road / Stone | 1 | 0 | common city terrain |
| Grass | 1 | 0 | normal |
| Garden / Bush | 2 | +10–20% | light cover |
| Crates / Barrels | blocked or 2 | +10% | cover/choke point |
| Fence / Wall | blocked | n/a | obstacle |
| Stairs | 2 | optional | elevation later |
| Water / Canal | blocked | n/a | unless special unit later |

## Unit Plan

First major 4v4 test later:
- Hero
- Sister
- Tank
- Archer
- 4 foes

First narrative battle may start smaller:
- Hero vs 2–3 thugs
- child non-combatant

## Skill + Cooldown System

### Goal
Heroes should learn and equip skills. Skills can be exclusive to one hero or shared by multiple heroes/classes. Skills should support cooldowns like tactical RPGs/Langrisser-style combat.

### Langrisser Reference Notes
Langrisser Mobile skills commonly expose data such as cooldown, range, and span/area. Some active skills have cooldowns after use, while others can be used every turn. Some effects reduce cooldowns after combat, after dealing damage, or after defeating a target.

Reference links:
- https://wikigrisser-next.com/skills
- https://toucharcade.com/2019/01/25/langrisser-guide-tips-cheats-strategies-and-how-to-play-free-longer/
- https://www.reddit.com/r/langrisser/comments/arwjjl/your_dads_enchantment_guide/

### Skill Ownership
A skill may be:
- exclusive to one hero
- shared by multiple heroes
- class-based
- learned by progression
- unlocked by story
- granted by equipment or temporary battle effects

### Skill Data Model Draft

```json
{
  "id": "skill_long_shot",
  "name": "Long Shot",
  "type": "active",
  "category": "ranged_attack",
  "allowed_heroes": ["archer"],
  "allowed_classes": ["archer", "ranger"],
  "cooldown_turns": 1,
  "initial_cooldown_turns": 0,
  "range_min": 2,
  "range_max": 3,
  "area": "single_enemy",
  "targeting": "enemy",
  "ends_action": true,
  "effects": [
    { "type": "damage", "scale": 1.2 }
  ],
  "tags": ["ranged", "physical"]
}
```

### Cooldown Runtime Rules for First Prototype
- active skills may have cooldowns
- when used, a skill becomes unavailable for its configured cooldown
- cooldown decreases at the start of the unit’s next turn or side phase
- skill buttons show cooldown remaining
- cooldown values are admin-editable later
- using a skill normally ends the unit’s action

### Early Test Skills

Hero:
- Strike — cooldown 1
- Rally — cooldown 3

Sister:
- Heal — cooldown 2
- Spark — cooldown 1

Tank:
- Guard — cooldown 2
- Shield Bash — cooldown 2

Archer:
- Long Shot — cooldown 1
- Pinning Shot — cooldown 2

## Future CMS Page

Add later:

```text
Skills Builder
```

Should support:
- create/edit skills
- assign to heroes/classes
- exclusive/shared toggle
- cooldown settings
- range/area settings
- icon selection
- animation/VFX reference
- effects list
- validation

## Implementation Rule
The Battle Test Lab may be temporary, but reusable battle engine code must live under:

```text
frontend/src/battle/
```

Temporary sandbox route:

```text
frontend/app/dev/battle-lab.tsx
```

---

# Update v51 — Dev Battle Lab Foundation

## Purpose
Add an isolated, dev-only testing surface for the tactical battle system before connecting battles to the live story/runtime flow.

## Why this exists
The battle system should be tested independently so early tactical-grid work does not break existing Barcadia exploration, hotspots, story triggers, or Dev Mode tools.

## Added files / planned replacement files
- `frontend/app/dev/battle-lab.tsx`
- `frontend/assets/images/battle/first_battle_map.png`
- `frontend/app/(tabs)/world.tsx`
- `docs/BATTLE_SYSTEM_PLAN.md`
- `docs/BARCADIA_CHANGELOG_ROADMAP.md`

## Battle Lab v1 behavior
- Opens from the in-game Dev Mode panel.
- Uses the approved bright city first-battle reference map.
- Shows a square grid overlay.
- Places first-battle story units:
  - Hero in plain clothes
  - 3 thug enemies
  - hidden pickpocket child as non-combatant
- Shows terrain data and unit stats.
- Shows prototype movement and attack overlays.

## Strong constraint
This is dev-only and isolated. No story progression, hotspot runtime, or main game flow should depend on this screen yet.

## Next battle chunks
1. Terrain-aware movement with legal/illegal tile handling.
2. Basic combat, HP, and attack range.
3. Turn order and enemy AI stub.
4. Skills and cooldowns.
5. Battle result flow back into story runtime.

---

## Update v52 — Terrain + Map Data Foundation

### Strong Architecture Rule: Temporary Entry Point, Permanent Engine
The Battle Lab route is only a dev/testing shell. It must not become ghost code or a duplicate battle implementation.

Temporary/dev-only:

```text
frontend/app/dev/battle-lab.tsx
```

Permanent/reusable battle engine:

```text
frontend/src/battle/
```

Before launch, the project must have:
- no ghost/relic code
- no abandoned test-only battle logic in production flow
- no duplicate battle engines
- no visible stub buttons/text
- all visible controls working or removed

The Battle Lab can remain hidden behind Dev Mode for QA, but story battles must eventually call the shared battle engine modules, not copied lab logic.

### Added in v52
- Reusable battle types in `frontend/src/battle/types.ts`
- Terrain rules in `frontend/src/battle/terrain.ts`
- First battle scenario data in `frontend/src/battle/maps/cityStreetAmbush.ts`
- Battle Lab now imports data/helpers from the reusable engine layer instead of owning all logic inline.
- Movement preview now uses terrain-aware movement costs.

### Terrain Rules v1
- Stone Walkway: normal movement, no bonus
- Open Road: fast but exposed, small defense penalty
- Yard Grass: small defensive bonus
- Crates/Cover: slower movement, strong defense bonus
- Narrow Alley: chokepoint defensive tile
- Fence/Low Wall: slow obstacle tile with defense bonus
- House/Wall: blocked

### Next Chunk
v53 should add real unit movement:
- select unit
- tap valid blue tile to move
- prevent illegal moves
- consume unit action/move state
- show current phase/action status

---

## Update v53 — Tactical Unit Movement

### Added in v53
- Battle Lab units are now stateful instead of static scenario tokens.
- Selecting a unit updates its legal movement preview.
- Tapping a blue legal tile moves the selected ally unit.
- Movement respects terrain cost from the reusable terrain engine.
- Units cannot move into blocked terrain or occupied tiles.
- Moving a unit marks it as moved for the current test phase.
- Added Battle Lab controls:
  - Refresh Movement
  - Reset Battle Lab
- Added a lightweight battle log for movement/testing feedback.

### Reusable Battle Engine Additions
- `frontend/src/battle/movement.ts`
  - `getUnitAt`
  - `isTileOccupied`
  - `calculateLegalMoveTiles`
  - `canMoveUnitTo`
  - `moveUnit`
  - `resetAllyMovement`

### Still Isolated / Dev-Only
The Battle Lab remains a testing shell. Movement logic lives in reusable `frontend/src/battle/` modules so the future story-integrated battle runtime can call the same movement functions without copying lab code.

### Known Limitations
- Movement animation is not polished yet.
- There is no path preview line yet.
- Enemy units can be selected for inspection, but only allied units can move.
- No attack execution or turn system yet.

### Next Chunk
v54 should add basic combat:
- select target in attack range
- apply damage
- terrain defense modifiers
- HP display updates
- defeat/KO state
- simple combat log


## Update v54 — Combat / HP / Damage / Defeat State

Changed files:
- `frontend/app/dev/battle-lab.tsx`
- `frontend/src/battle/combat.ts`
- `frontend/src/battle/types.ts`
- `frontend/src/battle/index.ts`
- `docs/BATTLE_SYSTEM_PLAN.md`
- `docs/BARCADIA_CHANGELOG_ROADMAP.md`

Added:
- Attack targeting from selected ally to enemy units on red attack tiles.
- HP bars on unit tokens and the selected-unit panel.
- Terrain-aware damage calculation using defender terrain defense modifiers.
- Simple counterattack when defender survives and attacker is in defender range.
- Defeated state for units.
- Victory/defeat condition detection hooks for the next turn-system chunk.

Known limitations:
- No player/enemy phase system yet.
- No enemy AI yet.
- No combat preview panel yet.
- No battle result screen yet.

Next planned update:
- v55 Turns + Enemy AI + victory/defeat flow.

---

## Intermittent Update — Cinematic Dev Viewer

Before continuing the battle chunks, Dev Mode was expanded with a cinematic test viewer so current MP4 cinematics can be previewed in-game.

### Important Asset Rule
The repo-root `Cinematics/` folder can hold working cinematic files and personal cinematic references. Runtime-tested MP4s are served by the backend from:

```text
/cinematics/<filename>
```

Current expected test file:

```text
Cinematics/Opening Cinematic Latest.mp4
```

### No Ghost Code Rule
The Dev Mode cinematic button is temporary/testing-only. The actual reusable concept is a Cinematic Player that Story Builder can eventually call from an event or story scene.

When production cleanup happens, dev-only cinematic entry points must be removed or hidden.

---

## Intermittent Update — Cinematic Orientation Testing

Before continuing battle chunks, Dev Mode cinematic testing was upgraded with two fullscreen presentation options:

- Portrait Fullscreen
- Landscape Fullscreen

This helps decide whether Barcadia should continue portrait-first, move toward a landscape-first “new era RPG” presentation, or support different cinematic layouts. This is intentionally dev-only and does not alter the battle roadmap.

### No Ghost Code Note
The cinematic test buttons are temporary Dev Mode utilities. They should be hidden or removed before launch unless turned into a proper production cinematic player triggered by Story Builder events.

### Next Battle Chunk
Resume with tactical battle turn system + enemy AI + victory/defeat flow.
