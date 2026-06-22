## 2025-02-28 - SQL Injection in Table Identifiers
**Vulnerability:** SQL Injection via raw string interpolation for table names in DB queries.
**Learning:** Found string interpolation used without proper escaping for table identifiers, e.g. `SHOW CREATE TABLE ${table}` and `SELECT * FROM ${table}`. Even when iterating over a fixed array, it exposes a vulnerability pattern that is easy to abuse if inputs become dynamic.
**Prevention:** Always use backticks around dynamically interpolated table or column names like \`\`${table}\`\` to ensure identifiers are safely escaped and not executed as raw SQL.
