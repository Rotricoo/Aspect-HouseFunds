import { useEffect, useState } from "react";
import { defaultAppSettings, loadAppSettings, saveAppSettings } from "../database/app-settings-repository";
import type { AppSettings } from "../types/app-settings";

export default function AppSettingsManager() {
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    void loadAppSettings()
      .then(setSettings)
      .catch(() => setStatus("Settings could not be loaded."));
  }, []);

  async function handleSave() {
    setStatus("Saving…");
    try {
      await saveAppSettings(settings);
      window.dispatchEvent(new Event("housefund-settings-saved"));
      setStatus("Settings saved.");
    } catch {
      setStatus("Settings could not be saved.");
    }
  }

  return (
    <section className="app-settings-manager" aria-labelledby="app-settings-title">
      <div className="app-settings-manager__heading">
        <div>
          <p className="app-settings-manager__eyebrow">Preferences</p>
          <h3 id="app-settings-title">Application settings</h3>
        </div>
      </div>
      <div className="app-settings-manager__fields">
        <label className="app-settings-manager__toggle">
          <input
            type="checkbox"
            checked={settings.automaticBackupsEnabled}
            onChange={(event) => setSettings((current) => ({ ...current, automaticBackupsEnabled: event.target.checked }))}
          />
          <span>
            <strong>Automatic daily backup</strong>
            Keep one verified local backup per day, including managed receipts. Backups are local and not encrypted.
          </span>
        </label>
        <label>
          Backups to retain
          <input
            type="number"
            min="1"
            max="365"
            value={settings.automaticBackupRetention}
            disabled={!settings.automaticBackupsEnabled}
            onChange={(event) => setSettings((current) => ({ ...current, automaticBackupRetention: Number(event.target.value) }))}
          />
        </label>
        <label>
          Purchases per page
          <select
            value={settings.purchasePageSize}
            onChange={(event) => setSettings((current) => ({ ...current, purchasePageSize: Number(event.target.value) }))}
          >
            <option value="9">9</option>
            <option value="15">15</option>
            <option value="24">24</option>
            <option value="30">30</option>
          </select>
        </label>
      </div>
      <div className="app-settings-manager__footer">
        <span role="status">{status}</span>
        <button type="button" onClick={() => void handleSave()}>
          Save settings
        </button>
      </div>
    </section>
  );
}
