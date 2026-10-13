import { COLORS, StackedBarChart } from '@/components/rc/charts';
import Deferred from '@/components/rc/deferred';
import { EnvironmentDot, Initial, SelectInput, SettingsCard } from '@/components/rc/settings-ui';
import SettingsLayout from '@/layouts/settings-layout';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { GraphPoint } from '@/types/raccoon';
import { router } from '@inertiajs/react';
import { ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';

interface UsagePoint {
    bucket: string;
    captured: number | null;
    rate_limited: number | null;
    total?: number | null;
}

interface EnvironmentUsage {
    id: string;
    name: string;
    color: string;
    events: { label: string; captured: number; rate_limited: number }[];
    captured_total: number;
    graph: UsagePoint[];
}

interface ApplicationUsage {
    id: string;
    name: string;
    environments: EnvironmentUsage[];
}

interface Props {
    organization: { id: string; name: string };
    periods: { key: string; label: string; from: string; to: string }[];
    current_period: { key: string; from: string; to: string };
    graph?: UsagePoint[];
    captured_total?: number;
    applications?: ApplicationUsage[];
}

const SERIES = [{ key: 'captured', label: 'Events', color: COLORS.blue }];

/** Hourly buckets summed per day for the bar chart. */
function daily(graph: UsagePoint[]): GraphPoint[] {
    const days = new Map<string, number | null>();

    graph.forEach((point) => {
        const day = `${point.bucket.slice(0, 10)} 00:00:00`;
        const previous = days.get(day);
        days.set(day, point.captured === null ? (previous ?? null) : (previous ?? 0) + point.captured);
    });

    return [...days.entries()].map(([bucket, captured]) => ({ bucket, captured }) as GraphPoint);
}

export default function Usage({ organization, periods, current_period, graph, captured_total, applications }: Props) {
    const period = periods.find((p) => p.key === current_period.key);

    return (
        <SettingsLayout title={`${organization.name} usage`} heading="Usage" description={`Events captured by ${organization.name} applications`}>
            <SettingsCard
                title={period?.label ?? current_period.key}
                description="Daily events received from every environment"
                actions={
                    <SelectInput
                        className="h-9 w-44"
                        aria-label="Month"
                        value={current_period.key}
                        onChange={(e) =>
                            router.get(`/settings/organizations/${organization.id}/usage`, { period: e.target.value }, { preserveScroll: true })
                        }
                    >
                        {periods.map((p) => (
                            <option key={p.key} value={p.key}>
                                {p.label}
                            </option>
                        ))}
                    </SelectInput>
                }
            >
                <div className="mx-1.5 mb-1.5 rounded-lg border border-zinc-200 bg-white p-5 shadow-xs">
                    <div className="mb-4 flex gap-10">
                        <div>
                            <div className="font-mono text-xs text-zinc-500 uppercase">Events captured</div>
                            <div className="mt-1 text-xl font-medium">
                                <Deferred data="captured_total" className="h-7 w-24">
                                    {() => formatNumber(captured_total ?? 0)}
                                </Deferred>
                            </div>
                        </div>
                        <div>
                            <div className="font-mono text-xs text-zinc-500 uppercase">Rate limited</div>
                            <div className="mt-1 text-xl font-medium text-zinc-400">0</div>
                        </div>
                    </div>
                    <div className="h-56">
                        <Deferred data="graph" className="h-full">
                            {() => <StackedBarChart data={daily(graph ?? [])} series={SERIES} />}
                        </Deferred>
                    </div>
                </div>
            </SettingsCard>

            <SettingsCard title="Applications" description="Events per environment and type this month">
                <div className="mx-1.5 mb-1.5 space-y-1.5">
                    <Deferred data="applications" className="h-24">
                        {() =>
                            (applications ?? []).length === 0 ? (
                                <p className="rounded-lg border border-dashed border-zinc-200 p-4 text-center text-sm text-zinc-500">
                                    This organization has no applications.
                                </p>
                            ) : (
                                (applications ?? []).map((application) => <ApplicationCard key={application.id} application={application} />)
                            )
                        }
                    </Deferred>
                </div>
            </SettingsCard>
        </SettingsLayout>
    );
}

function ApplicationCard({ application }: { application: ApplicationUsage }) {
    const total = application.environments.reduce((sum, environment) => sum + environment.captured_total, 0);

    return (
        <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white shadow-xs">
            <div className="flex items-center justify-between px-4 py-3">
                <span className="flex items-center gap-2 text-sm font-medium">
                    <Initial name={application.name} />
                    {application.name}
                </span>
                <span className="font-mono text-sm text-zinc-700">{formatNumber(total)} events</span>
            </div>
            {application.environments.map((environment) => (
                <EnvironmentRow key={environment.id} environment={environment} />
            ))}
        </div>
    );
}

function EnvironmentRow({ environment }: { environment: EnvironmentUsage }) {
    const [open, setOpen] = useState(false);
    const chart = useMemo(() => daily(environment.graph), [environment.graph]);
    const events = environment.events.filter((event) => event.captured > 0);

    return (
        <div>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                disabled={environment.captured_total === 0}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-zinc-50 disabled:cursor-default disabled:hover:bg-transparent"
            >
                <EnvironmentDot color={environment.color} />
                <span className="flex-1">{environment.name}</span>
                <span className="font-mono text-zinc-700">{formatNumber(environment.captured_total)}</span>
                <ChevronDown
                    className={cn('size-4 text-zinc-400 transition-transform', open && 'rotate-180', environment.captured_total === 0 && 'invisible')}
                />
            </button>
            {open && (
                <div className="grid gap-6 px-4 pt-1 pb-4 md:grid-cols-[1fr_280px]">
                    <div className="h-36">
                        <StackedBarChart data={chart} series={SERIES} />
                    </div>
                    <ul className="space-y-1 text-sm">
                        {events.map((event) => (
                            <li key={event.label} className="flex justify-between gap-4">
                                <span className="text-zinc-600">{event.label}</span>
                                <span className="font-mono text-zinc-900">
                                    {formatNumber(event.captured)}
                                    <span className="ml-2 inline-block w-10 text-right text-xs text-zinc-400">
                                        {Math.round((event.captured / environment.captured_total) * 100)}%
                                    </span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
