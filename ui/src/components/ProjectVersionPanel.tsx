import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../api/projects";

type VersionView = {
  versionKey: string;
  displayState: string;
  canonicalSpecKind: string;
  canonicalSpecPath?: string | null;
  canonicalSpecBlobSha?: string | null;
  candidateSourceSha?: string | null;
  deployedSourceSha?: string | null;
  blockReason?: string | null;
  verificationReceiptLockedAt?: string | null;
  shippedAt?: string | null;
  rootIssueId: string;
};

export function ProjectVersionPanel({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["project-version-active", projectId],
    queryFn: async () =>
      (await projectsApi.getActiveVersion(projectId)) as VersionView | null,
  });

  if (isLoading) return null;
  if (error || !data) return null;

  return (
    <div className="space-y-1 text-sm" data-testid="project-version-panel">
      <div className="font-medium">Version {data.versionKey}</div>
      <div className="text-muted-foreground">State: {data.displayState}</div>
      {data.canonicalSpecPath ? (
        <div className="text-muted-foreground truncate" title={data.canonicalSpecPath}>
          Spec: {data.canonicalSpecPath}
        </div>
      ) : null}
      {data.candidateSourceSha ? (
        <div className="font-mono text-xs truncate">candidate {data.candidateSourceSha.slice(0, 12)}</div>
      ) : null}
      {data.deployedSourceSha ? (
        <div className="font-mono text-xs truncate">deployed {data.deployedSourceSha.slice(0, 12)}</div>
      ) : null}
      {data.blockReason ? (
        <div className="text-destructive text-xs">Blocked: {data.blockReason}</div>
      ) : null}
    </div>
  );
}
