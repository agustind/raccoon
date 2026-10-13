import { QueryCharts, type QueryStats } from '@/components/rc/queries-charts';
import GroupDrawer, { type DrawerCall } from '@/components/rc/queries-group-drawer';
import { SqlBlock } from '@/components/rc/queries-sql';
import type { CursorPaginator, DeploymentBucket, GraphPoint } from '@/types/raccoon';
import { Database, Folder } from 'lucide-react';

interface Call extends DrawerCall {
    file: string;
    line: number;
}

interface Details {
    from: string;
    to: string;
    query: { sql: string; connection: string };
    graph: GraphPoint[];
    stats: QueryStats;
    deployments: DeploymentBucket[];
    calls: CursorPaginator<Call>;
}

export default function QueryDetailsDrawer({ group, onClose }: { group: string | null; onClose: () => void }) {
    return (
        <GroupDrawer<Details, Call>
            path={group ? `queries/${group}` : null}
            onClose={onClose}
            title={(details) => (
                <span className="flex items-center gap-2">
                    <Database className="size-4 shrink-0 text-zinc-500" />
                    {details ? details.query.connection : 'Query'}
                </span>
            )}
            label="Calls"
            summary={(details) => <SqlBlock sql={details.query.sql} className="max-h-48 rounded-lg border border-zinc-200 bg-white p-4" />}
            charts={(details) => <QueryCharts graph={details.graph} stats={details.stats} deployments={details.deployments} from={details.from} to={details.to} className="grid gap-1.5" />}
            count={(details) => details.stats.count}
            calls={(details) => details.calls.data}
            renderCall={(call) => (
                <>
                    <Folder className="size-4 shrink-0 text-zinc-500" />
                    <span className="truncate text-xs text-zinc-700" dir="rtl" title={`${call.file}:${call.line}`}>
                        {call.file ? `${call.file}:${call.line}` : 'Unknown location'}
                    </span>
                </>
            )}
        />
    );
}
