import { createRoot } from "react-dom/client";
import App from "./App";
import { initializeDatabase } from "./database/initialize-database";
import { loadAppSettings } from "./database/app-settings-repository";
import { createAutomaticBackup } from "./services/database-maintenance-service";

import "./styles/main.scss";

async function startApp() {
  const rootElement = document.getElementById("root");

  if (!rootElement) {
    throw new Error("Root element was not found.");
  }

  const root = createRoot(rootElement);

  if (!("__TAURI_INTERNALS__" in window)) {
    root.render(<App />);
    return;
  }

  try {
    await initializeDatabase();
    const settings = await loadAppSettings();
    if (settings.automaticBackupsEnabled) {
      await createAutomaticBackup(settings.automaticBackupRetention).catch((error) => console.error("Automatic backup failed", error));
    }
    root.render(<App />);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The local database could not be opened.";
    root.render(
      <main className="startup-error" role="alert">
        <h1>Aspect - House Funds could not start</h1>
        <p>{message}</p>
        <button type="button" onClick={() => window.location.reload()}>
          Try again
        </button>
      </main>,
    );
  }
}

startApp();
