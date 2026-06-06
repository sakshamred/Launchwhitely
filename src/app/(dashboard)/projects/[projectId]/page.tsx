import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ToggleLeft, Pencil, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/db/client";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FlagToggle } from "./flag-toggle";

type Props = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ env?: string }>;
};

export default async function ProjectFlagsPage({ params, searchParams }: Props) {
  const { projectId } = await params;
  const { env: envId } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch project + environments
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      environments: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!project) redirect("/projects");

  const environments = project.environments;
  const currentEnv =
    environments.find((e) => e.id === envId) ?? environments[0];

  // Fetch flags with their state for the selected env
  const flags = await prisma.flag.findMany({
    where: { projectId },
    include: {
      states: currentEnv ? { where: { environmentId: currentEnv.id } } : false,
    },
    orderBy: { createdAt: "desc" },
  });

  const activeFlags = flags.filter((f) => !f.archived);
  const liveCount = activeFlags.filter((f) => f.states[0]?.enabled).length;

  const envQuery = currentEnv ? `?env=${currentEnv.id}` : "";

  return (
    <div className="flex flex-col">
      <Header
        title="Feature Flags"
        actions={
          <Link href={`/projects/${projectId}/flags/new`}>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              New Flag
            </Button>
          </Link>
        }
      />

      <div className="flex-1 bg-dots">
        <div className="mx-auto max-w-4xl px-6 py-6">
          {flags.length === 0 ? (
            <EmptyState
              icon={ToggleLeft}
              title="No feature flags yet"
              description="Create your first flag to start controlling feature rollouts."
              action={
                <Link href={`/projects/${projectId}/flags/new`}>
                  <Button>
                    <Plus className="h-4 w-4" />
                    New Flag
                  </Button>
                </Link>
              }
            />
          ) : (
            <>
              {/* Summary */}
              <div className="flex items-center gap-2 mb-4 text-xs text-zinc-500">
                <span className="text-zinc-300 font-medium tabular-nums">
                  {activeFlags.length}
                </span>
                flag{activeFlags.length !== 1 ? "s" : ""}
                <span className="text-zinc-700">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                  <span className="text-emerald-400 font-medium tabular-nums">
                    {liveCount}
                  </span>
                  on
                </span>
                {currentEnv && (
                  <>
                    <span className="text-zinc-700">·</span>
                    <span className="inline-flex items-center gap-1.5 text-zinc-400">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: currentEnv.color }}
                      />
                      {currentEnv.name}
                    </span>
                  </>
                )}
              </div>

              {/* Flag rows */}
              <div className="stagger space-y-2">
                {flags.map((flag, i) => {
                  const state = flag.states[0];
                  const rules = state?.rules;
                  const hasRules = Array.isArray(rules) ? rules.length > 0 : false;
                  const enabled = Boolean(state?.enabled) && !flag.archived;

                  return (
                    <div
                      key={flag.id}
                      style={{ ["--i" as string]: i }}
                      className={[
                        "group flex items-center gap-4 rounded-xl border bg-zinc-900/50 px-4 py-3.5 transition-all duration-200",
                        flag.archived
                          ? "border-zinc-800/50 opacity-60"
                          : enabled
                            ? "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900"
                            : "border-zinc-800/70 hover:border-zinc-800 hover:bg-zinc-900/70",
                      ].join(" ")}
                    >
                      {/* Toggle */}
                      {currentEnv && state ? (
                        <FlagToggle
                          flagId={flag.id}
                          envId={currentEnv.id}
                          projectId={projectId}
                          initialEnabled={state.enabled}
                        />
                      ) : (
                        <span className="text-zinc-600 text-xs w-11 text-center">—</span>
                      )}

                      {/* Name + key */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={[
                              "font-medium text-sm truncate transition-colors",
                              enabled ? "text-zinc-100" : "text-zinc-400",
                            ].join(" ")}
                          >
                            {flag.name}
                          </span>
                          <code className="hidden sm:inline text-[11px] font-mono text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded truncate">
                            {flag.key}
                          </code>
                          {flag.archived && (
                            <Badge variant="warning">Archived</Badge>
                          )}
                        </div>
                        {flag.description && (
                          <p className="text-xs text-zinc-500 truncate mt-0.5">
                            {flag.description}
                          </p>
                        )}
                      </div>

                      {/* Status */}
                      <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                        {flag.type !== "BOOLEAN" && (
                          <Badge variant="default" className="font-mono">
                            {flag.type.toLowerCase()}
                          </Badge>
                        )}
                        {!state ? (
                          <span className="text-zinc-600 text-xs w-[84px] text-center">
                            —
                          </span>
                        ) : !enabled ? (
                          <Badge
                            variant="default"
                            className="text-zinc-500 w-[84px] justify-center"
                          >
                            Off
                          </Badge>
                        ) : hasRules ? (
                          <Badge variant="indigo" className="w-[84px] justify-center">
                            <Target className="h-3 w-3" />
                            Targeting
                          </Badge>
                        ) : state.rolloutPct < 100 ? (
                          <Badge
                            variant="indigo"
                            className="tabular-nums w-[84px] justify-center"
                          >
                            {state.rolloutPct}% rollout
                          </Badge>
                        ) : (
                          <Badge variant="success" className="w-[84px] justify-center">
                            Live
                          </Badge>
                        )}
                      </div>

                      {/* Edit */}
                      <Link
                        href={`/projects/${projectId}/flags/${flag.id}${envQuery}`}
                        className="flex-shrink-0"
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-60 group-hover:opacity-100 transition-opacity"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Edit</span>
                        </Button>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
