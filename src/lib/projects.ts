/**
 * Local project store for v0.
 * When Convex is wired, swap these for mutations/queries in convex/projects.ts.
 */

import type { ResultKind } from './generator';

export interface ProjectRecord {
  id: string;
  prompt: string;
  title: string;
  kind: ResultKind;
  html: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'appforge.projects.v0';

function readAll(): ProjectRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ProjectRecord[];
  } catch {
    return [];
  }
}

function writeAll(items: ProjectRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 50)));
}

export function saveGenerationLocal(input: {
  prompt: string;
  title: string;
  kind: ResultKind;
  html: string;
}): ProjectRecord {
  const now = Date.now();
  const rec: ProjectRecord = {
    id: `local_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    prompt: input.prompt,
    title: input.title,
    kind: input.kind,
    html: input.html,
    createdAt: now,
    updatedAt: now,
  };
  const all = readAll();
  all.unshift(rec);
  writeAll(all);
  return rec;
}

export function listProjectsLocal(): ProjectRecord[] {
  return readAll();
}

export function listRecentProjects(limit = 5): ProjectRecord[] {
  return readAll().slice(0, Math.max(0, limit));
}

export function getProjectLocal(id: string): ProjectRecord | undefined {
  return readAll().find((p) => p.id === id);
}

