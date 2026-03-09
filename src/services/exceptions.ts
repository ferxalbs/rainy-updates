import path from "node:path";
import { mkdir } from "node:fs/promises";
import type {
  ExceptionEntry,
  ExceptionsOptions,
  ExceptionsResult,
} from "../types/index.js";

interface ExceptionStore {
  contractVersion: "1";
  updatedAt: string;
  exceptions: ExceptionEntry[];
}

const ACTIVE_STATUSES = new Set<ExceptionEntry["status"]>([
  "not_affected",
  "mitigated",
  "accepted_risk",
  "fixed",
]);

export function defaultExceptionsPath(cwd: string): string {
  return path.join(cwd, ".rainy", "exceptions.json");
}

export async function runExceptionsService(
  options: ExceptionsOptions,
): Promise<ExceptionsResult> {
  const filePath = options.filePath ?? defaultExceptionsPath(options.cwd);
  const store = await readExceptionStore(filePath);
  const warnings: string[] = [];
  const errors: string[] = [];

  if (options.action === "add") {
    const validation = validateAddOptions(options);
    errors.push(...validation);
    if (errors.length === 0) {
      const now = new Date().toISOString();
      const entry: ExceptionEntry = {
        id: options.id ?? `${options.packageName}:${options.cveId ?? "all"}:${Date.now()}`,
        packageName: options.packageName!,
        cveId: options.cveId,
        reason: options.reason!,
        owner: options.owner!,
        evidence: options.evidence!,
        status: options.status!,
        expiresAt: options.expiresAt!,
        createdAt: now,
        updatedAt: now,
      };
      store.exceptions = [
        ...store.exceptions.filter((item) => item.id !== entry.id),
        entry,
      ].sort((a, b) => a.id.localeCompare(b.id));
      store.updatedAt = now;
      await writeExceptionStore(filePath, store);
    }
  }

  if (options.action === "remove") {
    if (!options.id) {
      errors.push("exceptions remove requires --id");
    } else {
      const before = store.exceptions.length;
      store.exceptions = store.exceptions.filter((entry) => entry.id !== options.id);
      if (store.exceptions.length === before) {
        warnings.push(`No exception found for id: ${options.id}`);
      } else {
        store.updatedAt = new Date().toISOString();
        await writeExceptionStore(filePath, store);
      }
    }
  }

  if (options.action === "expire") {
    if (!options.id) {
      errors.push("exceptions expire requires --id");
    } else {
      const now = new Date().toISOString();
      const target = store.exceptions.find((entry) => entry.id === options.id);
      if (!target) {
        warnings.push(`No exception found for id: ${options.id}`);
      } else {
        target.expiresAt = now;
        target.updatedAt = now;
        store.updatedAt = now;
        await writeExceptionStore(filePath, store);
      }
    }
  }

  if (options.action === "validate") {
    errors.push(...validateEntries(store.exceptions, options.strict));
  }

  const entries = options.activeOnly
    ? store.exceptions.filter((entry) => isExceptionActive(entry))
    : store.exceptions;

  const active = entries.filter((entry) => isExceptionActive(entry)).length;
  const expired = entries.length - active;

  return {
    action: options.action,
    filePath,
    entries,
    active,
    expired,
    errors,
    warnings,
  };
}

export async function findMatchingException(
  cwd: string,
  packageName: string,
  cveId?: string,
  explicitFile?: string,
): Promise<ExceptionEntry | undefined> {
  const store = await readExceptionStore(explicitFile ?? defaultExceptionsPath(cwd));
  return store.exceptions.find((entry) => {
    if (!isExceptionActive(entry)) return false;
    if (entry.packageName !== packageName) return false;
    if (entry.cveId && cveId && entry.cveId !== cveId) return false;
    if (entry.cveId && !cveId) return false;
    return true;
  });
}

export function isExceptionActive(entry: ExceptionEntry, now = Date.now()): boolean {
  if (!ACTIVE_STATUSES.has(entry.status)) return false;
  const expires = Date.parse(entry.expiresAt);
  if (!Number.isFinite(expires)) return false;
  return expires > now;
}

async function readExceptionStore(filePath: string): Promise<ExceptionStore> {
  try {
    const raw = await Bun.file(filePath).json();
    const parsed = raw as Partial<ExceptionStore>;
    const exceptions = Array.isArray(parsed.exceptions)
      ? parsed.exceptions.filter((entry): entry is ExceptionEntry => {
        return (
          Boolean(entry) &&
          typeof entry.id === "string" &&
          typeof entry.packageName === "string" &&
          typeof entry.reason === "string" &&
          typeof entry.owner === "string" &&
          typeof entry.evidence === "string" &&
          typeof entry.status === "string" &&
          typeof entry.expiresAt === "string" &&
          typeof entry.createdAt === "string" &&
          typeof entry.updatedAt === "string"
        );
      })
      : [];

    return {
      contractVersion: "1",
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date().toISOString(),
      exceptions,
    };
  } catch {
    return {
      contractVersion: "1",
      updatedAt: new Date().toISOString(),
      exceptions: [],
    };
  }
}

async function writeExceptionStore(filePath: string, store: ExceptionStore): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await Bun.write(filePath, `${JSON.stringify(store, null, 2)}\n`);
}

function validateAddOptions(options: ExceptionsOptions): string[] {
  const errors: string[] = [];
  if (!options.packageName) errors.push("exceptions add requires --package");
  if (!options.reason) errors.push("exceptions add requires --reason");
  if (!options.owner) errors.push("exceptions add requires --owner");
  if (!options.evidence) errors.push("exceptions add requires --evidence");
  if (!options.status) errors.push("exceptions add requires --status");
  if (!options.expiresAt) {
    errors.push("exceptions add requires --expires-at (ISO date)");
  } else if (!Number.isFinite(Date.parse(options.expiresAt))) {
    errors.push("--expires-at must be a valid ISO date string");
  }
  return errors;
}

function validateEntries(entries: ExceptionEntry[], strict: boolean): string[] {
  const errors: string[] = [];

  for (const entry of entries) {
    if (!Number.isFinite(Date.parse(entry.expiresAt))) {
      errors.push(`[${entry.id}] invalid expiresAt`);
      continue;
    }

    if (strict && entry.status === "accepted_risk") {
      const maxMs = 90 * 24 * 60 * 60 * 1000;
      const ttl = Date.parse(entry.expiresAt) - Date.now();
      if (ttl > maxMs) {
        errors.push(`[${entry.id}] accepted_risk exceptions must expire within 90 days in --strict mode`);
      }
    }
  }

  return errors;
}
