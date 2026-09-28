# Repository agent instructions

- Read the active specification and every file named in its `context` frontmatter before implementation. Treat approved intent and boundaries as authoritative.
- Start required BMAD generators only through the active skill's entry point and ordinary narrow execution approval. Set `$env:WORKSPACE_ROOT` to the workspace containing `_bmad` and `.agents`, keep the skill-required working directory unchanged, and run:

  ```powershell
  uv run --no-cache "$env:WORKSPACE_ROOT/_bmad/scripts/render_skill.py" --project-root "$env:WORKSPACE_ROOT" --skill "$env:WORKSPACE_ROOT/.agents/skills/bmad-build"
  ```

  A restricted WinGet-link launch error is an execution-permission symptom, not proof of a broken installation or file association. Never record a personal home-directory path or change Windows security settings to work around it.
- Never capture, print, test, or commit credentials, meeting access values, private subscription links, tokens, cookies, or unrelated personal data. Report findings by category and filename without reproducing sensitive values.
- Preserve public-source structure, attribution, URLs, IDs, licenses, group identity, and named project contributors. Use unmistakably synthetic values for security fixtures and document derivation next to the fixture.
- Minimize captured HTML/PDF metadata and page chrome only when parser-focused tests prove the required source contract is unchanged. Do not broadly delete fixtures or generated evidence.
- Production and Docker use server-side SQLite as authoritative storage. Vite development/tests retain their isolated `localStorage` adapter. Never touch real browser data, databases, Docker volumes, ports, or user profiles during verification.
- Before staging or pushing, unfold ICS logical lines and scan tracked fixtures and documentation for credential patterns, private paths, metadata, and generated artifacts without printing matching values. Run focused tests, the full unit suite, the production build, Markdown-link validation, and `git diff --cached --check`.
