import {
  maintenanceStatusLabels,
  type MaintenanceStatus
} from "@/lib/maintenance/status";
import type { MaintenanceEvent } from "./actions";

type MaintenanceTimelineProps = {
  events: MaintenanceEvent[];
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function statusLabel(status: MaintenanceStatus | null) {
  return status ? maintenanceStatusLabels[status] : null;
}

export function MaintenanceTimeline({ events }: MaintenanceTimelineProps) {
  if (events.length === 0) {
    return (
      <p className="rounded-md border border-line bg-surface px-4 py-3 text-sm text-muted shadow-sm">
        Nenhum evento registrado.
      </p>
    );
  }

  return (
    <ol className="grid gap-3">
      {events.map((event) => (
        <li
          className="min-w-0 break-words rounded-md border border-line bg-surface p-4 shadow-sm"
          key={event.id}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {event.event_type === "created"
                  ? "Ordem criada"
                  : "Status alterado"}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted">
                {event.description || "Evento registrado na ordem."}
              </p>
              {event.old_status || event.new_status ? (
                <p className="mt-2 text-xs font-medium text-subtle">
                  {[statusLabel(event.old_status), statusLabel(event.new_status)]
                    .filter(Boolean)
                    .join(" -> ")}
                </p>
              ) : null}
            </div>
            <time className="text-xs text-subtle">
              {formatDateTime(event.created_at)}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}
