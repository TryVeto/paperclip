import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { listRunTraceArchivesQuerySchema } from "@paperclipai/shared";
import { badRequest } from "../errors.js";
import { runTraceArchiveService } from "../services/run-trace-archive.js";
import { assertBoard, assertCompanyAccess } from "./authz.js";

function parseDateQuery(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw badRequest(`Invalid ${field} query value`);
  }
  return parsed;
}

export function runTraceArchiveRoutes(db: Db) {
  const router = Router();
  const archives = runTraceArchiveService(db);

  router.get("/companies/:companyId/run-traces", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);

    const query = listRunTraceArchivesQuerySchema.parse({
      since: typeof req.query.since === "string" ? req.query.since : undefined,
      agentId: typeof req.query.agentId === "string" ? req.query.agentId : undefined,
      runId: typeof req.query.runId === "string" ? req.query.runId : undefined,
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      runStatus: typeof req.query.runStatus === "string" ? req.query.runStatus : undefined,
      limit: typeof req.query.limit === "string" ? req.query.limit : undefined,
    });

    const rows = await archives.listArchives({
      companyId,
      since: query.since ? parseDateQuery(query.since, "since") : undefined,
      agentId: query.agentId,
      runId: query.runId,
      status: query.status,
      runStatus: query.runStatus,
      limit: query.limit,
    });
    res.json(rows);
  });

  router.get("/run-traces/:archiveId", async (req, res) => {
    assertBoard(req);
    const archiveId = req.params.archiveId as string;
    const archive = await archives.getArchiveById(archiveId);
    if (!archive) {
      res.status(404).json({ error: "Run trace archive not found" });
      return;
    }
    assertCompanyAccess(req, archive.companyId);
    res.json(archive);
  });

  router.get("/run-traces/:archiveId/bundle", async (req, res) => {
    assertBoard(req);
    const archiveId = req.params.archiveId as string;
    const archive = await archives.getArchiveById(archiveId);
    if (!archive) {
      res.status(404).json({ error: "Run trace archive not found" });
      return;
    }
    assertCompanyAccess(req, archive.companyId);
    const bundle = await archives.getArchiveBundle(archiveId);
    if (!bundle) {
      res.status(404).json({ error: "Run trace bundle not ready" });
      return;
    }
    res.json(bundle);
  });

  return router;
}
