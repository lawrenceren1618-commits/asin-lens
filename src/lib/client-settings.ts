import type { SourcePriorityConfig } from "@/lib/research/source-priority";
import {
  DEFAULT_SOURCE_PRIORITY,
  parseSourcePriority,
} from "@/lib/research/source-priority";

const PRIORITY_KEY = "asin-lens-source-priority-v1";
const RESOLVED_ISSUES_KEY = "asin-lens-resolved-issues-v1";

export function loadSourcePriority(): SourcePriorityConfig {
  if (typeof window === "undefined") return DEFAULT_SOURCE_PRIORITY;
  try {
    const raw = localStorage.getItem(PRIORITY_KEY);
    if (!raw) return DEFAULT_SOURCE_PRIORITY;
    return parseSourcePriority(JSON.parse(raw));
  } catch {
    return DEFAULT_SOURCE_PRIORITY;
  }
}

export function saveSourcePriority(config: SourcePriorityConfig) {
  localStorage.setItem(
    PRIORITY_KEY,
    JSON.stringify(parseSourcePriority(config)),
  );
}

export function loadResolvedIssueIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(RESOLVED_ISSUES_KEY);
    if (!raw) return new Set();
    const list = JSON.parse(raw) as string[];
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

export function saveResolvedIssueIds(ids: Set<string>) {
  localStorage.setItem(RESOLVED_ISSUES_KEY, JSON.stringify([...ids]));
}
