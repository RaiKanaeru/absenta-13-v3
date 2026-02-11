---
name: absenta-devops
description: Docker-first operational workflow for Absenta13 deploy, logs, and recovery.
license: Proprietary
metadata:
  project: absenta13
  scope: devops
---

# Absenta DevOps Skill

Use this skill when handling runtime issues, deployment checks, and container troubleshooting.

## Default Operational Flow

1. Check service state with `docker-compose ps`.
2. Inspect backend logs with `docker-compose logs --tail=100 app`.
3. Validate CORS and reverse proxy assumptions before changing application code.
4. Prefer restarting only affected services (`docker-compose restart app`) before full rebuild.

## Safe Commands

- `docker-compose ps`
- `docker-compose logs -f app`
- `docker-compose restart app`
- `docker-compose up -d --build app`

## Guardrails

- Do not run destructive commands without explicit request.
- Do not alter production secrets in files.
- Keep incident fixes minimal and reversible.
