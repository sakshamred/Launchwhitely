import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ToggleLeft, Pencil } from "lucide-react";
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

export default async function ProjectFlagsPage({
  params,
  searchParams,
}: Props) {
  const { projectId } = await params;
  const { env: envId } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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

  const flags = await prisma.flag.findMany({
    where: { projectId },
    include: {
      states: currentEnv ? { where: { environmentId: currentEnv.id } } : false,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col">
      <Header
        title="Feature Flags"
        actions={
          <Link href={`/projects/${projectId}/flags/new`}>
            <Button size="sm">
              <Plus className="h-3.5 w-3.5" />
              New Flag
            </Button>
          </Link>
        }
      />

      <div className="p-6">
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
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800/60">
                  <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                    Name
                  </th>
                  <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                    Key
                  </th>
                  <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                    Enabled
                  </th>
                  <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                    Rollout
                  </th>
                  <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                    Updated
                  </th>
                  <th className="text-right px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {flags.map((flag) => {
                  const state = flag.states[0];
                  const rules = state?.rules;
                  const hasRules = Array.isArray(rules)
                    ? rules.length > 0
                    : false;

                  return (
                    <tr
                      key={flag.id}
                      className={`hover:bg-zinc-800/30 transition-colors ${flag.archived ? "opacity-40" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <span className="text-zinc-100 font-medium">
                            {flag.name}
                          </span>
                          {flag.archived && (
                            <Badge variant="warning" className="ml-2">
                              Archived
                            </Badge>
                          )}
                          {flag.description && (
                            <p className="text-zinc-600 text-xs mt-0.5 truncate max-w-xs">
                              {flag.description}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-[11px] font-mono text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">
                          {flag.key}
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="default">{flag.type}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {currentEnv && state ? (
                          <FlagToggle
                            flagId={flag.id}
                            envId={currentEnv.id}
                            projectId={projectId}
                            initialEnabled={state.enabled}
                          />
                        ) : (
                          <span className="text-zinc-700 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {state ? (
                          hasRules ? (
                            <Badge variant="indigo">targeting</Badge>
                          ) : (
                            <span className="text-zinc-500 font-mono">{state.rolloutPct}%</span>
                          )
                        ) : (
                          <span className="text-zinc-700">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 text-xs">
                        {state
                          ? new Date(state.updatedAt).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                              },
                            )
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/projects/${projectId}/flags/${flag.id}${currentEnv ? `?env=${currentEnv.id}` : ""}`}
                        >
                          <Button variant="ghost" size="sm">
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}