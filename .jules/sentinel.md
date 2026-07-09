## 2025-07-09 - [SQL Upload Vulnerability Fix]
**Vulnerability:** The SQL upload parsing allowed bypassing the simplistic dangerous command check. It also ran the risk of causing false positives inside strings.
**Learning:** Using regex pattern matching to ensure keywords are matched at the beginning of parsed statements is safer and avoids false positives or bypasses due to whitespace.
**Prevention:** Use a parser to separate statements before validating them individually rather than doing global string searches on raw input.
