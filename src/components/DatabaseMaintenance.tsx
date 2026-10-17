import { useEffect, useState } from "react";
import {
  createDatabaseBackup,
  exportFinancialLedgerCsv,
  migrateLegacyAttachments,
  restoreDatabaseBackup,
  type AttachmentMigrationReport,
} from "../services/database-maintenance-service";

type OperationState = { type: "idle" | "working" | "success" | "error"; message: string };

function DatabaseMaintenance() {
  const [attachmentReport, setAttachmentReport] = useState<AttachmentMigrationReport | null>(null);
  const [operation, setOperation] = useState<OperationState>({ type: "idle", message: "" });

  useEffect(() => {
    migrateLegacyAttachments()
      .then(setAttachmentReport)
      .catch((error) =>
        setOperation({ type: "error", message: error instanceof Error ? error.message : "Attachments could not be checked." }),
      );
  }, []);

  async function handleBackup() {
    setOperation({ type: "working", message: "Creating a verified SQLite backup…" });
    try {
      const path = await createDatabaseBackup();
      setOperation(path ? { type: "success", message: `Backup saved to ${path}` } : { type: "idle", message: "" });
    } catch (error) {
      setOperation({ type: "error", message: error instanceof Error ? error.message : "The backup could not be created." });
    }
  }

  async function handleRestore() {
    const confirmed = window.confirm(
      "Restore this Aspect - House Funds backup? The current database and managed attachments will be replaced, and the app will reload. A recovery copy will be kept automatically. Only restore a backup you trust.",
    );
    if (!confirmed) return;

    setOperation({ type: "working", message: "Validating and restoring backup…" });
    try {
      const path = await restoreDatabaseBackup();
      if (!path) {
        setOperation({ type: "idle", message: "" });
        return;
      }
      window.location.reload();
    } catch (error) {
      setOperation({ type: "error", message: error instanceof Error ? error.message : "The backup could not be restored." });
    }
  }

  async function handleCsvExport() {
    setOperation({ type: "working", message: "Creating financial ledger…" });
    try {
      const path = await exportFinancialLedgerCsv();
      setOperation(path ? { type: "success", message: `Ledger saved to ${path}` } : { type: "idle", message: "" });
    } catch (error) {
      setOperation({ type: "error", message: error instanceof Error ? error.message : "The ledger could not be exported." });
    }
  }

  return (
    <section className="database-maintenance" aria-labelledby="database-maintenance-title">
      <div className="database-maintenance__content">
        <p className="database-maintenance__eyebrow">Local data protection</p>
        <h3 className="database-maintenance__title" id="database-maintenance-title">
          Database backup
        </h3>
        <p className="database-maintenance__description">
          Export a complete SQLite snapshot and its managed receipts before major changes or when moving the application to another
          computer.
        </p>
        <p className="database-maintenance__privacy-note">
          Backups and CSV exports may contain real financial records and attachments. They are not encrypted by Aspect - House Funds; store
          them only in a location you trust.
        </p>
        {attachmentReport && (
          <p
            className={`database-maintenance__attachment-status ${attachmentReport.missingFileNames.length > 0 ? "database-maintenance__attachment-status--warning" : ""}`}
          >
            Receipts: {attachmentReport.alreadyManaged} managed, {attachmentReport.migrated} migrated
            {attachmentReport.missingFileNames.length > 0 &&
              `, ${attachmentReport.missingFileNames.length} missing (${attachmentReport.missingFileNames.join(", ")})`}
            .
          </p>
        )}
        {operation.message && (
          <p
            className={`database-maintenance__status database-maintenance__status--${operation.type}`}
            role={operation.type === "error" ? "alert" : "status"}
          >
            {operation.message}
          </p>
        )}
      </div>
      <div className="database-maintenance__actions">
        <button type="button" onClick={handleCsvExport} disabled={operation.type === "working"}>
          Export CSV
        </button>
        <button type="button" onClick={handleBackup} disabled={operation.type === "working"}>
          Export backup
        </button>
        <button type="button" onClick={handleRestore} disabled={operation.type === "working"}>
          Restore backup
        </button>
      </div>
    </section>
  );
}

export default DatabaseMaintenance;
