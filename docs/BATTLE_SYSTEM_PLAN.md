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

### v52 — Movement System
- select unit
- terrain-aware move range
- pathing
- move unit
- acted state

### v53 — Combat System
- basic attacks
- HP/damage
- terrain defense modifiers
- melee/ranged rules
- counterattack stub

### v54 — Turns + AI
- player phase
- enemy phase
- each unit acts once
- simple thug AI
- win/loss conditions

### v55 — Langrisser Feel Layer
- unit info panel
- combat preview
- terrain tooltip
- floating damage
- movement tween
- attack effects
- placeholder sprites

### v56 — Story Integration
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
