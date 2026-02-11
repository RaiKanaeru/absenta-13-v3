# Absenta13 OpenCode Workflow

- Keep changes focused; avoid large refactors when fixing a specific bug.
- Follow AGENTS.md first, then use these rules for OpenCode-specific workflow.
- Backend work: run `npm run test:server` or focused `node --test` before finishing.
- Frontend work: run `npm run lint` and relevant `vitest` tests before finishing.
- Production incidents: check `docker-compose ps`, then `docker-compose logs -f app`.
- Do not modify `src/components/ui/*` unless explicitly requested.
