# Barcodia Master Brain Roadmap & Project Recovery Guide

_Last updated: May 2026_

## Purpose

This document is the single master brain roadmap and recovery guide for Barcodia.

Use this file when starting a new chat, recovering context, onboarding a fresh ChatGPT instance, or resuming development after a break.

---

# 1. Project Overview

Barcodia is a mobile-first anime/JRPG-inspired game.

## Tech Stack

- Frontend: React Native + Expo + TypeScript
- Routing: Expo Router
- Backend: Python + FastAPI
- Admin Portal: browser-based admin tooling
- Architecture: data-driven/admin-driven
- Current development style: iterative update zips

## Core Game Concept

The player moves between:

- Real World
- Fantasy Realm

using a mysterious phone/portal system.

The game blends:

- story
- dialogue
- world exploration
- quests
- battle
- scanning real-world items
- dual-world mechanics
- RPG progression

---

# 2. Current High-Level Direction

## Real World

Current key location:

- Bedroom

Other real-world locations planned:

- Kitchen
- Home areas
- Grocery store
- Hotel
- Other story locations

## Fantasy Realm

Current key location:

- Whisperwood Forest

Future fantasy locations may include:

- tavern
- inn
- shop
- healer
- town square
- dungeon/battle areas

## Major Direction

The game should feel like a polished mobile anime JRPG, not a raw menu app.

Prefer:

- visual scenes
- tappable hotspots
- dialogue boxes
- character portraits
- phone-like app UI

Avoid:

- ugly system modals
- hardcoded story
- baked text in images
- giant boring buttons
- static labels embedded in backgrounds

---

# 3. Critical Recovery Instructions

## 3.1 Getting Latest Files

If ChatGPT loses context, starts in a new chat, or needs the latest files:

FIRST try the GitHub repo:

https://github.com/ecornellnick/Barcodia

If the repo is private, unavailable, not cloneable, or appears out of date, ask the user for local files.

Important:

The user's local files may be newer than GitHub.

Ask:

> Do you have newer local files that were not pushed yet?

Never assume GitHub is newest.

## 3.2 If Asking For Local Files

Do NOT ask for the full 700–800 MB project zip unless absolutely necessary.

Prefer a targeted zip.

For Expo/frontend landscape/UI work, ask for:

```text
frontend/
├── app/
├── components/
├── assets/images/realms/
├── assets/images/characters/
├── app.json or app.config.ts
├── package.json
├── tsconfig.json
```

Also useful if present:

```text
frontend/hooks/
frontend/constants/
frontend/types/
frontend/data/
```

Do NOT request:

```text
node_modules/
.expo/
dist/
build/
ios/
android/
coverage/
.cache/
```

unless native project files are specifically needed.

---

# 4. Mandatory File Update Workflow

Development flow:

```text
fix → zip → user tests → cleanup → commit/push
```

When ChatGPT updates code:

## ALWAYS SEND A ZIP

The zip must contain ONLY:

- modified files
- newly added files
- deletion notes if needed

Do NOT resend unchanged files.

Do NOT resend entire project unless explicitly requested.

## ALWAYS LIST CHANGED FILES

Every zip response must include:

```text
Modified:
- path/to/file

Added:
- path/to/file

Removed:
- path/to/file
```

Even if a section is empty, include it.

## File Generation Rule

If ChatGPT says:

- file generated
- zip generated
- MD created
- download ready
- packaged update ready

then the file must be included in that exact same response.

If it is not ready, say it is not ready.

Do not pretend.

This rule exists because previous chats wasted time by saying a file was being generated without actually attaching it.

---

# 5. Expo Commands & Local Development

Barcodia uses Expo.

Common commands should usually be run from the frontend project folder.

Example:

```bash
cd frontend
npm install
npx expo start
```

If Metro cache is stale:

```bash
npx expo start -c
```

Run Android:

```bash
npx expo start --android
```

Run iOS:

```bash
npx expo start --ios
```

Run web if supported:

```bash
npx expo start --web
```

Check TypeScript if script exists:

```bash
npm run typecheck
```

Check lint if script exists:

```bash
npm run lint
```

If dependencies break:

```bash
rm -rf node_modules
npm install
npx expo start -c
```

## Git Commands After Testing

After user tests a patch:

```bash
git status
git add .
git commit -m "Update message here"
git push
```

For the current landscape update, likely commit message:

```bash
git commit -m "Update 45: force landscape and prepare hotspot editor"
```

---

# 6. Current Important Visual Lock Notes

## Generated Images

The current kitchen image was manually downloaded by the user and is considered locked.

The current bedroom image was generated after the kitchen and is also considered locked.

Do not resend those images unless explicitly asked.

Do not overwrite locked images without permission.

## Scene/Image Rules

All backgrounds must:

- work in the current target orientation
- fill available screen area appropriately
- never stretch or squish
- never contain baked text
- never contain baked labels
- never contain prompt leakage
- support dynamic hotspot placement
- feel like premium anime/JRPG backgrounds

All labels and dialogue must be programmatic UI.

Never bake:

- Computer
- Window
- Bed
- Kitchen
- Mom
- dialogue text
- narration
- prompt fragments

into image assets.

---

# 7. Current Priority Change: Landscape First

Before fixing hotspots, force the game into landscape mode.

Reason:

- wider scenes fit JRPG style better
- older wide backgrounds may become usable again
- hotspots are easier to place accurately
- dialogue has more natural room
- bottom nav can be redesigned with more space
- avoids doing hotspot work twice

## Landscape Update Scope

The next update should focus on:

1. Force landscape orientation in Expo config.
2. Adjust root layout/screen containers if needed.
3. Update WORLD scene layout for landscape.
4. Ensure images use correct resize mode and do not stretch.
5. Preserve Whisperwood if it already looks good.
6. Reassess bedroom/kitchen only after landscape is active.
7. Add a foundation for admin-driven hotspot placement later.

## Likely Expo Orientation Setting

If using app.json:

```json
{
  "expo": {
    "orientation": "landscape"
  }
}
```

If using app.config.ts:

```ts
export default {
  expo: {
    orientation: "landscape"
  }
};
```

Also check for any runtime orientation package or screen layout code.

---

# 8. Hotspot Placement Direction

Manual AI placement has been unreliable.

Future target:

Admin Portal should place hotspots.

## Admin Hotspot Editor Goals

Admin can edit:

- scene/location
- hotspot label
- x position percentage
- y position percentage
- width/height or size
- icon
- action type
- linked dialogue
- linked scene
- required flags/conditions

Example model:

```json
{
  "id": "bedroom_computer",
  "scene_id": "bedroom",
  "label": "Computer",
  "x_pct": 18,
  "y_pct": 62,
  "width_pct": 12,
  "height_pct": 10,
  "action_type": "open_computer"
}
```

Coordinate system should use percentages, not hardcoded pixels.

This allows the user to tune placement visually.

---

# 9. Dialogue UX Rules

Story dialogue should follow JRPG / visual novel conventions.

Requirements:

- background location visible
- lower dark dialogue box
- tap to continue
- speaker portrait appears/slides in
- narrator styling distinct from character speech
- future choices supported
- dialogue should not auto-return from scenes unless explicitly designed

User may provide screenshots for reference.

---

# 10. Bottom Navigation Direction

Current bottom five icons are temporary and evolving.

The direction is to eventually make the phone central.

## Current/near-term bottom nav

Likely current tabs:

- STATUS
- WORLD
- PHONE
- BAG
- REALM

BAG should use a backpack icon, not a box.

The bottom nav should feel:

- premium
- mobile
- JRPG
- clean
- app-like
- readable

## Future Phone Hub

PHONE should open a slide-up pseudo-smartphone UI.

Potential phone apps:

- Travel
- Quest Log
- Character Codex
- Inventory
- Hero/Gear
- Map
- Realm Travel
- Contacts
- Story Mode
- Battle, fantasy only

This reduces clutter in bottom nav.

---

# 11. Master Roadmap

## Phase 1 — Visual/UI Stabilization

Goal:

Stop visual regressions and lock the foundation.

### 1.1 Landscape Mode

- force landscape
- fix screen containers
- fix image scaling
- adjust dialogue placement
- reassess backgrounds

### 1.2 World Scene Polish

- Bedroom hotspot alignment
- Kitchen hotspot alignment
- Whisperwood preservation
- portrait/landscape-safe system depending final orientation
- back button consistency

### 1.3 Bottom Nav Overhaul

- premium JRPG/mobile feel
- cleaner spacing
- backpack icon
- better active states
- future PHONE support

### 1.4 Dialogue UX

- lower black dialogue box
- character portrait slide-in/out
- tap to continue
- future choices

---

## Phase 2 — Admin Story Brain

Goal:

No hardcoded story logic.

Admin-controlled story system.

### Story Builder

Create/edit:

- dialogue events
- triggers
- flags
- conditions
- effects

Example:

```text
forest_item_found = true
```

Mom dialogue changes after the player finds an item in Whisperwood.

### Dialogue Event Fields

- id
- title
- location_id
- trigger_type
- conditions
- priority
- dialogue_lines
- choices
- effects

### Effects

- set_flag
- give_item
- unlock_location
- start_quest
- advance_quest

---

## Phase 3 — Character Admin

Admin section:

Characters

Tabs:

- Allies
- Foes
- NPCs / Townsfolk

Editable:

- name
- bio
- portrait
- allegiance/faction
- unlock status

Hero avatars become story characters.

---

## Phase 4 — Player Character Codex

Player-facing encyclopedia/codex.

Only shows unlocked characters.

Includes:

- allies
- enemies
- townspeople
- lore
- bios

Likely lives inside PHONE.

---

## Phase 5 — PHONE System Overhaul

PHONE becomes slide-up smartphone UI.

Purpose:

- reduce clutter
- organize many systems
- support real-world/fantasy travel logic

Potential apps:

- Travel
- Quest Log
- Character Codex
- Inventory
- Hero/Gear
- Map
- Realm Travel
- Contacts
- Story Mode
- Battle

---

## Phase 6 — Story Mode + Quest Tracker

Story Mode placeholder first:

```text
Coming Soon...
```

Quest tracker is critical.

Should help user remember current objective.

Future quest types:

- main quest
- side quest
- event quest
- timed quest

---

## Phase 7 — Dual World Rules

Real world ↔ fantasy world.

Phone is current portal concept.

Need systems:

### Gear mismatch

Fantasy armor in real world should cause either:

1. Auto-glamour mapping, recommended for simplicity.
2. Manual wardrobe swap, with NPC reactions if forgotten.

Needs later design discussion.

---

## Phase 8 — Location Interaction Framework

Replace boring menus with tappable environments.

Fantasy examples:

- tavern
- inn
- shop
- healer
- town square

Real world examples:

- grocery store
- hotel
- home
- coffee shop

AI-generated scenes will be needed.

User has screenshots/examples for UX later.

---

## Phase 9 — Currency System

Separate economies.

Fantasy:

- gold or fantasy-specific currency

Real world:

- dollars/cents

Do not freely convert unless intentionally designed later.

---

## Phase 10 — Inventory Overhaul

BAG redesign:

- backpack icon
- smaller item cards
- stack quantity badges
- filter popup
- clear filter
- sorting

Need equipped-item handling later.

Currently equipped items should not be casually stacked with normal bag items.

---

## Phase 11 — Battle Architecture Rework

Battle likely fantasy-only.

Possibly moved into PHONE.

Conditional visibility depending world.

Real-world random battle is not appropriate.

---

# 12. Recommended Immediate Build Order

1. Force landscape mode.
2. Fix landscape layout/image scaling.
3. Reassess bedroom/kitchen/Whisperwood in landscape.
4. Temporary hotspot cleanup only if needed.
5. Bottom nav landscape polish.
6. Admin hotspot placement foundation.
7. Dialogue UX system.
8. Admin Story Builder foundation.
9. Character admin.
10. Quest tracker + Story Mode placeholder.
11. PHONE slide-up hub.
12. Inventory overhaul.
13. Dual-world gameplay systems.

---

# 13. Instructions For ChatGPT Working Style

When unsure:

ASK QUESTIONS.

Do not guess on UX/UI.

The user often has screenshots.

Prefer:

- direct action
- files included immediately
- concise explanation
- exact changed file lists

Avoid:

- overexplaining instead of packaging
- claiming files are generated when they are not
- sending whole project
- changing unrelated systems
- regenerating locked images
- touching Whisperwood if it is approved

