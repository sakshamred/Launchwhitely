import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/db/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlagStateEditor } from "./flag-state-editor";
import { ArchiveToggle } from "./archive-toggle";

type Props = {
  params: Promise<{ projectId: string; flagId: string }>;
  searchParams: Promise<{ env?: string }>;
};

function formatAction(action: string): string {
  const map: Record<string, string> = {
    "flag.enabled": "Enabled flag",
    "flag.disabled": "Disabled flag",
    "flag.created": "Created flag",
    "flag.updated": "Updated flag",
    "flag.archived": "Archived flag",
    "flag.unarchived": "Unarchived flag",
    "flag.rollout_updated": "Updated rollout",
    "environment.created": "Created environment",
    "environment.deleted": "Deleted environment",
    "apikey.created": "Created API key",
    "apikey.revoked": "Revoked API key",
    "member.invited": "Invited member",
    "member.removed": "Removed member",
  };
  return map[action] ?? action.replace(/\./g, " → ");
}

export default async function FlagDetailPage({ params, searchParams }: Props) {
  const { projectId, flagId } = await params;
  const { env: envId } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const flag = await prisma.flag.findUnique({
    where: { id: flagId },
    include: {
      states: {
        include: { environment: true },
        orderBy: { environment: { sortOrder: "asc" } },
      },
    },
  });

  if (!flag || flag.projectId !== projectId) redirect(`/projects/${projectId}`);

  const environments = await prisma.environment.findMany({
    where: { projectId },
    orderBy: { sortOrder: "asc" },
  });

  const currentEnv =
    environments.find((e) => e.id === envId) ?? environments[0];
  const currentState = flag.states.find(
    (s) => s.environmentId === currentEnv?.id,
  );

  const auditLogs = await prisma.auditLog.findMany({
    where: { projectId, resource: { contains: flag.key } },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { actor: { select: { email: true, name: true } } },
  });

  const typeBadgeVariant =
    flag.type === "BOOLEAN"
      ? "default"
      : flag.type === "STRING"
        ? "indigo"
        : flag.type === "NUMBER"
          ? "success"
          : "warning";

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 px-6 h-14 border-b border-zinc-800/60 flex-shrink-0">
        <Link
          href={`/projects/${projectId}${currentEnv ? `?env=${currentEnv.id}` : ""}`}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <h1 className="text-zinc-100 font-medium text-[15px] truncate">
            {flag.name}
          </h1>
          <code className="text-[11px] font-mono text-zinc-500 bg-zinc-800/60 px-2 py-1 rounded flex-shrink-0">
            {flag.key}
          </code>
          <Badge variant={typeBadgeVariant}>{flag.type}</Badge>
          {flag.archived && <Badge variant="warning">Archived</Badge>}
        </div>
        <ArchiveToggle
          flagId={flagId}
          projectId={projectId}
          archived={flag.archived}
        />
      </div>

      <div className="p-6 space-y-5">
        {currentEnv && currentState ? (
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3 border-b border-zinc-800/60">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: currentEnv.color }}
              />
              <h2 className="text-zinc-300 font-medium text-sm">
                {currentEnv.name}
              </h2>
            </div>
            <div className="p-5">
              <FlagStateEditor
                flagId={flagId}
                envId={currentEnv.id}
                projectId={projectId}
                initialEnabled={currentState.enabled}
                initialRolloutPct={currentState.rolloutPct}
                rules={currentState.rules as unknown[]}
                variants={currentState.variants as unknown[]}
                version={currentState.version}
              />
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6 text-center">
            <p className="text-zinc-600 text-sm">
              {environments.length === 0
                ? "No environments configured for this project."
                : "Select an environment using the switcher above."}
            </p>
          </div>
        )}

        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-800/60">
            <h2 className="text-zinc-300 font-medium text-sm">
              All Environments
            </h2>
          </div>
          <div className="divide-y divide-zinc-800/40">
            {flag.states.map((s) => (
              <div key={s.id} className="flex items-center gap-4 px-5 py-2.5">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: s.environment.color }}
                />
                <span className="text-zinc-400 text-sm w-32 flex-shrink-0">
                  {s.environment.name}
                </span>
                <span
                  className={`text-[11px] font-medium ${s.enabled ? "text-emerald-400" : "text-zinc-600"}`}
                >
                  {s.enabled ? "Enabled" : "Disabled"}
                </span>
                <span className="text-zinc-700 text-xs font-mono">
                  {s.rolloutPct}%
                </span>
                <span className="text-zinc-800 text-[11px] ml-auto">
                  v{s.version}
                </span>
              </div>
            ))}
            {flag.states.length === 0 && (
              <p className="px-5 py-4 text-zinc-600 text-sm">
                No environment states found.
              </p>
            )}
          </div>
        </div>

        {flag.type !== "BOOLEAN" && currentState && (
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-800/60">
              <h2 className="text-zinc-300 font-medium text-sm">Variants</h2>
            </div>
            <div className="p-5">
              {Array.isArray(currentState.variants) &&
              currentState.variants.length > 0 ? (
                <pre className="text-[11px] font-mono text-zinc-400 bg-zinc-950 rounded-lg p-4 overflow-x-auto border border-zinc-800/60">
                  {JSON.stringify(currentState.variants, null, 2)}
                </pre>
              ) : (
                <p className="text-zinc-600 text-sm">
                  No variants configured.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-800/60">
            <h2 className="text-zinc-300 font-medium text-sm">
              Recent Activity
            </h2>
          </div>
          {auditLogs.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <p className="text-zinc-600 text-sm">No activity recorded yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/40">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center gap-3 px-5 py-2.5 text-sm"
                >
                  <span className="text-zinc-300">
                    {formatAction(log.action)}
                  </span>
                  <span className="text-zinc-800">·</span>
                  <span className="text-zinc-600 text-xs">
                    {log.actor.email}
                  </span>
                  <span className="ml-auto text-zinc-700 text-[11px]">
                    {new Date(log.createdAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}