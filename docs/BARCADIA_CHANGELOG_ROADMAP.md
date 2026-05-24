# Barcadia — Running Changelog + Future Roadmap

_Last updated: May 2026_

This document is the running project memory for the Barcadia CMS/game runtime work. It should stay in the repository so future development sessions can quickly understand what has been built, what changed, what is still unstable, and what is planned next.

## Current Major Milestone Status

We have completed the first major phase of the admin-driven RPG architecture:

**CMS-authored content can now drive live in-game behavior.**

The important breakthrough was proving this loop:

```text
Admin CMS
  -> data files / backend API
  -> React Native runtime
  -> hotspots/story/dialogue/actions visible in game
```

The next major project milestone is the **Langrisser-style tactical battle system prototype**.

---

# Completed Work Log

## Admin CMS Foundation

### Story Builder
- Renamed the old **Dialogue Events** concept into **Story Builder**.
- Shifted the design philosophy from raw developer config editing to an RPG Maker-style story CMS.
- Added story scenes with fields such as:
  - title
  - chapter
  - location attachment
  - trigger type
  - dialogue/narration lines
  - player choices
  - conditions
  - effects
- Added visual guidance/help modals for CMS pages.
- Added Story Builder attachment to locations/backgrounds.

### Storyboard / Branching Editor
- Added a fullscreen Storyboard editing mode.
- Added compact timeline/story card editing concept.
- Added grouped player choice blocks with up to 4 options.
- Choice options can map to outcome story scenes.
- Added storyboard inspector editing.
- Added add/edit/delete/move/duplicate controls for story nodes/lines.
- Added validation/QA warnings around missing choice outcomes.
- Added Save / Save + Close behavior.
- Added Ctrl/Cmd+S save shortcut inside Storyboard.
- Added better no-jump and real-estate improvements to the Storyboard modal.

### Known Storyboard Notes
- Storyboard has improved significantly but likely still needs future UX polish.
- The approved visual mockup is still the design target.
- Avoid reintroducing giant vertical form walls.
- No visible button should be a stub. If a control appears, it must work.

---

## Locations + Hotspots

### Location Builder
- Added/cleaned **Locations / Hotspots** page.
- Added location creation workflow with draft behavior.
- New locations should not auto-save until explicitly saved.
- Locations save to:

```text
backend/data/realms/locations.json
```

- Added location locking to prevent accidental deletion/archive.
- Locked locations require confirmation before archive/delete.
- Added archive/restore safety behavior.
- Improved location categories/tags.
- Added ability to add/delete tags and assign/remove tags from locations/backgrounds.

### Hotspot Builder
- Added visual hotspot placement over actual game backgrounds.
- Hotspots save percentage-based coordinates.
- Hotspots render in the game at the same percentage location.
- Added drag-to-move hotspot placement in admin.
- Improved hotspot icon/circle styling.
- Added delete controls for hotspots.
- Added action type controls for hotspots.
- Added clearer hotspot action labels:
  - talk / open dialogue
  - travel / change location
  - computer
  - rest
  - item
  - quest
  - battle
  - custom
- Added hotspot condition flag filtering.
- Added one-time hotspot support using fields like:
  - `disable_after_use`
  - `one_time`
  - `once`

### Game Integration Breakthrough
- Admin-created hotspots now appear in the game runtime.
- This was the first major proof that the game can be admin-driven.

---

## Branding / CMS Visual Skin

### Barcadia Rename / Theme Direction
- The project name in UI direction shifted toward **Barcadia**.
- Future references to old “Barcodio” branding should be changed when touched.
- CMS visual direction: fantasy JRPG admin console, not a plain web form.

### Visual Skin Work
- Added fantasy dark/gold/purple CMS styling.
- Added header/banner/logo concepts.
- Added wooden divider concept.
- Added fantasy-styled controls and checkboxes.
- Known note: visual layout is improved but should continue to avoid:
  - horizontal scrollbars
  - cut-off panels
  - excessive vertical scrolling
  - dead visual chrome that wastes real estate

---

## Character / Dialogue Runtime

### Dialogue Runtime
- Story scenes attached to locations can trigger in-game.
- Enter-location story scenes can auto-run when entering a mapped location.
- Hotspots linked to story scenes can open story dialogue.
- Dialogue box was moved lower, closer to the bottom nav area.
- Hotspots are hidden/disabled while dialogue is active to prevent story-breaking clicks.
- Player choices can appear in the runtime and branch to mapped outcome scenes.

### Speaker / Avatar Handling
- Speaker names should resolve from Character Builder data.
- Avoid showing raw IDs such as `new_character_...` to the player.
- Added Mom avatar asset:

```text
frontend/assets/images/characters/mom_avatar.png
```

### Future Dialogue Presentation Idea
Still planned:
- Instead of only showing a small avatar in the dialogue box, use JRPG-style character portraits that slide in from left/right depending on speaker.
- When speaker changes, previous portrait can slide out and next speaker can slide in.

---

## Runtime Action System

### Action Executor
Added the first runtime action executor layer so story/hotspot interactions can do more than display text.

Supported or stub-supported actions include:
- travel to location
- open dialogue/story scene
- set flag
- give item
- start quest
- advance quest
- complete quest
- start battle stub
- rest
- open computer
- custom placeholder behavior

### Story Effects
- Story scenes can run start/completion effects.
- Choices and hotspots can trigger runtime actions.
- Missing or broken targets should warn more clearly rather than silently failing.

### Runtime State
Temporary/dev runtime state includes:
- flags
- inventory/items
- quests
- event/action log
- triggered scenes
- used one-time hotspots

---

## Dev Mode / Testing Toolkit

### Dev Mode v1
Added an in-game Dev Mode control panel for local testing.

Features added:
- floating DEV button in local/dev mode
- jump to any location
- trigger any story scene
- replay enter-location story trigger
- clear active dialogue
- reset to Bedroom
- show current location/realm/story state
- inspect runtime state

### Dev Mode Fixes
- Fixed reset-to-bedroom realm/location targeting.
- Prevented reset from incorrectly falling back to Whisperwood/bundled placeholder hotspot data.
- Improved cross-realm location jumping.

### Persistence + Snapshots
Added local persistence for dev testing:
- flags
- items
- quests
- used hotspots/actions
- snapshots

Added snapshot tools:
- save checkpoint
- restore checkpoint
- reset story triggers
- clear test save
- soft/full reset controls

### Runtime QA Tools
Added runtime QA checks in Dev Mode:
- missing hotspot targets
- broken story choice outcomes
- attached location story trigger checks
- warnings for missing travel/item/flag/quest/battle targets
- runtime event log
- save-state viewer

---

# Current Testing Recommendation

We are now ready for a serious integration testing pass before the battle system milestone.

Recommended testing flow:

1. Start in Bedroom using Dev Mode.
2. Verify Dev Mode reset/jump tools.
3. Jump to Whisperwood.
4. Trigger a location-enter story.
5. Verify dialogue speaker names and avatars.
6. Verify hotspots disappear while dialogue is active.
7. Trigger a hotspot story.
8. Test a choice branch.
9. Confirm branch outcome scene plays.
10. Test a travel action.
11. Test flag/item/quest stub actions.
12. Save a snapshot.
13. Restore snapshot.
14. Run Dev QA check and review warnings.

---

# Known Issues / Watch Items

## Storyboard
- Needs careful testing after recent chunks.
- Ensure it does not jump or re-render while typing/selecting.
- Ensure no horizontal/vertical scrollbars appear in the modal unless intentionally part of a contained panel.
- Ensure all visible buttons work.
- Ensure choices do not create bloat.

## Story/Choice Actions
- Choices currently map most naturally to story scenes.
- Future work should allow choice options to directly perform action bundles:
  - travel
  - battle
  - item
  - quest
  - flag
  - story scene

## Assets
- Avatar/background asset paths need continued cleanup.
- Production should serve art assets cleanly from backend/static storage or CDN.

## Persistence
- Current runtime persistence is local/dev-oriented.
- Production should move important mutable data to a database.

---

# Future Roadmap

## Next Major Milestone: Tactical Battle System Prototype

Goal: Build a dummy Langrisser-style tactical grid battle system that can be launched from story choices/hotspots.

### Battle Prototype v1 — Dummy Tactical Combat
- square grid map
- player units
- enemy units
- movement range
- attack range
- turn order
- selected unit state
- end turn
- simple win/loss conditions
- placeholder attack animations/effects
- battle result returns to story runtime

### Battle Prototype v2 — RPG Integration
- story choice can start battle
- hotspot can start battle
- battle victory can trigger story scene/effects
- battle defeat can trigger alternate story scene/effects
- rewards can set flags/items/quests

### Battle Builder CMS
Create an admin page for building battles:
- battle ID/title
- map size
- terrain grid
- player start positions
- enemy placements
- enemy types
- objectives
- rewards
- win/lose result scenes
- pre/post battle dialogue

### Later Tactical Features
- terrain bonuses
- unit classes
- skills/spells
- enemy AI
- formations
- range previews
- battle camera polish
- JRPG battle animations
- status effects
- equipment integration

---

## Story / CMS Expansion Roadmap

### Choice Action Bundles
Upgrade choices so each option can do an action bundle, not only link to a story scene.

Example:

```text
Choice: Fight the wolf
  -> Start Battle: wolf_intro
  -> Set Flag: accepted_fight

Choice: Run away
  -> Travel: forest_exit
  -> Set Flag: avoided_wolf
```

### Story Conditions v2
- richer visual condition builder
- AND/OR condition groups
- flag checks
- quest state checks
- inventory checks
- character state checks
- battle outcome checks

### Effects Builder v2
- multi-effect bundles
- reorder effects
- validate missing targets
- preview effect outcome

### Dialogue Presentation Polish
- sliding speaker portraits
- emotion portraits
- speaker side selection
- typewriter text effect
- narration box style distinct from dialogue
- player choice style polish

---

## Items / Equipment Roadmap

The Item Builder was restored earlier but needs future expansion.

Planned fields:
- item type
  - weapon
  - armor
  - consumable
  - key item
  - quest item
  - material
- rarity
- icon
- description
- stats
- equip slot
- stackable
- sell value
- usable in battle
- usable in field
- effects

Integration goals:
- story/hotspot gives item
- item can unlock dialogue/location/quest
- items persist in save state
- equipment affects tactical battles later

---

## Database / Production Roadmap

For local/dev, JSON files are okay.

For live/production, important mutable content should move to a database.

### Database Candidates
- locations
- hotspots
- story scenes
- dialogue lines
- flags/conditions
- quests
- items/equipment
- characters
- battles
- player saves/progress

### File Storage Candidates
- backgrounds
- portraits
- icons
- music
- sound effects

### JSON Future Role
- seed data
- export/import
- rollback snapshots
- dev fixtures

---

# Repo / Workflow Notes

## Zip Update Rule
When sending future updates, include only files that need replacing, not the whole project.

## Commit Habit
After major working milestones, commit before moving to the next large system.

Good examples:

```bash
git add .
git commit -m "Milestone - admin-driven hotspots render in game"
git push
```

```bash
git add .
git commit -m "Dev Mode v1 milestone - story/location controls and runtime testing tools"
git push
```

## Recommended Next Commit
After v50 testing toolkit is installed and smoke-tested:

```bash
git add .
git commit -m "RPG runtime testing milestone - Dev Mode, story actions, persistence, and QA tools"
git push
```

---



## Update v54 — Battle Combat Foundation

Changed files:
- `frontend/app/dev/battle-lab.tsx`
- `frontend/src/battle/combat.ts`
- `frontend/src/battle/types.ts`
- `frontend/src/battle/index.ts`
- `docs/BATTLE_SYSTEM_PLAN.md`
- `docs/BARCADIA_CHANGELOG_ROADMAP.md`

What changed:
- Added basic attack targeting inside the isolated Battle Lab.
- Added HP/damage/defeat state.
- Added terrain-aware damage modifiers.
- Added simple counterattack behavior.
- Added unit HP bars and combat log messages.
- Added victory/defeat detection hooks for the next turn-system chunk.

What to test later after battle chunks are complete:
- Select Hero.
- Move into range.
- Tap a thug in a red attack tile.
- Confirm damage applies and HP bars update.
- Confirm defeated enemies show defeated state.

Known limitations:
- No enemy phase yet.
- No battle result screen yet.
- No final sprites/animations yet.

Next roadmap step:
- v55 turn system, simple thug AI, and win/loss flow.

# Current High-Level Status

The project is now entering this stage:

```text
Admin-driven story/location runtime: BUILT ENOUGH TO TEST
Dev Mode testing toolkit: BUILT ENOUGH TO TEST
Tactical battle system: NEXT MAJOR MILESTONE
```

---

# Update — Tactical Battle Skill + Cooldown System

## Date
May 2026

## Why This Was Added
Before committing the tactical battle roadmap, we decided heroes must support learnable skills and cooldowns. This should be designed now, before the Langrisser-style battle prototype begins, so the battle engine, unit data, and future Battle Builder CMS do not need to be rewritten later.

## Design Goal
Barcadia tactical battles should support a Langrisser-inspired skill system where heroes can learn and equip active/passive skills, and each skill can have its own cooldown behavior.

## Langrisser Mobile Reference Notes
Langrisser Mobile uses hero skills with dedicated skill buttons. Some skills replace or augment a normal attack, some are passive, and some have cooldowns after use while others can be used every turn. Skills commonly define properties such as cost, cooldown, range, and span/area. Many skills use cooldown values such as 1, 2, 3, or more turns depending on power and role. Some effects reduce cooldowns after combat, on kill, or through special talents/equipment.

Reference examples and observations:
- Langrisser skill data commonly includes **Cooldown**, **Range**, and **Span** fields.
- Some faction/buff skills use cooldowns around 3 turns and effects lasting multiple turns.
- Some transformation or powerful skills can have longer cooldowns such as 6 turns.
- Some talents or effects reduce cooldown after combat, after dealing damage, or after defeating an enemy.
- Some skills have effectively no cooldown and can be used every turn.

### Reference Links
- Langrisser skills database / examples: https://wikigrisser-next.com/skills
- Langrisser terrain and tactical systems background: https://langrisser.fandom.com/wiki/Terrain
- Langrisser general guide mentioning skill buttons and cooldowns: https://toucharcade.com/2019/01/25/langrisser-guide-tips-cheats-strategies-and-how-to-play-free-longer/
- Example community note on cooldown reduction effects: https://www.reddit.com/r/langrisser/comments/arwjjl/your_dads_enchantment_guide/

## Barcadia Skill System Requirements

### Skill Ownership
Skills must support both exclusive and shared usage.

A skill can be:
- exclusive to one hero
- available to multiple heroes
- class-based
- unlocked by story progress
- unlocked by level/progression
- granted temporarily by equipment, story events, or battlefield conditions

### Hero Skill Loadout
Each hero should eventually have:
- learned skills list
- equipped skill slots
- active skills
- passive skills
- ultimate/signature skill slot later

Early prototype can start simple:

```text
Hero
- Basic Attack
- Strike
- Guard Break

Sister
- Basic Magic
- Heal
- Courage Blessing

Tank
- Basic Attack
- Guard
- Shield Wall

Archer
- Basic Shot
- Long Shot
- Pinning Shot
```

## Skill Data Model Draft

Recommended future JSON/DB-style structure:

```json
{
  "id": "skill_guard",
  "name": "Guard",
  "description": "Protects a nearby ally and reduces incoming damage.",
  "type": "active",
  "category": "defense",
  "allowed_heroes": ["tank"],
  "allowed_classes": ["guardian", "knight"],
  "cooldown_turns": 2,
  "initial_cooldown_turns": 0,
  "range": 1,
  "area": "single_ally",
  "targeting": "ally",
  "effects": [
    { "type": "guard", "duration_turns": 1 },
    { "type": "damage_reduction", "value": 0.25, "duration_turns": 1 }
  ],
  "tags": ["defensive", "tank", "support"]
}
```

## Cooldown Design

### Core Rule
When a skill is used, it becomes unavailable for its configured cooldown.

Example:

```text
Turn 1: Hero uses Power Strike, cooldown_turns = 2
Turn 2: Power Strike cooldown remaining = 1
Turn 3: Power Strike available again
```

### Cooldown Properties
Each skill should support:
- `cooldown_turns`: default cooldown after use
- `initial_cooldown_turns`: optional cooldown at battle start
- `current_cooldown`: runtime-only state per unit
- `cooldown_reduction_effects`: future effects that reduce cooldowns
- `cooldown_start_timing`: when cooldown begins, usually after skill use/action resolves

### Admin Editable
Cooldowns must be editable in the future Battle/Skill CMS.

Admin should be able to set:
- cooldown turns
- starting cooldown
- whether skill can be used after moving
- whether skill ends the unit’s action
- whether skill can counterattack
- targeting type
- range
- area of effect
- effects/buffs/debuffs

## Runtime Rules for v1 Prototype

For the first battle prototype, keep cooldowns simple.

Minimum system:
- every unit has a list of skills
- active skills have cooldown turns
- cooldown decreases by 1 at the start of that unit’s next turn or at the start of the owning side’s phase
- skill button disabled when cooldown > 0
- tooltip shows “Cooldown: X turn(s)”
- using a skill consumes the unit’s action unless marked otherwise

Recommended starting skills:

### Hero
- **Strike** — melee attack, cooldown 1
- **Rally** — small self buff, cooldown 3

### Sister
- **Heal** — restore HP to ally, cooldown 2
- **Spark** — ranged magic attack, cooldown 1

### Tank
- **Guard** — protect ally / damage reduction, cooldown 2
- **Shield Bash** — melee attack + push/stun later, cooldown 2

### Archer
- **Long Shot** — ranged attack, cooldown 1
- **Pinning Shot** — ranged attack + movement debuff later, cooldown 2

## Future Skill Builder CMS

Add a future CMS page:

```text
Skills Builder
```

Capabilities:
- create/edit skill
- assign skill to hero/class
- mark exclusive/shared
- set cooldown
- set range/area
- define effects
- choose icon
- choose animation/VFX
- preview skill description
- validate missing targets/effects

## Battle Builder Integration

Battle Builder should later let us:
- choose available heroes
- choose enemy skills
- choose starting cooldowns if needed
- script special cooldown events
- add battle objectives tied to skill usage

Example:

```text
Tutorial Objective:
Use Sister's Heal skill on Hero.
```

## Changelog Entry

### Added to Roadmap Before Tactical Battle Prototype
- Hero skill system planning
- Shared/exclusive skill ownership planning
- Skill cooldown design
- Admin-editable cooldown requirements
- Skill Builder CMS future page
- Langrisser-inspired cooldown reference notes

## Next Battle Planning Step
Before implementation, design the first battle prototype data model with:
- battle map
- terrain grid
- units
- basic skills
- cooldown runtime state
- action execution flow

---

## Update v51 — Dev Battle Lab Foundation

### Changed Files
- `frontend/app/(tabs)/world.tsx`
- `frontend/app/dev/battle-lab.tsx`
- `frontend/assets/images/battle/first_battle_map.png`
- `docs/BARCADIA_CHANGELOG_ROADMAP.md`
- `docs/BATTLE_SYSTEM_PLAN.md`

### Added
- Dev Mode button to open an isolated Battle Test Lab.
- New `frontend/app/dev/battle-lab.tsx` route for tactical battle prototyping.
- Approved bright city first-battle map reference added as a frontend battle asset.
- Initial Battle 001 setup:
  - Hero in plain clothes
  - 3 thug enemies
  - hidden/non-combatant pickpocket child
  - square grid overlay
  - terrain info panel
  - unit info panel
  - movement/attack preview overlays

### Notes
- This is intentionally isolated from the main game runtime.
- No story or hotspot flow should depend on this route yet.
- The goal is to safely prototype the Langrisser-style tactical battle system without destabilizing exploration/story systems.

### Known Limitations
- Units do not move yet.
- Attacks do not apply damage yet.
- Turn order and AI are not implemented yet.
- Sprites are placeholder tokens over the approved battle-map reference.

### Next Planned Update
- v52: terrain-aware movement system.

---

## Update v52 — Battle Terrain + Map Data Foundation

### Changed Files
- `frontend/app/dev/battle-lab.tsx`
- `frontend/src/battle/types.ts`
- `frontend/src/battle/terrain.ts`
- `frontend/src/battle/maps/cityStreetAmbush.ts`
- `frontend/src/battle/index.ts`
- `docs/BATTLE_SYSTEM_PLAN.md`
- `docs/BARCADIA_CHANGELOG_ROADMAP.md`

### What Changed
- Began moving battle logic out of the dev lab and into permanent reusable battle modules.
- Added the first reusable tactical battle data model.
- Added terrain definitions and terrain-aware movement preview calculation.
- Added the first battle scenario data for Battle 001 — City Street Ambush.
- Updated Battle Lab to use reusable `frontend/src/battle/` modules.

### Architectural Guardrail
Battle Lab is a temporary/dev-only testing shell. The reusable battle engine lives under `frontend/src/battle/`. Before launch, remove or hide dev-only routes and verify there is no ghost/relic code, no duplicate battle logic, no stub text, and no dead buttons.

### What To Test Later
- Battle Lab still opens from Dev Mode.
- City Street Ambush still renders.
- Selecting units updates movement/attack preview.
- Blue movement preview reflects movement costs rather than raw distance only.
- Terrain legend and selected terrain panel show correct values.

### Known Limitations
- Units do not actually move yet.
- No attacks/damage yet.
- No turn system yet.
- No enemy AI yet.

### Next Planned Update
v53 — Tactical unit movement.

---

## Update v53 — Tactical Unit Movement

### Changed Files
- `frontend/app/dev/battle-lab.tsx`
- `frontend/src/battle/types.ts`
- `frontend/src/battle/movement.ts`
- `frontend/src/battle/index.ts`
- `docs/BATTLE_SYSTEM_PLAN.md`
- `docs/BARCADIA_CHANGELOG_ROADMAP.md`

### What Changed
- Added real unit movement to the isolated Battle Lab.
- Movement is now terrain-aware and uses the reusable battle engine helpers.
- The selected ally can move by tapping legal blue tiles.
- Illegal movement is blocked with battle-log feedback.
- Occupied tiles and blocked terrain cannot be entered.
- Added reset/refresh testing controls for movement iteration.

### Architectural Guardrail
Battle Lab remains dev-only. Reusable battle logic belongs in `frontend/src/battle/`. Before launch, dev-only routes must be removed or hidden, and there should be no ghost code, no duplicate battle systems, no visible stubs, and no dead buttons.

### What To Test Later
- Open Battle Lab from Dev Mode.
- Select Hero.
- Tap a blue tile and confirm Hero moves.
- Try tapping blocked/occupied/non-blue tiles and confirm movement is rejected.
- Confirm Refresh Movement allows movement again.
- Confirm Reset Battle Lab restores starting positions.

### Known Limitations
- No attacks/damage yet.
- No turn phase system yet.
- No enemy AI yet.
- No polished movement animation/path line yet.

### Next Planned Update
v54 — Basic combat, attack execution, HP/damage, terrain defense modifiers, and defeat state.

---

## Update v55 — Dev Cinematic Viewer Intermittent Update
Date: 2026-05-24

### Changed Files
- `backend/server.py`
- `frontend/app/(tabs)/world.tsx`
- `docs/BARCADIA_CHANGELOG_ROADMAP.md`
- `docs/BATTLE_SYSTEM_PLAN.md`

### Added
- Dev Mode now includes a **Cinematic Test Viewer** button.
- Backend now serves repo-root cinematic files from:

```text
Cinematics/
```

through:

```text
/cinematics/<filename>
```

- The opening cinematic test expects this file to exist locally:

```text
Cinematics/Opening Cinematic Latest.mp4
```

### Purpose
This lets us test how cinematic MP4 playback feels inside the game without hard-wiring cinematics into the story runtime yet.

### Architecture Note
The Dev Mode cinematic viewer is a testing entry point only. The reusable direction is:

```text
Story Scene / Event
  -> Cinematic Player
  -> Continue Story
```

Before launch, dev-only cinematic buttons must either be hidden from production or removed as part of the no-ghost-code cleanup.

### Known Limitations
- The MP4 is not bundled in this zip because it already lives locally in the repo-root `Cinematics/` folder.
- If playback fails, verify the file path and restart the backend so the static route can serve it.

### What To Test
1. Start the backend.
2. Confirm this file exists: `Cinematics/Opening Cinematic Latest.mp4`.
3. Open the game.
4. Open Dev Mode.
5. Tap **Open Cinematic**.
6. Confirm the video plays and can be closed cleanly.

### Next Planned Update
Return to the tactical battle system roadmap:
- v55/v56 battle turn system + enemy thug AI + victory/defeat flow.

---

## Update v56 — Cinematic Fullscreen Orientation Options
Date: 2026-05-24

### Changed Files
- `frontend/app/(tabs)/world.tsx`
- `docs/BARCADIA_CHANGELOG_ROADMAP.md`
- `docs/BATTLE_SYSTEM_PLAN.md`

### Added
- Dev Mode now offers two cinematic preview modes:
  - **Portrait Fullscreen**
  - **Landscape Fullscreen**
- Cinematic playback now opens as an edge-to-edge fullscreen test viewer without the previous decorative frame/border.
- Landscape mode simulates a full landscape presentation so we can compare portrait-first versus landscape-first cinematic direction.

### Purpose
This lets us evaluate what the player sees for MP4 cinematics before committing to the final game orientation strategy.

### No Ghost Code Rule
This remains a dev-only testing entry point. The reusable production concept is still a Cinematic Player callable from story events. Before launch, dev-only cinematic buttons must be removed or hidden.

### What To Test
1. Confirm backend is running.
2. Confirm `Cinematics/Opening Cinematic Latest.mp4` exists.
3. Open Dev Mode.
4. Tap **Portrait Fullscreen** and verify edge-to-edge playback.
5. Close it cleanly.
6. Tap **Landscape Fullscreen** and verify the landscape presentation fills the screen without the old UI frame.

### Next Planned Update
Return to battle chunks: turn system, enemy thug AI, and victory/defeat flow.
