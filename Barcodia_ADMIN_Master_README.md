# Barcodia — ADMIN SYSTEM MASTER README
_Last Updated: May 2026_

# PURPOSE OF THIS DOCUMENT

This document exists so a NEW ChatGPT chat/channel can immediately resume work on **Barcodia Admin Systems only** without losing context.

This README is intentionally extremely detailed to avoid repeated context rebuilding, regressions, or wasted time.

This document is ONLY focused on:

# ADMIN PORTAL DEVELOPMENT

NOT frontend polish.

NOT images.

NOT landscape/portrait experimentation.

NOT gameplay tuning.

Those happen later.

The immediate goal is:

> Build a powerful admin-first game brain so Nick can control nearly everything without editing code.

---

# PROJECT OVERVIEW

Game Name:
**Barcodia**

Tech Stack:

Frontend:
- React Native
- Expo
- TypeScript
- Expo Router

Backend:
- Python
- FastAPI

Admin:
- Browser-based Admin Portal

Architecture:
- Data-driven
- Admin-driven

Important philosophy:

The frontend should eventually become mostly a renderer of admin-controlled data.

Meaning:

Admin controls:
- story
- dialogue
- hotspots
- quests
- flags
- characters
- factions
- unlocks
- locations

Frontend reads admin data.

Avoid hardcoding.

---

# IMPORTANT WORKFLOW RULES

## 1. Getting Latest Files

If context is lost:

FIRST:

Try GitHub repo:

https://github.com/ecornellnick/Barcodia

BUT:

Nick's local files may be newer.

Always ask:

> Do you have newer local files that were not pushed yet?

Never assume GitHub is newest.

---

## 2. File Update Workflow (MANDATORY)

Development flow:

fix → zip → user tests → cleanup → commit/push

When updating:

ALWAYS send a zip.

Zip contains ONLY:

- modified files
- added files
- deletion instructions

Never resend entire project unless explicitly requested.

ALWAYS include:

Modified:
- file/path

Added:
- file/path

Removed:
- file/path

Even if empty.

---

## 3. File Generation Rule (IMPORTANT)

Repeated failure happened previously.

Never say:

"I am generating the file"

or

"I'll send the zip"

without actually including it.

RULE:

If ChatGPT says:
- file created
- zip ready
- MD ready
- packaged update ready

THEN it MUST be attached in THAT SAME RESPONSE.

No pretending.

---

# ADMIN-FIRST STRATEGY

We are changing roadmap priority.

OLD:
frontend → gameplay → admin

NEW:

ADMIN FIRST

Why:

Nick wants to control the game without needing code edits.

Admin becomes the game brain.

Frontend later consumes admin data.

Meaning:

Instead of hardcoding:

```ts
if forest_item_found:
    mom_dialogue = "..."
```

Nick should create this in Admin.

---

# ADMIN ROADMAP (NEW PRIORITY)

Build in this order.

---

# PHASE 1 — STORY BUILDER (TOP PRIORITY)

Goal:

Full story authoring without code.

Nick should be able to build story progression entirely inside Admin.

## New Admin Section

Story Builder

Purpose:
Create/edit story dialogue events.

Examples:

Kitchen Mom Intro

Forest Discovery

Beacon Quest

Window Narration

etc.

---

## Dialogue Event Model

Each dialogue event should support:

- id
- title
- location_id
- character_id
- trigger_type
- priority
- enabled
- conditions
- dialogue_lines
- choices
- effects

Example:

```json
{
  "id": "kitchen_mom_intro",
  "title": "Mom Intro",
  "location_id": "kitchen",
  "character_id": "mom",
  "trigger_type": "tap_npc",
  "priority": 1,
  "enabled": true
}
```

---

## Dialogue Lines

Support:

Speaker lines

Narration

Future branching

Example:

```json
{
  "speaker": "Mom",
  "portrait": "mom_avatar",
  "text": "Morning. Did you sleep okay?"
}
```

Narrator:

```json
{
  "speaker": "Narrator",
  "text": "You stare out the window..."
}
```

---

## Choices (Future)

Example:

```json
[
  {
    "text": "Ask about the relic",
    "next_id": "mom_relic_branch"
  }
]
```

---

## Effects

After dialogue completes:

Example:

```json
{
  "type": "set_flag",
  "flag": "mom_intro_complete",
  "value": true
}
```

Other effects:

- set_flag
- give_item
- remove_item
- unlock_location
- start_quest
- advance_quest
- complete_quest

---

# PHASE 2 — FLAGS / CONDITIONS SYSTEM

Goal:

Dynamic story progression.

Examples:

Before forest item:

Mom says:

> Be careful today.

After item:

Mom says:

> Wait... where did you get that?

Driven by:

```text
forest_item_found = true
```

---

## Flags

Admin should support:

Create/edit flags.

Examples:

- forest_item_found
- mom_intro_complete
- whisperwood_unlocked
- player_met_blacksmith

Fields:

- id
- name
- description
- default_value
- category

---

## Conditions

Dialogue/quests/hotspots should support:

Conditions:

Examples:

```json
[
  {
    "flag": "forest_item_found",
    "operator": "equals",
    "value": true
  }
]
```

Supported operators:

- equals
- not_equals
- greater_than
- less_than
- contains

---

# PHASE 3 — CHARACTER EDITOR

Admin section:

Characters

Tabs:

- Allies
- Foes
- NPCs/Townsfolk

Editable fields:

- id
- name
- portrait
- bio
- faction/allegiance
- unlock state
- tags
- notes
- future stats

Hero avatars become story characters.

Placeholder fantasy names are acceptable for now.

---

# PHASE 4 — QUEST BUILDER

Goal:

Nick builds quests without code.

Quest types:

- Main Quest
- Side Quest
- Event Quest

Fields:

- id
- name
- description
- category
- objectives
- rewards
- conditions
- start effects
- completion effects

Objective example:

```json
{
  "type": "find_item",
  "item_id": "forest_relic",
  "amount": 1
}
```

---

# PHASE 5 — LOCATION + HOTSPOT EDITOR

THIS IS VERY IMPORTANT.

Manual hotspot placement by ChatGPT has been unreliable.

Admin should control placement.

Hotspots should be percentage-based.

Never pixel-based.

Fields:

- id
- scene_id
- label
- x_pct
- y_pct
- width_pct
- height_pct
- icon
- action_type
- linked_dialogue
- linked_location
- linked_quest
- conditions

Example:

```json
{
  "id": "bedroom_window",
  "scene_id": "bedroom",
  "label": "Window",
  "x_pct": 72,
  "y_pct": 38,
  "width_pct": 12,
  "height_pct": 14
}
```

Actions:

- open_dialogue
- change_scene
- open_menu
- inspect
- open_computer
- rest
- battle
- custom

---

# PHASE 6 — LOCATION MANAGEMENT

Admin controls:

Realm Locations

Editable:

- realm
- location name
- description
- image asset
- hotspot list
- unlock conditions

Examples:

Real World:
- Bedroom
- Kitchen

Fantasy:
- Whisperwood Forest

---

# PHASE 7 — PLAYER CODEX

Future:

Frontend shows unlocked:

- allies
- foes
- NPCs
- lore
- bios

Admin controls data.

Frontend renders it.

---

# IMPORTANT DESIGN RULES

Admin should be:

- clean
- scalable
- professional
- no raw JSON editing by Nick

Use forms.

Use tabs.

Use filters.

Use dropdowns.

Think:

JRPG Story CMS

NOT:
developer config page

---

# WHAT NOT TO BUILD YET

Do NOT focus on:

- inventory polish
- battle redesign
- phone slide-out UI
- bottom nav overhaul
- image generation
- animations
- landscape/portrait debate

Focus ONLY on:

ADMIN GAME BRAIN.

---

# RECOMMENDED BUILD ORDER

1. Story Builder
2. Flags/Conditions
3. Character Editor
4. Quest Builder
5. Hotspot Editor
6. Location Management
7. Frontend consumes admin data

---

# CHATGPT WORKING STYLE

When unsure:

ASK QUESTIONS.

Do not invent UX.

Nick often has screenshots.

Prefer:

small focused updates

Always send zip.

Always include modified file list.

Never pretend files were created.

