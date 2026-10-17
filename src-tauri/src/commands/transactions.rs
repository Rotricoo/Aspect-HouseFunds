use serde::Deserialize;
use sqlx::{sqlite::SqliteConnectOptions, ConnectOptions, SqlitePool};
use std::str::FromStr;

#[derive(Deserialize)]
pub(crate) struct TransactionStatement {
    pub sql: String,
    pub values: Vec<serde_json::Value>,
}

#[tauri::command]
pub(crate) async fn execute_database_transaction(
    app: tauri::AppHandle,
    statements: Vec<TransactionStatement>,
) -> Result<(), String> {
    let database_path = crate::database_path(&app)?;
    let options = SqliteConnectOptions::from_str(&crate::sqlite_url(&database_path))
        .map_err(|error| error.to_string())?
        .foreign_keys(true)
        .disable_statement_logging();
    let pool = SqlitePool::connect_with(options)
        .await
        .map_err(|error| error.to_string())?;
    let result = execute_statements_in_transaction(&pool, statements).await;
    pool.close().await;
    result
}

pub(crate) async fn execute_statements_in_transaction(
    pool: &SqlitePool,
    statements: Vec<TransactionStatement>,
) -> Result<(), String> {
    let mut transaction = pool.begin().await.map_err(|error| error.to_string())?;
    for statement in statements {
        let mut query = sqlx::query(&statement.sql);
        for value in statement.values {
            query = match value {
                serde_json::Value::Null => query.bind(Option::<String>::None),
                serde_json::Value::Bool(value) => query.bind(value),
                serde_json::Value::Number(value) if value.is_i64() => query.bind(value.as_i64()),
                serde_json::Value::Number(value) if value.is_u64() => {
                    query.bind(value.as_u64().map(|number| number as i64))
                }
                serde_json::Value::Number(value) => query.bind(value.as_f64()),
                serde_json::Value::String(value) => query.bind(value),
                _ => {
                    return Err(
                        "Transaction values must be null, boolean, number or string.".into(),
                    )
                }
            };
        }
        query
            .execute(&mut *transaction)
            .await
            .map_err(|error| error.to_string())?;
    }
    transaction
        .commit()
        .await
        .map_err(|error| error.to_string())?;
    Ok(())
}
