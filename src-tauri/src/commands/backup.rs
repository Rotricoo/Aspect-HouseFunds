use sqlx::{sqlite::SqliteConnectOptions, ConnectOptions, SqlitePool};
use std::{
    fs,
    path::PathBuf,
    str::FromStr,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::Manager;

// Keep this in sync with the highest migration version registered in `run`.
pub(crate) const CURRENT_SCHEMA_VERSION: i64 = 24;

#[tauri::command]
pub(crate) async fn create_database_backup(
    app: tauri::AppHandle,
    destination_path: String,
) -> Result<(), String> {
    let source_path = crate::database_path(&app)?;
    let destination = PathBuf::from(destination_path);
    if source_path == destination {
        return Err("Choose a location outside the active Aspect - House Funds database.".into());
    }
    if destination.exists() {
        fs::remove_file(&destination).map_err(|error| error.to_string())?;
    }
    let options = SqliteConnectOptions::from_str(&crate::sqlite_url(&source_path))
        .map_err(|error| error.to_string())?
        .foreign_keys(true)
        .disable_statement_logging();
    let pool = SqlitePool::connect_with(options)
        .await
        .map_err(|error| error.to_string())?;
    let escaped_destination = destination.to_string_lossy().replace('\'', "''");
    sqlx::query(&format!("VACUUM INTO '{}'", escaped_destination))
        .execute(&pool)
        .await
        .map_err(|error| error.to_string())?;
    pool.close().await;
    let source_attachments = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("attachments");
    let backup_attachments = crate::attachment_bundle_path(&destination);
    if backup_attachments.exists() {
        fs::remove_dir_all(&backup_attachments).map_err(|error| error.to_string())?;
    }
    if source_attachments.is_dir() {
        crate::copy_directory(&source_attachments, &backup_attachments)?;
    }
    Ok(())
}

#[tauri::command]
pub(crate) async fn create_automatic_backup(
    app: tauri::AppHandle,
    retention_count: usize,
) -> Result<String, String> {
    let backup_directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("backups");
    fs::create_dir_all(&backup_directory).map_err(|error| error.to_string())?;
    let day_number = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_secs()
        / 86_400;
    let destination = backup_directory.join(format!("aspect-house-funds-auto-{day_number}.db"));
    if !destination.exists() {
        create_database_backup(app.clone(), destination.to_string_lossy().into_owned()).await?;
    }
    let mut backups = fs::read_dir(&backup_directory)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            path.is_file()
                && path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(|name| {
                        name.starts_with("aspect-house-funds-auto-") && name.ends_with(".db")
                    })
        })
        .collect::<Vec<_>>();
    backups.sort();
    let expired_count = backups.len().saturating_sub(retention_count.clamp(1, 365));
    for expired in backups.into_iter().take(expired_count) {
        let attachment_directory = crate::attachment_bundle_path(&expired);
        fs::remove_file(&expired).map_err(|error| error.to_string())?;
        if attachment_directory.exists() {
            fs::remove_dir_all(attachment_directory).map_err(|error| error.to_string())?;
        }
    }
    Ok(destination.to_string_lossy().into_owned())
}

#[tauri::command]
pub(crate) fn write_export_file(destination_path: String, contents: String) -> Result<(), String> {
    let destination = PathBuf::from(destination_path);
    if destination.is_dir() {
        return Err("Choose a file name for the export.".into());
    }
    fs::write(destination, contents).map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn restore_database_backup(
    app: tauri::AppHandle,
    source_path: String,
) -> Result<(), String> {
    let source = PathBuf::from(source_path);
    if !source.is_file() {
        return Err("The selected backup file does not exist.".into());
    }
    let source_options = SqliteConnectOptions::from_str(&crate::sqlite_url(&source))
        .map_err(|error| error.to_string())?
        .read_only(true)
        .foreign_keys(true)
        .disable_statement_logging();
    let source_pool = SqlitePool::connect_with(source_options)
        .await
        .map_err(|_| "The selected file is not a readable SQLite database.".to_string())?;
    let integrity: String = sqlx::query_scalar("PRAGMA integrity_check")
        .fetch_one(&source_pool)
        .await
        .map_err(|error| error.to_string())?;
    if integrity != "ok" {
        source_pool.close().await;
        return Err(format!(
            "The selected backup failed SQLite integrity validation: {integrity}"
        ));
    }
    let schema_version: i64 =
        sqlx::query_scalar("SELECT COALESCE(MAX(version), 0) FROM _sqlx_migrations")
            .fetch_one(&source_pool)
            .await
            .map_err(|_| {
                "The selected database does not contain Aspect - House Funds migrations."
                    .to_string()
            })?;
    if schema_version > CURRENT_SCHEMA_VERSION {
        source_pool.close().await;
        return Err(format!(
            "This backup was created by a newer version of Aspect - House Funds (schema {schema_version}). Update the app before restoring it."
        ));
    }
    for table in ["people", "payment_sources", "purchases", "attachments"] {
        let table_exists: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name = ?",
        )
        .bind(table)
        .fetch_one(&source_pool)
        .await
        .map_err(|error| error.to_string())?;
        if table_exists != 1 {
            source_pool.close().await;
            return Err("The selected file is not a complete Aspect - House Funds backup.".into());
        }
    }
    let attachment_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM attachments WHERE file_path LIKE 'attachments/%'")
            .fetch_one(&source_pool)
            .await
            .map_err(|error| error.to_string())?;
    source_pool.close().await;
    if attachment_count > 0 && !crate::attachment_bundle_path(&source).is_dir() {
        return Err("This backup references managed receipts, but its matching attachments folder is missing.".into());
    }
    let target = crate::database_path(&app)?;
    let app_data_directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    crate::restore_backup_files(&source, &target, &app_data_directory)
}
