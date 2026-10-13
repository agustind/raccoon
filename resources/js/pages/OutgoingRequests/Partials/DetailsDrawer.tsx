import { MethodBadge, StatusCode } from '@/components/rc/badges';
import GroupDrawer, { type DrawerCall } from '@/components/rc/queries-group-drawer';
import { RequestCharts, type RequestStats } from '@/components/rc/request-charts';
import type { CursorPaginator, DeploymentBucket, GraphPoint } from '@/types/raccoon';
import { Globe } from 'lucide-react';

interface Call extends DrawerCall {
    method: string;
    url: string;
    status_code: number;
}

interface Details {
    from: string;
    to: string;
    host: string;
    graph: GraphPoint[];
    stats: RequestStats;
    deployments: DeploymentBucket[];
    outgoingRequests: CursorPaginator<Call>;
}

export default function DetailsDrawer({ group, onClose }: { group: string | null; onClose: () => void }) {
    return (
        <GroupDrawer<Details, Call>
            path={group ? `outgoing-requests/${group}` : null}
            onClose={onClose}
            title={(details) => (
                <span className="flex items-center gap-2">
                    <Globe className="size-4 shrink-0 text-zinc-500" />
                    <span className="truncate">{details ? details.host || 'Unknown Host' : 'Outgoing Requests'}</span>
                </span>
            )}
            label="Requests"
            charts={(details) => (
                // RequestCharts lays its cards out in two columns; the drawer stacks them.
                <div className="[&>div]:grid-cols-1">
                    <RequestCharts
                        graph={details.graph}
                        stats={details.stats}
                        deployments={details.deployments}
                        from={details.from}
                        to={details.to}
                    />
                </div>
            )}
            count={(details) => details.stats.count}
            calls={(details) => details.outgoingRequests.data}
            hasError={(call) => call.status_code >= 500}
            renderCall={(call) => (
                <>
                    <StatusCode code={call.status_code} />
                    <MethodBadge methods={call.method} />
                    <span className="truncate text-xs text-zinc-700" title={call.url}>
                        {pathOf(call.url)}
                    </span>
                </>
            )}
        />
    );
}

function pathOf(url: string): string {
    try {
        const parsed = new URL(url);

        return parsed.pathname + parsed.search;
    } catch {
        return url;
    }
}
