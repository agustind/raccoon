import { cn } from '@/lib/utils';
import { useMemo } from 'react';

type TokenType = 'space' | 'comment' | 'string' | 'identifier' | 'number' | 'placeholder' | 'keyword' | 'word' | 'operator';

interface Token {
    type: TokenType;
    text: string;
}

const TOKEN_PATTERN =
    /(\s+)|(--[^\n]*|\/\*[\s\S]*?\*\/)|('(?:[^']|'')*'?)|("(?:[^"]|"")*"?|`[^`]*`?)|(\b\d+(?:\.\d+)?\b)|(\?|:\w+|\$\d+)|(\w+)|(<=|>=|<>|!=|::|\|\||->>|->|[^\w\s])/g;

const GROUPS: TokenType[] = ['space', 'comment', 'string', 'identifier', 'number', 'placeholder', 'word', 'operator'];

const KEYWORDS = new Set(
    (
        'select from where and or not in is null as on join left right inner outer cross full group by order having limit offset ' +
        'insert into values update set delete returning distinct case when then else end exists between like ilike union all ' +
        'asc desc with conflict do nothing within over partition true false date integer text timestamp interval for lock share'
    ).split(' '),
);

/** Keywords that start a clause on a new line when formatting. */
const CLAUSES = new Set([
    'select',
    'from',
    'where',
    'group',
    'order',
    'having',
    'limit',
    'offset',
    'join',
    'left',
    'right',
    'inner',
    'cross',
    'full',
    'union',
    'values',
    'set',
    'returning',
]);

/** Clauses whose top-level commas each start a new line. */
const LIST_CLAUSES = new Set(['select', 'group', 'order', 'set', 'returning']);

export function tokenizeSql(sql: string): Token[] {
    const tokens: Token[] = [];

    for (const match of sql.matchAll(TOKEN_PATTERN)) {
        const index = match.slice(1).findIndex((group) => group !== undefined);
        let type = GROUPS[index] ?? 'operator';

        if (type === 'word' && KEYWORDS.has(match[0].toLowerCase())) {
            type = 'keyword';
        }

        tokens.push({ type, text: match[0] });
    }

    return tokens;
}

/** One-line SQL for table rows: newlines and repeated spaces collapsed. */
export function compactSql(sql: string): string {
    return sql
        .replaceAll('\n', ' ')
        .replaceAll(/\s{2,}/g, ' ')
        .trim();
}

function isClause(tokens: Token[], index: number): boolean {
    const token = tokens[index];

    if (token.type !== 'keyword' || !CLAUSES.has(token.text.toLowerCase())) return false;

    const previous = tokens[index - 1]?.text.toLowerCase();
    const word = token.text.toLowerCase();

    // "left join", "within group", "do update set" and the like stay on one line.
    if (word === 'join' && ['left', 'right', 'inner', 'outer', 'cross', 'full'].includes(previous)) return false;
    if (word === 'group' && previous === 'within') return false;
    if (['left', 'right', 'full'].includes(word) && tokens[index + 1]?.text === '(') return false;

    return true;
}

/**
 * Small SQL pretty printer: each clause on its own line with its body indented,
 * select lists one column per line, and subqueries indented inside their
 * parentheses.
 */
export function formatSql(sql: string): string {
    const tokens = tokenizeSql(sql).filter((token) => token.type !== 'space');

    // Parentheses that contain a clause (subqueries, window definitions) break onto new lines.
    const breaking = new Set<number>();
    const open: number[] = [];

    tokens.forEach((token, index) => {
        if (token.text === '(') open.push(index);
        else if (token.text === ')') open.pop();
        else if (open.length > 0 && isClause(tokens, index)) breaking.add(open[open.length - 1]);
    });

    const lines: string[] = [];
    let line = '';
    let level = 0;
    let clause: string | null = null;
    const stack: { level: number; clause: string | null; breaks: boolean }[] = [];

    const newline = (indent: number) => {
        if (line.trim() !== '') lines.push(line.trimEnd());
        line = '  '.repeat(indent);
    };

    const append = (text: string, previous: Token | undefined) => {
        const glued =
            line.trim() === '' ||
            text === ')' ||
            text === ',' ||
            text === '.' ||
            text === '::' ||
            previous?.text === '(' ||
            previous?.text === '.' ||
            previous?.text === '::' ||
            (text === '(' && previous?.type === 'word');

        line += (glued ? '' : ' ') + text;
    };

    tokens.forEach((token, index) => {
        const previous = tokens[index - 1];

        if (isClause(tokens, index)) {
            newline(level);
            append(token.text, undefined);
            clause = token.text.toLowerCase();

            // Two-word clauses keep their second word on the same line.
            const next = tokens[index + 1]?.text.toLowerCase();

            if (!['group', 'order', 'left', 'right', 'inner', 'cross', 'full'].includes(clause) || !next) {
                newline(level + 1);
            }

            return;
        }

        if (
            ['by', 'join', 'outer'].includes(token.text.toLowerCase()) &&
            previous &&
            ['group', 'order', 'left', 'right', 'inner', 'cross', 'full', 'outer'].includes(previous.text.toLowerCase())
        ) {
            append(token.text, previous);

            if (token.text.toLowerCase() !== 'outer') newline(level + 1);

            return;
        }

        if (token.text === '(') {
            const breaks = breaking.has(index);
            append('(', previous);
            stack.push({ level, clause, breaks });

            if (breaks) {
                level = level + 2;
                newline(level);
            }

            return;
        }

        if (token.text === ')') {
            const state = stack.pop();

            if (state) {
                if (state.breaks) newline(state.level + 1);
                level = state.level;
                clause = state.clause;
            }

            append(')', previous);

            return;
        }

        if (token.text === ',' && clause && LIST_CLAUSES.has(clause) && (stack.length === 0 || stack[stack.length - 1].breaks)) {
            append(',', previous);
            newline(level + 1);

            return;
        }

        append(token.text, previous);
    });

    newline(0);

    return lines.join('\n');
}

const TOKEN_CLASSES: Partial<Record<TokenType, string>> = {
    keyword: 'text-blue-700',
    string: 'text-rose-700',
    identifier: 'text-rose-800',
    number: 'text-teal-600',
    comment: 'text-zinc-400',
};

/** SQL with keyword, string and identifier colors. Whitespace is kept as is. */
export function SqlHighlight({ sql, className }: { sql: string; className?: string }) {
    const tokens = useMemo(() => tokenizeSql(sql), [sql]);

    return (
        <code className={cn('font-mono', className)}>
            {tokens.map((token, index) =>
                TOKEN_CLASSES[token.type] ? (
                    <span key={index} className={TOKEN_CLASSES[token.type]}>
                        {token.text}
                    </span>
                ) : (
                    token.text
                ),
            )}
        </code>
    );
}

/** Formatted, highlighted SQL in a scrollable block. */
export function SqlBlock({ sql, className }: { sql: string; className?: string }) {
    const formatted = useMemo(() => formatSql(sql), [sql]);

    return (
        <pre className={cn('overflow-auto font-mono text-xs leading-relaxed whitespace-pre text-zinc-800', className)}>
            <SqlHighlight sql={formatted} />
        </pre>
    );
}
