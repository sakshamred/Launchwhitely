import { redirect } from "next/navigation";
import { Globe } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/db/client";
import { Header } from "@/components/layout/header";
import { EmptyState } from "@/components/ui/empty-state";
import { NewEnvironmentButton } from "./new-environment-button";
import { DeleteEnvironmentButton } from "./delete-environment-button";

type Props = {
  params: Promise<{ projectId: string }>;
};

export default async function EnvironmentsPage({ params }: Props) {
  const { projectId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const environments = await prisma.environment.findMany({
    where: { projectId },
    include: {
      _count: { select: { apiKeys: true } },
    },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="flex flex-col">
      <Header
        title="Environments"
        actions={<NewEnvironmentButton projectId={projectId} />}
      />

      <div className="p-6">
        {environments.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="No environments"
            description="Create an environment to start managing flag states per deployment context."
            action={<NewEnvironmentButton projectId={projectId} />}
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
                    Slug
                  </th>
                  <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                    Color
                  </th>
                  <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                    SDK Key
                  </th>
                  <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                    API Keys
                  </th>
                  <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                    Created
                  </th>
                  <th className="text-right px-4 py-2.5 text-zinc-500 font-medium text-[11px] uppercase tracking-wider">
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {environments.map((env) => (
                  <tr
                    key={env.id}
                    className="hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: env.color }}
                        />
                        <span className="text-zinc-100 font-medium">{env.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-[11px] font-mono text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">
                        {env.slug}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-4 h-4 rounded border border-zinc-700/50 flex-shrink-0"
                          style={{ backgroundColor: env.color }}
                        />
                        <code className="text-[11px] font-mono text-zinc-600">
                          {env.color}
                        </code>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      <code className="text-[11px] font-mono text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">
                        {env.sdkKeyPrefix}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {env._count.apiKeys}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 text-xs">
                      {new Date(env.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DeleteEnvironmentButton
                        envId={env.id}
                        envName={env.name}
                        projectId={projectId}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
