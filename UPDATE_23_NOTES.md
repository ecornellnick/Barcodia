# Update 23 — Battle State Separation + Enemy Data Foundation

## Modified
- backend/server.py
- frontend/app/(tabs)/battle.tsx

## New
- backend/data/enemies/shared.json
- backend/data/enemies/quick_hunt.json
- backend/data/enemies/adventure/tier_1_forest.json
- backend/data/adventure/tiers.json

## Summary
- Quick Hunt and Adventure now use isolated battle preview states.
- Starting Adventure should no longer overwrite the saved Quick Hunt enemy.
- Starting Quick Hunt should no longer show the active Adventure node enemy.
- Adventure node start now returns the fight payload directly, so the frontend does not call the Quick Hunt preview afterward.
- Added starter enemy/adventure data files to prepare for future admin editing and cleaner biome-specific enemy pools.
- Boss/miniboss metadata is marked adventure-only in data files.
