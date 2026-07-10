## 2025-02-27 - [Add 'DELETE FROM' restriction to SQL file execution]
**Vulnerability:** Execution of potentially destructive 'DELETE FROM' SQL statements wasn't blocked when uploading SQL database backup files or scripts, allowing unintended data loss.
**Learning:** SQL parsing capabilities in data file uploads need comprehensive string-matching checks to proactively prevent all types of potential data destruction queries not strictly necessary for database dumps or seeding (such as bulk DELETEs).
**Prevention:** Expanded the `BLOCKED_SQL_PATTERNS` array in `databaseFileController.js` to include `'delete from'` queries. Ensure new controllers managing database state explicitly whitelist allowed patterns rather than simply blacklisting some.
