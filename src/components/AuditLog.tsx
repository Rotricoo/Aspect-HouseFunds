import { useEffect, useState } from "react";
import { loadAuditEvents } from "../database/settlement-repository";
import type { AuditEvent } from "../types/settlement-period";

export default function AuditLog() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () =>
      void loadAuditEvents()
        .then((result) => {
          setEvents(result);
          setError(null);
        })
        .catch(() => setError("The audit log could not be loaded."));
    refresh();
    window.addEventListener("housefund-audit-updated", refresh);
    return () => window.removeEventListener("housefund-audit-updated", refresh);
  }, []);

  return (
    <section className="audit-log" aria-labelledby="audit-log-title">
      <div className="audit-log__heading">
        <div>
          <p className="audit-log__eyebrow">Traceability</p>
          <h3 id="audit-log-title">Audit log</h3>
        </div>
        <span>{events.length} recent events</span>
      </div>
      {error && (
        <p className="audit-log__error" role="alert">
          {error}
        </p>
      )}
      {!error && events.length === 0 && <p className="audit-log__empty">New changes will be recorded here.</p>}
      {events.length > 0 && (
        <ol className="audit-log__list">
          {events.map((event) => (
            <li className="audit-log__event" key={event.id}>
              <span className={`audit-log__action audit-log__action--${event.action}`}>{event.action}</span>
              <div>
                <strong>{event.summary}</strong>
                <span>
                  {event.entityType} · {event.entityId}
                </span>
                {event.snapshotJson && (
                  <details>
                    <summary>Recorded details</summary>
                    <code>{event.snapshotJson}</code>
                  </details>
                )}
              </div>
              <time dateTime={event.occurredAt.toISOString()}>
                {event.occurredAt.toLocaleString("en-AU", { timeZone: "Australia/Brisbane" })}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
