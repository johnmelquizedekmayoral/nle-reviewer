"use client";

import { useState, type ReactNode } from "react";
import type { LocalCategory } from "@/lib/offline/types";

type Props = {
  categories: LocalCategory[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

export function CategoryTree({ categories, selectedId, onSelect }: Props) {
  const [open, setOpen] = useState(() => new Set(categories.filter((category) => !category.parent_id).map((category) => category.id)));
  const children = new Map<string | null, LocalCategory[]>();
  for (const category of categories) {
    const siblings = children.get(category.parent_id) ?? [];
    siblings.push(category);
    children.set(category.parent_id, siblings);
  }
  for (const siblings of children.values()) siblings.sort((a, b) => a.name.localeCompare(b.name));

  function toggle(id: string) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function render(parentId: string | null, depth = 0): ReactNode {
    return (children.get(parentId) ?? []).map((category) => {
      const hasChildren = (children.get(category.id)?.length ?? 0) > 0;
      return (
        <div key={category.id}>
          <div className={`tree-row ${selectedId === category.id ? "active" : ""}`} style={{ paddingLeft: 8 + depth * 15 }}>
            <button className="tree-toggle" type="button" onClick={() => toggle(category.id)} aria-label={`${open.has(category.id) ? "Collapse" : "Expand"} ${category.name}`} disabled={!hasChildren}>
              {hasChildren ? (open.has(category.id) ? "−" : "+") : "·"}
            </button>
            <button className="tree-name" type="button" onClick={() => onSelect(category.id)}>{category.name}</button>
          </div>
          {hasChildren && open.has(category.id) ? render(category.id, depth + 1) : null}
        </div>
      );
    });
  }

  return (
    <div className="category-tree">
      <button className={`tree-all ${selectedId === null ? "active" : ""}`} type="button" onClick={() => onSelect(null)}>All questions</button>
      {render(null)}
    </div>
  );
}
