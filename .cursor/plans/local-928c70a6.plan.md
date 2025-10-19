<!-- 928c70a6-e486-4a97-b129-47bae3752b2a 361c1f1a-e8a7-4c1e-ac60-6d7a15c3b191 -->

# PRD — LocalSpotlight: AI for Google Business Profiles (v1.0)

## 1) Goals

- Automate high-quality GBP content: posts, Q&A, review replies, images.
- Offer automation modes: Off, Auto-create (approve to post), Full Autopilot (no approval).
- Human-in-the-loop remains available and configurable per org/location/content type.
- Ground outputs on first‑party data; no external web search in v1.
- Multi-tenant SaaS with secure RLS and org/locations.
- Roadmap parity with Paige: social cross-posting, video creation, image optimization, review campaigns, widgets, heatmaps, citations.

## 2) Key decisions

- **Models**: GPT‑4o‑mini default, GPT‑4o fallback; runware.ai api for images; text-embedding-3-large for RAG.
- **Stack**: Next.js App Router + TS, Tailwind/shadcn, Supabase (Postgres + RLS + pgvector), Vercel Cron/Queues or Supabase cron.
- **GBP**: OAuth with offline access; sync locations, reviews, Q&A, media, performance. Posts publishing via API if your access allows; otherwise manual assist workflow.
- **Automation modes**: Per org & per location, per content type (posts, Q&A, review replies): Off | Auto-create | Full Autopilot.

## 3) In-scope features (v1)

- Connect Google, sync GBP accounts/locations.
- Content generation: Posts (What’s New, Offers, Events), Q&A suggestions, review reply drafts, branded images.
- Approval queue + policy checks + moderation (when approval mode is enabled).
- Scheduler + content calendar.
- Brand voice settings and safety rules (banned terms, required disclaimers, links/CTAs).
- Basic analytics (content throughput + GBP performance where available).
- Autopilot engine with guardrails, risk gating, and confidence thresholds.

## 4) Non-goals (v1)

- External web search (Perplexity/Google), competitor monitoring, auto A/B tests, cross-posting to other networks (moved to v1.1).

## 5) Personas

- Owner/Admin: connects Google, sets brand voice, automation policy, approves content if enabled.
- Content Manager: generates/edits/approves, schedules; monitors Autopilot.
- Reviewer: approves only when approval is enabled.

## 6) User stories (high-level)

- As an Admin, I choose automation per location and content type.
- As a Manager in Auto-create mode, I receive draft posts/replies/Q&A to approve.
- As a Manager in Full Autopilot, I get notifications of what was published with undo controls (when supported).
- As a Manager, I manage a calendar of scheduled and published content.

## 7) External APIs & scopes

- Business Profile API: `https://businessprofile.googleapis.com/v1/`
- Performance API: `https://businessprofileperformance.googleapis.com/v1/`
- Q&A API: `https://mybusinessqanda.googleapis.com/v1/`
- OAuth scope: `https://www.googleapis.com/auth/business.manage` (read/write)
- Notes: Review reply supported; Q&A supported; Posts publishing is limited—enable only if your account has access.

## 8) Data model (Supabase)

- `orgs` (id, name, plan)
- `org_members` (org_id, user_id, role)
- `users` (id, email, name)
- `connections_google` (org_id, account_id, refresh_token_enc, scopes)
- `gbp_accounts` (org_id, google_account_name, display_name)
- `gbp_locations` (org_id, google_location_name, meta jsonb, sync_state)
- `gbp_reviews` (org_id, location_id, review_id, author, rating, text, reply, state)
- `gbp_qna` (org_id, location_id, question_id, question, answer, state)
- `gbp_media` (org_id, location_id, media_id, url, type)
- `ai_briefs` (org_id, location_id, type, brief jsonb, embeddings vector)
- `ai_generations` (org_id, location_id, kind: post|qna|reply|image, input jsonb, output jsonb, status, model, costs, risk_score numeric)
- `post_candidates` (org_id, location_id, schema jsonb, images[], status)
- `schedules` (org_id, location_id, target_type, target_id, publish_at, status, provider_ref)
- `automation_policies` (org_id, location_id, content_type, mode enum: off|auto_create|autopilot, max_per_week int, quiet_hours jsonb, risk_threshold numeric, require_disclaimers bool, delete_window_sec int)
- `safety_rules` (org_id, banned_terms text[], required_phrases text[], blocked_categories text[])
- `audit_logs` (org_id, actor_id, action, target, meta)

pgvector on `ai_briefs` and/or normalized content tables for RAG.

## 9) RLS pattern

- Every table has `org_id`.
- Policy: users can access rows where `org_id` ∈ orgs they belong to via `org_members`.
- Roles: owner, admin, editor, viewer (write scopes vary per table).

## 10) AI orchestration

- Provider-agnostic service: prompt templates, JSON-schema outputs, deterministic parsing, retries, and cost guardrails.
- Default model 4o‑mini; escalate to 4o on low confidence/JSON-parse errors/long briefs.
- Moderation via `omni-moderation-latest` before approval/publish.
- Risk scoring in outputs: `risk_score` 0–1 (brand/policy risk). Gate Autopilot by `risk_threshold`.
- Structured checks: max headline length, required CTA/link for offers/events, disclaimers.
- Caching: hash(prompt+grounding) to dedupe suggestions; TTL 7–30 days.

### JSON schemas (for Claude Code to implement)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "GbpPost",
  "type": "object",
  "required": ["type", "headline", "body"],
  "properties": {
    "type": { "enum": ["WHATS_NEW", "EVENT", "OFFER"] },
    "headline": { "type": "string", "maxLength": 58 },
    "body": { "type": "string", "maxLength": 1500 },
    "cta": { "enum": ["LEARN_MORE", "CALL", "SIGN_UP", "BOOK", "ORDER", "SHOP"] },
    "link": { "type": "string", "format": "uri" },
    "hashtags": { "type": "array", "items": { "type": "string" }, "maxItems": 6 },
    "imageBrief": { "type": "string", "maxLength": 400 },
    "riskScore": { "type": "number", "minimum": 0, "maximum": 1 }
  }
}
```

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",

  "title": "GbpQna",

  "type": "object",

  "required": ["question", "answer"],

  "properties": {
    "question": { "type": "string", "maxLength": 150 },

    "answer": { "type": "string", "maxLength": 1500 },

    "tags": { "type": "array", "items": { "type": "string" }, "maxItems": 5 },

    "riskScore": { "type": "number", "minimum": 0, "maximum": 1 }
  }
}
```

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "GbpReviewReply",
  "type": "object",
  "required": ["reply"],
  "properties": {
    "reply": { "type": "string", "maxLength": 4096 },
    "rationale": { "type": "string", "maxLength": 300 },
    "riskScore": { "type": "number", "minimum": 0, "maximum": 1 }
  }
}
```

## 11) Autopilot engine

- Nightly/weekly planners create briefs per location based on cadence rules and content gaps (e.g., last post age, seasonal templates, service rotation) without external web search.
- For each location and content type, Autopilot evaluates `automation_policies` and `safety_rules`:
  - If mode=off → only manual/assistant flows.
  - If mode=auto_create → generate+moderate; enqueue approval with SLA reminders.
  - If mode=autopilot → generate+moderate; publish when: risk_score ≤ threshold; within quiet hours policy; within max/week cap; required fields present.
- Review replies Autopilot: autopublish only for low-risk (e.g., 4–5 star, no complaints/PII). Route 1–3 star or flagged content to approvals.
- Q&A Autopilot: auto-answer incoming public questions within guardrails; seed new Q&A on safe evergreen topics per cadence.
- Failure handling: retry/backoff; on repeated failures switch to auto_create and notify.

## 12) Posting adapter

- Mode A (if allowed): publish posts via GBP Posts API for selected locations; upload images via Media API and attach; support delete/edit when available; optional short undo window via delayed publish (delete_window_sec).
- Mode B (fallback): store approved/auto content, email/Slack reminders, one-click "Copy post"; optional Zapier export; still track as "published (manual)".

## 13) Background jobs

- Google sync (accounts, locations, reviews, Q&A, media) every 6–24h.
- Performance metrics ingest nightly.
- Autopilot planners and generators per cadence (daily/weekly) per location.
- Scheduler: at `publish_at`, publish via adapter; retry with backoff; alert on failures.
- Token refresh & rotation; revoke handling.

## 14) UX surfaces (Next.js routes)

- `/dashboard` (org, KPIs, tasks)
- `/locations` list → details: posts, reviews, Q&A, media
- `/approvals` queue (posts/qna/replies/images)
- `/calendar` (month/week/day)
- `/settings/brand` (voice, banned terms, links)
- `/settings/automation` (mode, caps, quiet hours, thresholds, delete window)
- `/settings/integrations/google` (connect, locations picker)

## 15) Compliance & safety

- OpenAI moderation for text; block disallowed content and sensitive claims.
- GBP policy checks: no misleading/regulated claims; appropriate images; proper event/offer fields; no PII in public posts/Q&A.
- Quiet hours and max/week caps enforced before publish.
- Audit log of all AI outputs, approvals, and publishes; notifications for all autopublishes.

## 16) Analytics (basic)

- Generation → approval rate; time-to-approval; scheduled → published rate.
- Autopilot: publish count, failure rate, escalations to approval, average risk score.
- Per-location cadence and topic mix.
- GBP performance (views/clicks) if available; store daily rollups.

## 17) Operational

- Rate limits/backoff for Google & OpenAI; circuit breakers.
- Cost caps per org; switch to 4o only on demand or on low-confidence.
- Observability: request/latency/error dashboards; dead-letter queue for failed jobs; alerting.

## 18) Parity with Paige — roadmap modules

- Social cross-posting (FB/IG): publish approved/auto GBP posts to Facebook Pages & Instagram Business via Meta Graph API; link back to GBP.
- Image optimization: rename for keywords, generate alt/meta text, add optional EXIF geotags (lat/lng), compress; schedule photo uploads.
- Video creation: slideshow videos from images with captions/music, brand overlay; publish to GBP/YouTube/FB/IG.
- Review request campaigns: email/SMS flows to request reviews; compliant deep links; optional “suggested reviews” template generation.
- Website widgets: embeddable script to show recent GBP posts/reviews/photos on user sites.
- Heatmap rankings: integrate with a provider API to render local rank heatmaps; scheduled reports.
- Citations management: integrate with a listings provider for 40+ directories; sync from GBP.

## 19) Additional integrations & data model (roadmap)

- `connections_meta` (org_id, page_id, ig_biz_id, tokens)
- `social_posts` (org_id, location_id, source_post_id, fb_post_id, ig_post_id, status)
- `image_jobs` (org_id, location_id, transforms, exif_json, status)
- `video_jobs` (org_id, location_id, spec jsonb, output_url, status)
- `review_campaigns` (org_id, location_id, channel enum, template, send_at, status)
- `widgets` (org_id, token, config)
- `heatmap_reports` (org_id, location_id, provider, parameters, result_url)
- `citations_jobs` (org_id, location_id, provider, status)

## 20) Milestones

- M1 (2–3 wks): Auth/Org/RLS, Google connect/sync, AI briefs + basic generations, approvals, review replies draft, brand & automation settings (off/auto_create).
- M2 (2–3 wks): Scheduler + calendar, images + media upload, Q&A publish, analytics v1, performance ingest, posting adapter, Autopilot (autopilot) with guardrails.
- M3 (2–4 wks): Social cross-posting, image optimization, video creation; review campaigns v1; widgets v1; provider hooks for heatmaps/citations (behind flags).

## 21) Acceptance criteria (samples)

- Can connect Google, see all locations.
- Automation settings saved per location/content type with caps, quiet hours, thresholds.
- Auto-create mode: drafts appear without user action; approval publishes; full audit trail.
- Full Autopilot: compliant content publishes without approval under thresholds/caps; notifications sent; undo window honored when supported.
- Review replies: 4–5 star replies autopublish; 1–3 star routed to approvals.
- Q&A: auto-answer public questions; seed 3 evergreen Q&A per location per month.
- Calendar shows scheduled/published across locations.
- Social: approved/auto GBP posts are cross-posted to FB/IG with links back to GBP.
- Image optimization: filenames/meta updated; optional EXIF set; photos uploaded on schedule.
- Video: slideshow videos generated and posted to at least one target (e.g., YouTube or GBP if supported).
- RLS prevents cross-org access in row-level tests.

### To-dos

- [ ] Implement Supabase auth, orgs, org_members, RLS pattern
- [ ] Add Google OAuth (offline), list accounts/locations, nightly sync
- [ ] Create core tables and enable pgvector for RAG
- [ ] Build AI service with schemas, prompts, retries, moderation
- [ ] Brand voice settings UI and storage
- [ ] Automation settings UI and enforcement per location/content type
- [ ] Generate posts grounded in data; approvals UI
- [ ] DALL·E 3 image briefs, render, store, media upload
- [ ] Ingest reviews; draft replies; approve and post
- [ ] Suggest questions/answers; approve and publish
- [ ] Job scheduler and calendar UI; retries/alerts
- [ ] GBP post publish (if allowed) + manual fallback
- [ ] Implement planners, risk gating, caps, quiet hours
- [ ] Dash KPIs + performance API ingest/rollups
- [ ] Logs, metrics, dead-letter queues, rate limiting
- [ ] Email/Slack notifications and undo window for autopublish
- [ ] Meta connection and FB/IG cross-posting
- [ ] Filename/meta/EXIF geotagging + photo scheduling
- [ ] Slideshow video generation and publishing
- [ ] Email/SMS review request flows with deep links
- [ ] Embeddable website widgets for posts/reviews/photos
- [ ] Integrate heatmap rank provider and scheduled reports
- [ ] Integrate citations provider syncing 40+ directories
