import { Router } from "express";
import { requireAuth, requireAdmin, requireRegisteredUser } from "../../auth/entra-guard";

const router = Router();

interface WorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  event: string;
  html_url: string;
}

interface WorkflowRunsResponse {
  workflow_runs: WorkflowRun[];
}

interface ChannelStatus {
  channel: "slack" | "email";
  status: "ok" | "failing" | "unknown" | "unconfigured";
  lastRun: string | null;
  lastRunConclusion: string | null;
  lastSuccessfulRun: string | null;
  workflowName: string | null;
  runUrl: string | null;
}

async function fetchLatestRunForChannel(
  token: string,
  owner: string,
  repo: string,
  channelKeyword: string,
): Promise<ChannelStatus & { channel: "slack" | "email" }> {
  const channel = channelKeyword === "slack" ? "slack" : "email";
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=50&event=schedule`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!res.ok) {
      return { channel, status: "unknown", lastRun: null, lastRunConclusion: null, lastSuccessfulRun: null, workflowName: null, runUrl: null };
    }
    const data = (await res.json()) as WorkflowRunsResponse;
    const matchingRuns = data.workflow_runs.filter((run) =>
      run.name.toLowerCase().includes(channelKeyword),
    );

    if (matchingRuns.length === 0) {
      return { channel, status: "unknown", lastRun: null, lastRunConclusion: null, lastSuccessfulRun: null, workflowName: null, runUrl: null };
    }

    const latest = matchingRuns[0];
    const conclusion = latest.conclusion;
    let status: ChannelStatus["status"] = "unknown";
    if (conclusion === "success") status = "ok";
    else if (conclusion === "failure" || conclusion === "timed_out" || conclusion === "cancelled") status = "failing";

    const lastSuccessfulRun = matchingRuns.find((r) => r.conclusion === "success");

    return {
      channel,
      status,
      lastRun: latest.updated_at,
      lastRunConclusion: conclusion,
      lastSuccessfulRun: lastSuccessfulRun?.updated_at ?? null,
      workflowName: latest.name,
      runUrl: latest.html_url,
    };
  } catch {
    return { channel, status: "unknown", lastRun: null, lastRunConclusion: null, lastSuccessfulRun: null, workflowName: null, runUrl: null };
  }
}

router.get("/", requireAuth, requireRegisteredUser, requireAdmin, async (_req, res) => {
  const token = process.env.GITHUB_TOKEN;
  const repoSlug = process.env.GITHUB_REPO;

  if (!token || !repoSlug) {
    const channels: ChannelStatus[] = [
      { channel: "slack", status: "unconfigured", lastRun: null, lastRunConclusion: null, lastSuccessfulRun: null, workflowName: null, runUrl: null },
      { channel: "email", status: "unconfigured", lastRun: null, lastRunConclusion: null, lastSuccessfulRun: null, workflowName: null, runUrl: null },
    ];
    res.json({ channels, configuredAt: null });
    return;
  }

  const [owner, repo] = repoSlug.split("/");
  if (!owner || !repo) {
    res.status(400).json({ error: "GITHUB_REPO must be in the format owner/repo" });
    return;
  }

  const [slackStatus, emailStatus] = await Promise.all([
    fetchLatestRunForChannel(token, owner, repo, "slack"),
    fetchLatestRunForChannel(token, owner, repo, "email"),
  ]);

  res.json({ channels: [slackStatus, emailStatus], checkedAt: new Date().toISOString() });
});

export default router;
