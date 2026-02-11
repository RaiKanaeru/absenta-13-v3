---
description: View Docker container logs
---

Show the latest logs from Docker containers:

1. Run `docker-compose ps` to show container status
2. Run `docker-compose logs --tail=50 app` to show recent app logs
3. If $ARGUMENTS is provided, show logs for that specific container instead

Analyze logs for any errors or warnings.
