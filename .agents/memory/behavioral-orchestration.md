---
name: Behavioral Orchestration
description: Tier-gated AI model selection and behavioral state shaping for rubai coach turns.
---

## Architecture

Three new lib files in `artifacts/api-server/src/lib/`:
- `behavioralEvents.ts` — fire-and-forget event logger (logBehavioralEvent)
- `behavioralAnalytics.ts` — recomputes state from 14-day event window; getBehavioralState for fast DB read
- `behavioralOrchestration.ts` — buildOrchestrationConfig → OrchestrationConfig (model, tone, depth, focus, behavioralAddendum)

Two new DB tables: `behavioral_events`, `user_behavioral_state`.

## Tier Gating

- **Free**: MODEL_FAST, no behavioral addendum in system prompt
- **Pro**: MODEL_SMART + energy/procrastination-aware tone
- **Premium**: MODEL_SMART + full multi-signal (energy + mood + cognitiveLoad + flow + peakHours + motivationType)

**Why:** model costs scale with tier; premium users pay for deeper AI reasoning.

## Wiring in atlas.ts

Both `/coach` and `/coach/stream` routes:
1. Fetch user tier from DB (with `.catch(() => [{tier:"free"}])` fallback)
2. `getBehavioralState(userId)` — read pre-computed row
3. `buildOrchestrationConfig(state, tier)` → orchConfig
4. `orchConfig.behavioralAddendum` appended to systemContext (null for free)
5. model = `hasImage ? MODEL_VISION : orchConfig.model`
6. After response: `logBehavioralEvent` + `recomputeBehavioralStateAsync` fire-and-forget

**How to apply:** Any new coach-style endpoint should follow this same pattern.
