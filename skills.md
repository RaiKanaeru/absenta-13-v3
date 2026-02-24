---
name: absenta13-skills
description: Reusable agent skills for Absenta13 development and ops.
version: 1
---

# Skills

## Skill: start-dev
When to use: Start local development stack (frontend + backend).
Inputs:
- env: localhost | network (optional, if setup scripts exist)
Steps:
1. If `.env` is missing, copy `.env.example` or run `node setup-localhost.js` / `node setup-network.js` if those scripts exist.
2. Start Redis:
   - Windows repo binary: `redis\redis-server.exe` (if present), or use your system service.
3. Terminal A: `npm run dev`
4. Terminal B: `node server/index.js`
Done when:
- Frontend on http://localhost:5173 and backend on http://localhost:3001 respond.

## Skill: run-tests
When to use: Validate changes before commit or deploy.
Steps:
1. Run `npm test`.
2. If tests fail, summarize top errors and likely owner (frontend or backend).
Done when:
- Tests pass, or failures are reported with next actions.

## Skill: add-api-endpoint
When to use: Add or update a backend endpoint.
Inputs:
- role: admin | guru | siswa | general
- resource: short resource name
Steps:
1. Confirm frontend usage with `rg -n "getApiUrl" src/`.
2. Add or update the route in `server/routes/` following `/api/{role}/{resource}`.
3. Implement controller and service with validation, auth, and the standard response shape.
4. Add a test or provide a manual curl example for verification.
Done when:
- Endpoint responds with `{ ok: true }` on success and proper HTTP status codes on failure.

## Skill: export-excel-rekap
When to use: Update Excel export logic (class or teacher recaps).
Inputs:
- type: rekap_kelas_gasal | rekap_guru_tahunan | jadwal (optional)
Steps:
1. Verify templates exist under `server/templates/excel/`.
2. Load the template with ExcelJS; do not rebuild the workbook from scratch.
3. Fill only input cells; do not overwrite formula cells.
4. Use `server/config/exportConfig.js` mapping if present.
5. Smoke check key header cells and formula columns.
Done when:
- Output matches template formatting and formulas still work in Excel.

## Skill: deploy-prod
When to use: Deploy changes to the production server.
Steps:
1. Local: `git add -A`, `git commit -m "..."`, `git push origin main`.
2. Server: `git pull origin main`.
3. If code changes: `docker-compose up -d --build`.
4. If `package.json` changes: `docker-compose down` then `docker-compose up -d --build`.
5. If only `.env` changes: `docker-compose restart app`.
6. Verify with `docker-compose logs --tail=200 app` and a quick UI/API check.
Done when:
- Containers are up and key pages load without errors.
