"use client";

import { Badge } from "@/components/ui/badge";
import type { DataViewPayloads } from "@/lib/agents/types";

interface TableViewProps {
  data: DataViewPayloads["table"];
}

export function TableView({ data }: TableViewProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700">
            {data.columns.map((col) => (
              <th
                key={col.key}
                className="text-left py-2 px-3 text-xs font-medium text-muted-foreground"
                style={col.width ? { width: col.width } : undefined}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-800">
              {data.columns.map((col) => (
                <td key={col.key} className="py-2 px-3">
                  {col.type === "badge" ? (
                    <Badge variant="secondary">{String(row[col.key] || "")}</Badge>
                  ) : col.type === "link" ? (
                    <a
                      href={String(row[col.key] || "#")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:underline"
                    >
                      {String(row[col.key] || "")}
                    </a>
                  ) : (
                    String(row[col.key] ?? "")
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.total_count !== undefined && (
        <p className="text-xs text-muted-foreground mt-2">
          Showing {data.rows.length} of {data.total_count}
        </p>
      )}
    </div>
  );
}
