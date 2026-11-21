# Sikt read-only access preparation

## Public documentation check, 2026-09-08

The check covered public documentation and an unauthenticated request. Access applications, account creation, sign-in and contact with Sikt were outside its scope. Sikt is optional for running Ajour.

Ajour has a server-side client and a schema check prepared for Sikt. The production endpoint returned HTTP 401 UNAUTHENTICATED, "Authorization-header mangler". Authenticated education search still needs access approval and schema verification.

The official [access guide](https://fs.sikt.no/tjenester/nasjonale-register/utdanningsregister/api/skaffe-tilgang/) was available in the search index on 2026-09-08 but direct opening returned 404 in the independent probe. Its cached official text specifies Maskinporten scope `sikt:utdanningsregisteret/utdanning.read`, production `https://api.fsweb.no/graphql`, test `https://api-test.fsweb.no/graphql`, and headers `Authorization: Bearer <access_token>` and `Feature-Flags: beta,experimental`. This is not proof of an authenticated domain query.

## Operator setup

1. Register an integration in the appropriate [Maskinporten self-service portal](https://sjolvbetjening.samarbeid.digdir.no/) and obtain approval for the read scope. Follow [Digdir's consumer guide](https://docs.digdir.no/docs/Maskinporten/maskinporten_guide_apikonsument.html) for credentials and short-lived tokens.
2. Supply `SIKT_ENABLED=true`, `SIKT_ENVIRONMENT=production` (or `test`) and a current `SIKT_ACCESS_TOKEN` to the Node server process through a local secret manager. Do not place secrets in VITE-prefixed variables, source files, browser storage, backups, screenshots, or version control. The app does not acquire tokens or manage signing keys.
3. Explicitly run `node server/probe-sikt.js`. The adapter sends only a fixed, standard read-only GraphQL introspection query to one of the two allowlisted endpoints. Redirects fail closed. Errors omit tokens and response bodies. This command is not exposed as a browser endpoint and is never run at startup.
4. If introspection is disabled, obtain the official schema from Sikt. Verify actual query root fields, institution IDs, course code/name filtering, academic-year/semester versioning, campus semantics, pagination, credits and descriptions. Do not infer GraphQL field names from UI labels.
5. Implement a fixed named domain query and mapping only after those fields are confirmed. Add authenticated read-only fixtures and a narrowly scoped real request. Until then, configured access still returns `schema-verification-required`; no successful education import is claimed.

The adapter accepts a fixed read-only query and limits requests to the two Sikt endpoints. The token stays on the Node server and is sent only to Sikt. Public NTNU and TimeEdit imports, manual registration and file or link import work independently of this adapter.
