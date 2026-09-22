"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { LocalCategory } from "@/lib/offline/types";

type Props = {
  categories: LocalCategory[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  allLabel?: string;
  questionCounts?: ReadonlyMap<string, number>;
};

export function CategoryTree({ categories, selectedId, onSelect, allLabel = "All questions", questionCounts }: Props) {
  const [open, setOpen] = useState(() => new Set(categories.filter((category) => !category.parent_id).map((category) => category.id)));
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const children = useMemo(() => {
    const grouped = new Map<string | null, LocalCategory[]>();
    for (const category of categories) {
      const siblings = grouped.get(category.parent_id) ?? [];
      siblings.push(category);
      grouped.set(category.parent_id, siblings);
    }
    for (const siblings of grouped.values()) siblings.sort((a, b) => a.name.localeCompare(b.name));
    return grouped;
  }, [categories]);
  const totalCounts = useMemo(() => {
    const totals = new Map<string, number>();
    function count(id: string, ancestors = new Set<string>()): number {
      if (totals.has(id)) return totals.get(id) ?? 0;
      if (ancestors.has(id)) return questionCounts?.get(id) ?? 0;
      const nextAncestors = new Set(ancestors).add(id);
      const total = (questionCounts?.get(id) ?? 0) + (children.get(id) ?? []).reduce((sum, child) => sum + count(child.id, nextAncestors), 0);
      totals.set(id, total);
      return total;
    }
    categories.forEach((category) => count(category.id));
    return totals;
  }, [categories, children, questionCounts]);

  const expanded = useMemo(() => {
    const next = new Set(open);
    const visited = new Set<string>();
    let currentId: string | null = selectedId;
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId); next.add(currentId);
      currentId = categoryById.get(currentId)?.parent_id ?? null;
    }
    return next;
  }, [categoryById, open, selectedId]);

  function toggle(id: string) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function render(parentId: string | null, depth = 0, ancestors = new Set<string>()): ReactNode {
    return (children.get(parentId) ?? []).map((category) => {
      if (ancestors.has(category.id)) return null;
      const hasChildren = (children.get(category.id)?.length ?? 0) > 0;
      const nextAncestors = new Set(ancestors).add(category.id);
      const directCount = questionCounts?.get(category.id) ?? 0;
      const totalCount = totalCounts.get(category.id) ?? directCount;
      return (
        <div key={category.id}>
          <div className={`tree-row ${selectedId === category.id ? "active" : ""}`} style={{ paddingLeft: 6 + depth * 14 }}>
            <button className="tree-toggle" type="button" onClick={() => toggle(category.id)} aria-label={`${expanded.has(category.id) ? "Collapse" : "Expand"} ${category.name}`} disabled={!hasChildren}>
              {hasChildren ? (expanded.has(category.id) ? "⌄" : "›") : ""}
            </button>
            <button className="tree-name" type="button" onClick={() => { setOpen((current) => new Set(current).add(category.id)); onSelect(category.id); }}><span className="tree-folder" aria-hidden="true" /><span className="tree-name-text">{category.name}</span><small>{directCount !== totalCount ? `${directCount} / ${totalCount}` : totalCount}</small></button>
          </div>
          {hasChildren && expanded.has(category.id) ? render(category.id, depth + 1, nextAncestors) : null}
        </div>
      );
    });
  }

  return (
    <div className="category-tree">
      <button className={`tree-all ${selectedId === null ? "active" : ""}`} type="button" onClick={() => onSelect(null)}><span>{allLabel}</span><small>{questionsTotal(questionCounts)}</small></button>
      {render(null)}
      {!categories.length ? <p className="tree-empty">No folders yet. Create the first root folder below.</p> : null}
    </div>
  );
}

function questionsTotal(counts?: ReadonlyMap<string, number>) {
  if (!counts) return 0;
  let total = 0;
  counts.forEach((count) => { total += count; });
  return total;
}
