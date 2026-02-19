/**
 * @typedef {Object} ParserState
 * @property {string} sql - The full SQL string being parsed
 * @property {number} i - Current character position
 * @property {string} current - Current statement accumulator
 * @property {string} delimiter - Current statement delimiter
 * @property {boolean} inSingle - Inside single-quoted string
 * @property {boolean} inDouble - Inside double-quoted string
 * @property {boolean} inBacktick - Inside backtick-quoted identifier
 * @property {string[]} statements - Accumulated complete statements
 */

/**
 * Check if a character is whitespace.
 * @param {string} char
 * @returns {boolean}
 */
function isWhitespace(char) {
    return char === ' ' || char === '\t' || char === '\n' || char === '\r';
}

/**
 * Check if the given index is at the start of a line.
 * @param {string} sql
 * @param {number} index
 * @returns {boolean}
 */
function isLineStart(sql, index) {
    if (index === 0) return true;
    const prev = sql[index - 1];
    return prev === '\n' || prev === '\r';
}

/**
 * Push the current accumulated statement into the results array and reset.
 * @param {ParserState} state
 */
function pushStatement(state) {
    const trimmed = state.current.trim();
    if (trimmed) state.statements.push(trimmed);
    state.current = '';
}

/**
 * Try to parse a DELIMITER command at the current position.
 * @param {ParserState} state
 * @returns {boolean} true if a DELIMITER command was consumed
 */
function tryParseDelimiterCommand(state) {
    const { sql, i } = state;
    if (!isLineStart(sql, i)) return false;

    let j = i;
    while (isWhitespace(sql[j])) j++;
    const keyword = sql.slice(j, j + 9).toUpperCase();
    if (keyword !== 'DELIMITER') return false;

    j += 9;
    while (isWhitespace(sql[j])) j++;
    let newDelimiter = '';
    while (j < sql.length && sql[j] !== '\n' && sql[j] !== '\r') {
        newDelimiter += sql[j];
        j++;
    }
    const trimmedDelimiter = newDelimiter.trim();
    if (trimmedDelimiter) state.delimiter = trimmedDelimiter;

    // Advance past the rest of the line
    while (state.i < sql.length && sql[state.i] !== '\n') state.i++;
    state.i++;
    return true;
}

/**
 * Try to match the current delimiter at the current position.
 * @param {ParserState} state
 * @returns {boolean} true if a delimiter was matched and a statement was pushed
 */
function tryMatchDelimiter(state) {
    if (!state.delimiter) return false;
    if (!state.sql.startsWith(state.delimiter, state.i)) return false;

    pushStatement(state);
    state.i += state.delimiter.length;
    return true;
}

/**
 * Try to skip a line comment (-- or #) at the current position.
 * @param {ParserState} state
 * @returns {boolean} true if a line comment was consumed
 */
function trySkipLineComment(state) {
    const { sql, i } = state;
    const char = sql[i];
    const next = sql[i + 1];

    // -- style line comment (only if preceded by whitespace or at start)
    if (char === '-' && next === '-' && (i === 0 || isWhitespace(sql[i - 1]))) {
        state.i += 2;
        while (state.i < sql.length && sql[state.i] !== '\n') state.i++;
        state.i++;
        return true;
    }

    // # style line comment
    if (char === '#') {
        state.i += 1;
        while (state.i < sql.length && sql[state.i] !== '\n') state.i++;
        state.i++;
        return true;
    }

    return false;
}

/**
 * Try to skip a block comment at the current position.
 * @param {ParserState} state
 * @returns {boolean} true if a block comment was consumed
 */
function trySkipBlockComment(state) {
    const { sql, i } = state;
    if (sql[i] !== '/' || sql[i + 1] !== '*') return false;

    state.i += 2;
    while (state.i < sql.length) {
        if (sql[state.i] === '*' && sql[state.i + 1] === '/') {
            state.i += 2;
            break;
        }
        state.i++;
    }
    return true;
}

/**
 * Try to handle a backslash escape inside a quoted string.
 * @param {ParserState} state
 * @returns {boolean} true if an escape sequence was consumed
 */
function tryHandleEscape(state) {
    const { sql, i, inSingle, inDouble } = state;
    if (!(inSingle || inDouble)) return false;
    if (sql[i] !== '\\' || sql[i + 1] === undefined) return false;

    state.current += sql[i] + sql[i + 1];
    state.i += 2;
    return true;
}

/**
 * Try to handle a single-quote character (toggle or escaped quote).
 * @param {ParserState} state
 * @returns {boolean} true if the character was consumed
 */
function tryToggleSingleQuote(state) {
    const { sql, i, inDouble, inBacktick } = state;
    if (sql[i] !== "'" || inDouble || inBacktick) return false;

    if (state.inSingle && sql[i + 1] === "'") {
        state.current += sql[i] + sql[i + 1];
        state.i += 2;
        return true;
    }
    state.inSingle = !state.inSingle;
    state.current += sql[i];
    state.i++;
    return true;
}

/**
 * Try to handle a double-quote character (toggle or escaped quote).
 * @param {ParserState} state
 * @returns {boolean} true if the character was consumed
 */
function tryToggleDoubleQuote(state) {
    const { sql, i, inSingle, inBacktick } = state;
    if (sql[i] !== '"' || inSingle || inBacktick) return false;

    if (state.inDouble && sql[i + 1] === '"') {
        state.current += sql[i] + sql[i + 1];
        state.i += 2;
        return true;
    }
    state.inDouble = !state.inDouble;
    state.current += sql[i];
    state.i++;
    return true;
}

/**
 * Try to handle a backtick character (toggle).
 * @param {ParserState} state
 * @returns {boolean} true if the character was consumed
 */
function tryToggleBacktick(state) {
    const { sql, i, inSingle, inDouble } = state;
    if (sql[i] !== '`' || inSingle || inDouble) return false;

    state.inBacktick = !state.inBacktick;
    state.current += sql[i];
    state.i++;
    return true;
}

/**
 * Check if the parser is currently outside any quoted context.
 * @param {ParserState} state
 * @returns {boolean}
 */
function isOutsideQuotes(state) {
    return !state.inSingle && !state.inDouble && !state.inBacktick;
}

/**
 * Try to process structural SQL elements (delimiters, comments) when outside quotes.
 * @param {ParserState} state
 * @returns {boolean} true if a structural element was consumed
 */
function tryProcessStructural(state) {
    if (tryParseDelimiterCommand(state)) return true;
    if (tryMatchDelimiter(state)) return true;
    if (trySkipLineComment(state)) return true;
    if (trySkipBlockComment(state)) return true;
    return false;
}

/**
 * Try to process quote-related characters (escapes, quote toggles).
 * @param {ParserState} state
 * @returns {boolean} true if a quote-related character was consumed
 */
function tryProcessQuotes(state) {
    if (tryHandleEscape(state)) return true;
    if (tryToggleSingleQuote(state)) return true;
    if (tryToggleDoubleQuote(state)) return true;
    if (tryToggleBacktick(state)) return true;
    return false;
}

/**
 * Split a SQL string into individual statements, respecting quotes,
 * comments, DELIMITER commands, and escape sequences.
 * @param {string} sqlContent - Raw SQL content
 * @returns {string[]} Array of individual SQL statements
 */
export function splitSqlStatements(sqlContent) {
    if (typeof sqlContent !== 'string') return [];

    /** @type {ParserState} */
    const state = {
        sql: sqlContent.replace(/^\uFEFF/, ''),
        i: 0,
        current: '',
        delimiter: ';',
        inSingle: false,
        inDouble: false,
        inBacktick: false,
        statements: []
    };

    while (state.i < state.sql.length) {
        if (isOutsideQuotes(state) && tryProcessStructural(state)) continue;
        if (tryProcessQuotes(state)) continue;

        state.current += state.sql[state.i];
        state.i++;
    }

    if (state.current.trim()) pushStatement(state);

    return state.statements;
}
