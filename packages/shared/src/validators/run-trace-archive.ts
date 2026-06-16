import { z } from "zod";
import { RUN_TRACE_ARCHIVE_STATUSES } from "../types/run-trace-archive.js";

export const runTraceArchiveStatusSchema = z.enum(RUN_TRACE_ARCHIVE_STATUSES);

export const listRunTraceArchivesQuerySchema = z.object({
  since: z.string().datetime().optional(),
  agentId: z.string().uuid().optional(),
  runId: z.string().uuid().optional(),
  status: runTraceArchiveStatusSchema.optional(),
  runStatus: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export type ListRunTraceArchivesQuery = z.infer<typeof listRunTraceArchivesQuerySchema>;
