export function splitSqlStatements(sqlContent) {
    if (typeof sqlContent !== 'string') return [];

    const sql = sqlContent.replace(/^\uFEFF/, '');
    const statements = [];
    let current = '';
    let delimiter = ';';
    let inSingle = false;
    let inDouble = false;
    let inBacktick = false;

    const pushStatement = () => {
        const trimmed = current.trim();
        if (trimmed) statements.push(trimmed);
        current = '';
    };

    const isLineStart = (index) => {
        if (index === 0) return true;
        const prev = sql[index - 1];
        return prev === '\n' || prev === '\r';
    };

    const isWhitespace = (char) => char === ' ' || char === '\t' || char === '\n' || char === '\r';

    let i = 0;
    while (i < sql.length) {
        const char = sql[i];
        const next = sql[i + 1];

        if (!inSingle && !inDouble && !inBacktick) {
            if (isLineStart(i)) {
                let j = i;
                while (isWhitespace(sql[j])) j++;
                const keyword = sql.slice(j, j + 9).toUpperCase();
                if (keyword === 'DELIMITER') {
                    j += 9;
                    while (isWhitespace(sql[j])) j++;
                    let newDelimiter = '';
                    while (j < sql.length && sql[j] !== '\n' && sql[j] !== '\r') {
                        newDelimiter += sql[j];
                        j++;
                    }
                    const trimmedDelimiter = newDelimiter.trim();
                    if (trimmedDelimiter) delimiter = trimmedDelimiter;
                    while (i < sql.length && sql[i] !== '\n') i++;
                    i++;
                    continue;
                }
            }

            if (delimiter && sql.startsWith(delimiter, i)) {
                pushStatement();
                i += delimiter.length;
                continue;
            }

            if (char === '-' && next === '-' && (i === 0 || isWhitespace(sql[i - 1]))) {
                i += 2;
                while (i < sql.length && sql[i] !== '\n') i++;
                i++;
                continue;
            }

            if (char === '#') {
                i += 1;
                while (i < sql.length && sql[i] !== '\n') i++;
                i++;
                continue;
            }

            if (char === '/' && next === '*') {
                i += 2;
                while (i < sql.length) {
                    if (sql[i] === '*' && sql[i + 1] === '/') {
                        i += 2;
                        break;
                    }
                    i++;
                }
                continue;
            }
        }

        if ((inSingle || inDouble) && char === '\\' && next !== undefined) {
            current += char + next;
            i += 2;
            continue;
        }

        if (char === "'" && !inDouble && !inBacktick) {
            if (inSingle && next === "'") {
                current += char + next;
                i += 2;
                continue;
            }
            inSingle = !inSingle;
            current += char;
            i++;
            continue;
        }

        if (char === '"' && !inSingle && !inBacktick) {
            if (inDouble && next === '"') {
                current += char + next;
                i += 2;
                continue;
            }
            inDouble = !inDouble;
            current += char;
            i++;
            continue;
        }

        if (char === '`' && !inSingle && !inDouble) {
            inBacktick = !inBacktick;
            current += char;
            i++;
            continue;
        }

        current += char;
        i++;
    }

    if (current.trim()) pushStatement();

    return statements;
}
