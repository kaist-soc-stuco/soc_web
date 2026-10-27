# Reproducible demo content

The canonical demo inventory is `apps/api/drizzle/demo-content.ts`. Photos and
their source credits are bundled in `apps/api/drizzle/assets/demo/`; no downloads,
local article IDs, local survey UUIDs, or database exports are required.

With the development Compose stack running:

```bash
docker compose up -d --build
docker compose exec -T -e SEED_MODE=demo api pnpm db:seed
```

The second command is required: starting the containers applies migrations but
does not run the content seed automatically. A fresh database does not require
any additional patch scripts. Rebuilding the web image includes About photos,
the company-visit photo, and the TREE event fallback.

The seed refreshes the demo author's posts, surveys, votes, and reference About
content. It is not a way to preserve responses to those demo forms. Operational
application forms and non-demo users are managed separately. Production-mode
containers reject demo seeds; use the production reference seed for live content.

Dates use the seed run's current Korean calendar day. Past, ongoing, upcoming,
same-day closing, Korean-only, empty-description, and no-photo examples are
represented. Event registration forms remain linked to their event and do not
duplicate it in the public survey list or calendar. Academic dates are clearly
labelled as illustrative in their descriptions.
