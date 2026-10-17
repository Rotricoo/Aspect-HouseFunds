use serde::Serialize;
use sqlx::{sqlite::SqliteConnectOptions, ConnectOptions, SqlitePool};
use std::{fs, path::PathBuf, str::FromStr};
use tauri::Manager;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AttachmentMigrationReport {
    migrated: usize,
    already_managed: usize,
    missing_file_names: Vec<String>,
}

#[tauri::command]
pub(crate) async fn migrate_legacy_attachments(
    app: tauri::AppHandle,
) -> Result<AttachmentMigrationReport, String> {
    let active_database_path = crate::database_path(&app)?;
    let options = SqliteConnectOptions::from_str(&crate::sqlite_url(&active_database_path))
        .map_err(|error| error.to_string())?
        .foreign_keys(true)
        .disable_statement_logging();
    let pool = SqlitePool::connect_with(options)
        .await
        .map_err(|error| error.to_string())?;
    let rows: Vec<(String, String, String)> =
        sqlx::query_as("SELECT id, file_path, original_file_name FROM attachments ORDER BY id")
            .fetch_all(&pool)
            .await
            .map_err(|error| error.to_string())?;
    let app_data_directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let attachments_directory = app_data_directory.join("attachments");
    fs::create_dir_all(&attachments_directory).map_err(|error| error.to_string())?;
    let downloads_directory = app.path().download_dir().ok();
    let mut report = AttachmentMigrationReport {
        migrated: 0,
        already_managed: 0,
        missing_file_names: Vec::new(),
    };

    for (id, stored_path, original_file_name) in rows {
        if stored_path.starts_with("attachments/") {
            if app_data_directory.join(&stored_path).is_file() {
                report.already_managed += 1;
            } else {
                report.missing_file_names.push(original_file_name);
            }
            continue;
        }
        let path = PathBuf::from(&stored_path);
        let file_name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or(&original_file_name)
            .to_string();
        let mut candidates = vec![path];
        if let Some(downloads) = &downloads_directory {
            candidates.push(downloads.join("houseFunds").join(&file_name));
            candidates.push(downloads.join(&file_name));
        }
        let Some(source) = candidates.into_iter().find(|candidate| candidate.is_file()) else {
            report.missing_file_names.push(original_file_name);
            continue;
        };
        let managed_name = format!(
            "legacy-{}-{}",
            crate::sanitize_file_name(&id),
            crate::sanitize_file_name(&file_name)
        );
        let relative_path = format!("attachments/{managed_name}");
        fs::copy(source, app_data_directory.join(&relative_path))
            .map_err(|error| error.to_string())?;
        sqlx::query("UPDATE attachments SET file_path = ?, original_file_name = ? WHERE id = ?")
            .bind(&relative_path)
            .bind(&file_name)
            .bind(&id)
            .execute(&pool)
            .await
            .map_err(|error| error.to_string())?;
        report.migrated += 1;
    }
    pool.close().await;
    Ok(report)
}
