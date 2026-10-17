use std::{
    fs,
    path::{Path, PathBuf},
};
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

mod commands;
use commands::{
    attachments::migrate_legacy_attachments,
    backup::{
        create_automatic_backup, create_database_backup, restore_database_backup, write_export_file,
    },
    transactions::execute_database_transaction,
};

pub(crate) fn database_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join("housefund.db"))
        .map_err(|error| error.to_string())
}

pub(crate) fn sqlite_url(path: &Path) -> String {
    format!("sqlite:{}", path.display())
}

pub(crate) fn sanitize_file_name(file_name: &str) -> String {
    file_name
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || ".-_".contains(character) {
                character
            } else {
                '-'
            }
        })
        .collect()
}

pub(crate) fn attachment_bundle_path(database_backup_path: &Path) -> PathBuf {
    let stem = database_backup_path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("aspect-house-funds-backup");
    database_backup_path.with_file_name(format!("{stem}-attachments"))
}

pub(crate) fn copy_directory(source: &Path, destination: &Path) -> Result<(), String> {
    fs::create_dir_all(destination).map_err(|error| error.to_string())?;
    for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());
        if source_path.is_dir() {
            copy_directory(&source_path, &destination_path)?;
        } else {
            fs::copy(&source_path, &destination_path).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{attachment_bundle_path, restore_backup_files, sanitize_file_name};
    use crate::commands::transactions::{execute_statements_in_transaction, TransactionStatement};
    use serde_json::json;
    use sqlx::{sqlite::SqlitePoolOptions, Row};
    use std::{
        fs,
        path::Path,
        time::{SystemTime, UNIX_EPOCH},
    };

    const ALL_MIGRATIONS: &[&str] = &[
        include_str!("../migrations/001_core.sql"),
        include_str!("../migrations/002_purchases.sql"),
        include_str!("../migrations/003_financial_movements.sql"),
        include_str!("../migrations/004_recurring_and_installments.sql"),
        include_str!("../migrations/005_attachments.sql"),
        include_str!("../migrations/006_seed_reference_data.sql"),
        include_str!("../migrations/007_seed_purchases.sql"),
        include_str!("../migrations/008_seed_financial_movements.sql"),
        include_str!("../migrations/009_seed_recurring_and_installments.sql"),
        include_str!("../migrations/010_schedule_rent_through_2026.sql"),
        include_str!("../migrations/011_extend_rent_to_contract_end.sql"),
        include_str!("../migrations/012_financial_movement_cancellations.sql"),
        include_str!("../migrations/013_seed_2026_09_23_24_activity.sql"),
        include_str!("../migrations/014_recurring_contribution_occurrences.sql"),
        include_str!("../migrations/015_categories.sql"),
        include_str!("../migrations/016_afterpay_payments.sql"),
        include_str!("../migrations/017_settlements_and_audit.sql"),
        include_str!("../migrations/018_app_settings.sql"),
        include_str!("../migrations/019_expand_audit_log.sql"),
        include_str!("../migrations/020_allocate_fund_adjustments.sql"),
        include_str!("../migrations/021_recurring_schedule_revisions.sql"),
        include_str!("../migrations/022_complete_audit_log.sql"),
        include_str!("../migrations/023_dynamic_reference_data.sql"),
        include_str!("../migrations/024_stable_category_references.sql"),
    ];

    async fn migrated_test_pool() -> sqlx::SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("test database should open");
        sqlx::query("PRAGMA foreign_keys = ON")
            .execute(&pool)
            .await
            .expect("foreign keys should be enabled");
        for migration in ALL_MIGRATIONS {
            sqlx::raw_sql(migration)
                .execute(&pool)
                .await
                .expect("migration should apply to an empty database");
        }
        pool
    }

    #[test]
    fn sanitizes_attachment_file_names() {
        assert_eq!(
            sanitize_file_name("IKEA receipt 24/09.pdf"),
            "IKEA-receipt-24-09.pdf"
        );
    }

    #[test]
    fn creates_a_matching_attachment_bundle_path() {
        assert_eq!(
            attachment_bundle_path(Path::new("/tmp/housefund-backup.db")),
            Path::new("/tmp/housefund-backup-attachments"),
        );
    }

    #[tokio::test]
    async fn migrations_create_an_integral_database_from_scratch() {
        let pool = migrated_test_pool().await;
        let integrity: String = sqlx::query_scalar("PRAGMA integrity_check")
            .fetch_one(&pool)
            .await
            .expect("integrity check should run");
        let foreign_key_violations = sqlx::query("PRAGMA foreign_key_check")
            .fetch_all(&pool)
            .await
            .expect("foreign key check should run");
        let mismatched_purchases: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM (\
                SELECT p.id FROM purchases p \
                LEFT JOIN purchase_items i ON i.purchase_id = p.id \
                GROUP BY p.id \
                HAVING p.receipt_total_cents <> COALESCE(SUM(i.total_amount_cents), 0) + p.receipt_rounding_adjustment_cents\
            )",
        )
        .fetch_one(&pool)
        .await
        .expect("purchase totals should be auditable");
        let table_count: i64 = sqlx::query("SELECT COUNT(*) AS total FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
            .fetch_one(&pool)
            .await
            .expect("schema should be readable")
            .get("total");

        assert_eq!(integrity, "ok");
        assert!(foreign_key_violations.is_empty());
        assert_eq!(mismatched_purchases, 0);
        assert!(table_count >= 25);
        pool.close().await;
    }

    #[tokio::test]
    async fn database_transaction_rolls_back_every_statement_after_a_failure() {
        let pool = migrated_test_pool().await;
        let result = execute_statements_in_transaction(
            &pool,
            vec![
                TransactionStatement {
                    sql: "INSERT INTO people (id, name) VALUES (?, ?)".into(),
                    values: vec![json!("Temporary"), json!("Temporary person")],
                },
                TransactionStatement {
                    sql: "INSERT INTO settlement_group_members (settlement_group_id, person_id) VALUES (?, ?)".into(),
                    values: vec![json!("missing-group"), json!("Temporary")],
                },
            ],
        )
        .await;
        let temporary_people: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM people WHERE id = 'Temporary'")
                .fetch_one(&pool)
                .await
                .expect("rollback result should be readable");

        assert!(result.is_err());
        assert_eq!(temporary_people, 0);
        pool.close().await;
    }

    #[tokio::test]
    async fn financial_writes_create_an_audit_event() {
        let pool = migrated_test_pool().await;
        sqlx::query(
            "INSERT INTO purchases (id, purchase_date, merchant, receipt_total_cents, payment_source_id, receipt_item_count, items_are_consolidated, receipt_rounding_adjustment_cents, notes) VALUES ('audit-test', '2026-01-30', 'Audit test', 100, 'shared-cash', 0, 1, 0, NULL)",
        )
        .execute(&pool)
        .await
        .expect("audited purchase should insert");
        let audit_events: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM audit_log WHERE entity_type = 'purchase' AND entity_id = 'audit-test' AND action = 'create'",
        )
        .fetch_one(&pool)
        .await
        .expect("audit event should be readable");

        assert_eq!(audit_events, 1);
        pool.close().await;
    }

    #[tokio::test]
    async fn household_members_can_be_updated_and_archived() {
        let pool = migrated_test_pool().await;
        sqlx::query(
            "INSERT INTO people (id, name, weekly_contribution_cents, is_active) VALUES ('integration-member', 'Demo Member', 2500, 1)",
        )
        .execute(&pool)
        .await
        .expect("member should be created");

        sqlx::query("UPDATE people SET name = 'Updated Member', weekly_contribution_cents = 3000 WHERE id = 'integration-member'")
            .execute(&pool)
            .await
            .expect("member should be updated");
        sqlx::query("UPDATE people SET is_active = 0 WHERE id = 'integration-member'")
            .execute(&pool)
            .await
            .expect("member should be archived");

        let member: (String, i64, i64) = sqlx::query_as(
            "SELECT name, weekly_contribution_cents, is_active FROM people WHERE id = 'integration-member'",
        )
        .fetch_one(&pool)
        .await
        .expect("updated member should remain readable");

        assert_eq!(member, ("Updated Member".into(), 3000, 0));
        pool.close().await;
    }

    #[tokio::test]
    async fn member_with_history_is_preserved_instead_of_deleted() {
        let pool = migrated_test_pool().await;
        sqlx::query(
            "INSERT INTO people (id, name, weekly_contribution_cents, is_active) VALUES ('history-member', 'History Member', 0, 1)",
        )
        .execute(&pool)
        .await
        .expect("member should be created");
        sqlx::query(
            "INSERT INTO payment_sources (id, name, type, ownership, managed_by, opening_balance_cents) VALUES ('history-source', 'Demo Source', 'cash', 'household', 'household', 0)",
        )
        .execute(&pool)
        .await
        .expect("source should be created");
        sqlx::query(
            "INSERT INTO purchases (id, purchase_date, merchant, receipt_total_cents, payment_source_id, receipt_item_count, items_are_consolidated, receipt_rounding_adjustment_cents) VALUES ('history-purchase', '2026-01-01', 'Demo Merchant', 1000, 'history-source', 1, 0, 0)",
        )
        .execute(&pool)
        .await
        .expect("purchase should be created");
        sqlx::query(
            "INSERT INTO purchase_items (id, purchase_id, name, quantity, unit_price_cents, total_amount_cents, category, ownership) VALUES ('history-item', 'history-purchase', 'Demo Item', 1, 1000, 1000, 'General', 'personal')",
        )
        .execute(&pool)
        .await
        .expect("purchase item should be created");
        sqlx::query("INSERT INTO purchase_item_splits (purchase_item_id, person_id) VALUES ('history-item', 'history-member')")
            .execute(&pool)
            .await
            .expect("member history should be created");

        let usage_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM purchase_item_splits WHERE person_id = 'history-member'",
        )
        .fetch_one(&pool)
        .await
        .expect("member usage should be readable");
        assert!(usage_count > 0);

        let delete_result = sqlx::query("DELETE FROM people WHERE id = 'history-member'")
            .execute(&pool)
            .await;
        assert!(
            delete_result.is_err(),
            "foreign keys must protect historical member data"
        );

        let remaining: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM people WHERE id = 'history-member'")
                .fetch_one(&pool)
                .await
                .expect("member should remain readable after rejected deletion");
        assert_eq!(remaining, 1);
        pool.close().await;
    }

    #[tokio::test]
    async fn payment_source_used_by_a_purchase_cannot_be_deleted() {
        let pool = migrated_test_pool().await;
        sqlx::query(
            "INSERT INTO payment_sources (id, name, type, ownership, managed_by, opening_balance_cents) VALUES ('used-source', 'Used Source', 'bank-account', 'household', 'household', 0)",
        )
        .execute(&pool)
        .await
        .expect("source should be created");
        sqlx::query(
            "INSERT INTO purchases (id, purchase_date, merchant, receipt_total_cents, payment_source_id, receipt_item_count, items_are_consolidated, receipt_rounding_adjustment_cents) VALUES ('source-purchase', '2026-01-01', 'Demo Merchant', 500, 'used-source', 0, 1, 0)",
        )
        .execute(&pool)
        .await
        .expect("purchase should reference the source");

        let delete_result = sqlx::query("DELETE FROM payment_sources WHERE id = 'used-source'")
            .execute(&pool)
            .await;
        assert!(
            delete_result.is_err(),
            "foreign keys must protect a used payment source"
        );
        pool.close().await;
    }

    #[tokio::test]
    async fn settlement_group_save_rolls_back_when_a_member_is_invalid() {
        let pool = migrated_test_pool().await;
        let result = execute_statements_in_transaction(
            &pool,
            vec![
                TransactionStatement {
                    sql: "INSERT INTO settlement_groups (id, name) VALUES (?, ?)".into(),
                    values: vec![json!("rollback-group"), json!("Rollback Group")],
                },
                TransactionStatement {
                    sql: "INSERT INTO settlement_group_members (settlement_group_id, person_id) VALUES (?, ?)".into(),
                    values: vec![json!("rollback-group"), json!("missing-member")],
                },
            ],
        )
        .await;

        assert!(result.is_err());
        let group_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM settlement_groups WHERE id = 'rollback-group'",
        )
        .fetch_one(&pool)
        .await
        .expect("rollback result should be readable");
        let member_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM settlement_group_members WHERE settlement_group_id = 'rollback-group'")
            .fetch_one(&pool)
            .await
            .expect("rollback members should be readable");
        assert_eq!(group_count, 0);
        assert_eq!(member_count, 0);
        pool.close().await;
    }

    #[tokio::test]
    async fn category_used_by_a_purchase_is_preserved_after_rejected_delete() {
        let pool = migrated_test_pool().await;
        sqlx::query("INSERT INTO categories (id, name, is_active) VALUES ('used-category', 'Used Category', 1)")
            .execute(&pool)
            .await
            .expect("category should be created");
        sqlx::query(
            "INSERT INTO payment_sources (id, name, type, ownership, managed_by, opening_balance_cents) VALUES ('category-source', 'Category Source', 'cash', 'household', 'household', 0)",
        )
        .execute(&pool)
        .await
        .expect("source should be created");
        sqlx::query(
            "INSERT INTO purchases (id, purchase_date, merchant, receipt_total_cents, payment_source_id, receipt_item_count, items_are_consolidated, receipt_rounding_adjustment_cents) VALUES ('category-purchase', '2026-01-01', 'Demo Merchant', 700, 'category-source', 1, 0, 0)",
        )
        .execute(&pool)
        .await
        .expect("purchase should be created");
        sqlx::query(
            "INSERT INTO purchase_items (id, purchase_id, name, quantity, unit_price_cents, total_amount_cents, category, category_id, ownership) VALUES ('category-item', 'category-purchase', 'Demo Item', 1, 700, 700, 'Used Category', 'used-category', 'household')",
        )
        .execute(&pool)
        .await
        .expect("purchase category should be linked");

        let delete_result = sqlx::query("DELETE FROM categories WHERE id = 'used-category'")
            .execute(&pool)
            .await;
        assert!(
            delete_result.is_err(),
            "foreign keys must protect a used category"
        );
        let remaining: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM categories WHERE id = 'used-category'")
                .fetch_one(&pool)
                .await
                .expect("category should remain readable after rejected deletion");
        assert_eq!(remaining, 1);
        pool.close().await;
    }

    #[tokio::test]
    async fn complete_household_settlement_workflow_persists_every_stage() {
        let pool = migrated_test_pool().await;
        sqlx::query(
            "INSERT INTO people (id, name, weekly_contribution_cents, is_active) VALUES ('workflow-member-a', 'Demo Member A', 3000, 1), ('workflow-member-b', 'Demo Member B', 3000, 1)",
        )
        .execute(&pool)
        .await
        .expect("workflow members should be created");
        sqlx::query(
            "INSERT INTO payment_sources (id, name, type, ownership, managed_by, opening_balance_cents) VALUES ('workflow-source', 'Demo Shared Account', 'bank-account', 'household', 'household', 10000)",
        )
        .execute(&pool)
        .await
        .expect("workflow payment source should be created");
        sqlx::query("INSERT INTO settlement_groups (id, name) VALUES ('workflow-group-a', 'Group A'), ('workflow-group-b', 'Group B')")
            .execute(&pool)
            .await
            .expect("workflow groups should be created");
        sqlx::query(
            "INSERT INTO settlement_group_members (settlement_group_id, person_id) VALUES ('workflow-group-a', 'workflow-member-a'), ('workflow-group-b', 'workflow-member-b')",
        )
        .execute(&pool)
        .await
        .expect("workflow group memberships should be created");
        sqlx::query("INSERT INTO categories (id, name, is_active) VALUES ('workflow-category', 'Workflow Category', 1)")
            .execute(&pool)
            .await
            .expect("workflow category should be created");
        sqlx::query(
            "INSERT INTO purchases (id, purchase_date, merchant, receipt_total_cents, payment_source_id, receipt_item_count, items_are_consolidated, receipt_rounding_adjustment_cents) VALUES ('workflow-purchase', '2026-01-15', 'Demo Market', 2000, 'workflow-source', 1, 0, 0)",
        )
        .execute(&pool)
        .await
        .expect("workflow purchase should be recorded");
        sqlx::query(
            "INSERT INTO purchase_items (id, purchase_id, name, quantity, unit_price_cents, total_amount_cents, category, ownership, category_id) VALUES ('workflow-item', 'workflow-purchase', 'Shared groceries', 1, 2000, 2000, 'Workflow Category', 'household', 'workflow-category')",
        )
        .execute(&pool)
        .await
        .expect("workflow purchase item should be recorded");
        sqlx::query("INSERT INTO purchase_item_splits (purchase_item_id, person_id) VALUES ('workflow-item', 'workflow-member-a'), ('workflow-item', 'workflow-member-b')")
            .execute(&pool)
            .await
            .expect("workflow purchase split should be recorded");

        let workflow_result = execute_statements_in_transaction(
            &pool,
            vec![
                TransactionStatement {
                    sql: "INSERT INTO settlement_periods (id, period_start, period_end, status, closed_at, notes, created_at) VALUES (?, ?, ?, 'closed', ?, ?, ?)".into(),
                    values: vec![
                        json!("workflow-period"),
                        json!("2026-01-01"),
                        json!("2026-01-31"),
                        json!("2026-02-01T00:00:00Z"),
                        json!("Demo workflow settlement"),
                        json!("2026-02-01T00:00:00Z"),
                    ],
                },
                TransactionStatement {
                    sql: "INSERT INTO settlement_snapshot_transfers (id, settlement_period_id, from_group_id, to_group_id, amount_cents, settlement_kind) VALUES (?, ?, ?, ?, ?, ?)".into(),
                    values: vec![
                        json!("workflow-transfer"),
                        json!("workflow-period"),
                        json!("workflow-group-a"),
                        json!("workflow-group-b"),
                        json!(1000),
                        json!("overall"),
                    ],
                },
                TransactionStatement {
                    sql: "INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json) VALUES ('close-period', 'settlement-period', ?, ?, ?)".into(),
                    values: vec![
                        json!("workflow-period"),
                        json!("Settlement workflow completed"),
                        json!("{\"periodStart\":\"2026-01-01\",\"periodEnd\":\"2026-01-31\"}"),
                    ],
                },
            ],
        )
        .await;
        assert!(workflow_result.is_ok());

        let closed_period: (String, i64) = sqlx::query_as(
            "SELECT status, COUNT(*) OVER () FROM settlement_periods WHERE id = 'workflow-period'",
        )
        .fetch_one(&pool)
        .await
        .expect("closed settlement period should be readable");
        let snapshot_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM settlement_snapshot_transfers WHERE settlement_period_id = 'workflow-period'",
        )
        .fetch_one(&pool)
        .await
        .expect("settlement snapshot should be readable");
        let audit_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM audit_log WHERE entity_type = 'settlement-period' AND entity_id = 'workflow-period'",
        )
        .fetch_one(&pool)
        .await
        .expect("settlement audit event should be readable");

        assert_eq!(closed_period.0, "closed");
        assert_eq!(closed_period.1, 1);
        assert_eq!(snapshot_count, 1);
        assert_eq!(
            audit_count, 2,
            "creation and settlement closing should both be auditable"
        );
        pool.close().await;
    }

    #[tokio::test]
    async fn fund_adjustments_support_explicit_member_allocation() {
        let pool = migrated_test_pool().await;
        sqlx::query(
            "INSERT INTO fund_adjustments (id, fund_source_id, adjustment_date, amount_cents, direction, reason, allocation_kind, notes) VALUES ('allocated-adjustment', 'shared-cash', '2026-01-30', 3000, 'decrease', 'other', 'household-expense', 'Fictional allocated household expense')",
        )
        .execute(&pool)
        .await
        .expect("allocated adjustment should insert");
        sqlx::query(
            "INSERT INTO fund_adjustment_splits (fund_adjustment_id, person_id) VALUES ('allocated-adjustment', 'person-alex'), ('allocated-adjustment', 'person-jordan'), ('allocated-adjustment', 'person-sam')",
        )
        .execute(&pool)
        .await
        .expect("adjustment members should insert");

        let split_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM fund_adjustment_splits WHERE fund_adjustment_id = 'allocated-adjustment'",
        )
        .fetch_one(&pool)
        .await
        .expect("adjustment allocation should be readable");
        let audit_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM audit_log WHERE entity_type = 'adjustment' AND entity_id = 'allocated-adjustment'",
        )
        .fetch_one(&pool)
        .await
        .expect("adjustment audit should be readable");

        assert_eq!(split_count, 3);
        assert!(audit_count >= 4);
        pool.close().await;
    }

    #[tokio::test]
    async fn settlement_payment_and_reimbursement_roll_back_together() {
        let pool = migrated_test_pool().await;
        sqlx::query(
            "INSERT INTO settlement_periods (id, period_start, period_end, status, closed_at, notes, created_at) VALUES ('period-test', '2026-10-01', '2026-10-02', 'closed', '2026-10-02T00:00:00Z', NULL, '2026-10-02T00:00:00Z')",
        )
        .execute(&pool)
        .await
        .expect("settlement period should insert");

        let result = execute_statements_in_transaction(
            &pool,
            vec![
                TransactionStatement {
                    sql: "INSERT INTO reimbursements (id, reimbursement_date, from_person_id, to_person_id, amount_cents, payment_source_id, applies_to, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)".into(),
                    values: vec![json!("atomic-reimbursement"), json!("2026-01-02"), json!("person-sam"), json!("person-alex"), json!(1000), json!("sam-pay-later"), json!("immediate"), json!(null)],
                },
                TransactionStatement {
                    sql: "INSERT INTO settlement_payments (id, settlement_period_id, reimbursement_id, created_at) VALUES (?, ?, ?, ?)".into(),
                    values: vec![json!("atomic-link"), json!("missing-period"), json!("atomic-reimbursement"), json!("2026-10-02T00:00:00Z")],
                },
            ],
        )
        .await;
        let reimbursement_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM reimbursements WHERE id = 'atomic-reimbursement'",
        )
        .fetch_one(&pool)
        .await
        .expect("rollback result should be readable");

        assert!(result.is_err());
        assert_eq!(reimbursement_count, 0);
        pool.close().await;
    }

    #[tokio::test]
    async fn restores_database_and_managed_attachments_end_to_end() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("housefund-restore-test-{unique}"));
        let app_data = root.join("app-data");
        let backup = root.join("backup.db");
        let active = app_data.join("housefund.db");
        fs::create_dir_all(attachment_bundle_path(&backup))
            .expect("backup attachment folder should exist");
        fs::create_dir_all(app_data.join("attachments"))
            .expect("active attachment folder should exist");

        let options = sqlx::sqlite::SqliteConnectOptions::new()
            .filename(&backup)
            .create_if_missing(true);
        let backup_pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(options)
            .await
            .expect("backup database should open");
        for migration in ALL_MIGRATIONS {
            sqlx::raw_sql(migration)
                .execute(&backup_pool)
                .await
                .expect("migration should apply to backup");
        }
        sqlx::query("INSERT INTO purchases (id, purchase_date, merchant, receipt_total_cents, payment_source_id, receipt_item_count, items_are_consolidated, receipt_rounding_adjustment_cents, notes) VALUES ('restored-purchase', '2026-01-30', 'Restore test', 100, 'shared-cash', 0, 1, 0, NULL)")
            .execute(&backup_pool).await.expect("backup purchase should insert");
        backup_pool.close().await;
        fs::write(
            attachment_bundle_path(&backup).join("receipt.pdf"),
            b"restored receipt",
        )
        .expect("backup attachment should write");
        fs::write(&active, b"obsolete database").expect("active database should write");
        fs::write(app_data.join("attachments/old.txt"), b"obsolete attachment")
            .expect("old attachment should write");

        restore_backup_files(&backup, &active, &app_data).expect("restore should succeed");
        let restored_pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect(&format!("sqlite:{}", active.display()))
            .await
            .expect("restored database should open");
        let restored: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM purchases WHERE id = 'restored-purchase'")
                .fetch_one(&restored_pool)
                .await
                .expect("restored data should be readable");
        restored_pool.close().await;

        assert_eq!(restored, 1);
        assert_eq!(
            fs::read(app_data.join("attachments/receipt.pdf")).unwrap(),
            b"restored receipt"
        );
        assert!(active.with_extension("db.before-restore").is_file());
        let _ = fs::remove_dir_all(root);
    }
}

pub(crate) fn restore_backup_files(
    source: &Path,
    target: &Path,
    app_data_directory: &Path,
) -> Result<(), String> {
    let source_attachments = attachment_bundle_path(source);
    let temporary = target.with_extension("db.restore-temp");
    let recovery = target.with_extension("db.before-restore");
    let target_attachments = app_data_directory.join("attachments");
    let temporary_attachments = app_data_directory.join("attachments.restore-temp");
    let recovery_attachments = app_data_directory.join("attachments.before-restore");
    fs::copy(&source, &temporary).map_err(|error| error.to_string())?;
    if temporary_attachments.exists() {
        fs::remove_dir_all(&temporary_attachments).map_err(|error| error.to_string())?;
    }
    if source_attachments.is_dir() {
        copy_directory(&source_attachments, &temporary_attachments)?;
    }
    if recovery.exists() {
        fs::remove_file(&recovery).map_err(|error| error.to_string())?;
    }
    if target.exists() {
        fs::copy(&target, &recovery).map_err(|error| error.to_string())?;
    }
    fs::rename(&temporary, &target).map_err(|error| error.to_string())?;
    if recovery_attachments.exists() {
        fs::remove_dir_all(&recovery_attachments).map_err(|error| error.to_string())?;
    }
    if target_attachments.exists() {
        fs::rename(&target_attachments, &recovery_attachments)
            .map_err(|error| error.to_string())?;
    }
    if temporary_attachments.exists() {
        fs::rename(&temporary_attachments, &target_attachments)
            .map_err(|error| error.to_string())?;
    }
    for sidecar_extension in ["db-wal", "db-shm"] {
        let sidecar = target.with_extension(sidecar_extension);
        if sidecar.exists() {
            let _ = fs::remove_file(sidecar);
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_core_tables",
            sql: include_str!("../migrations/001_core.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_purchase_tables",
            sql: include_str!("../migrations/002_purchases.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create_financial_movement_tables",
            sql: include_str!("../migrations/003_financial_movements.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "create_recurring_and_installment_tables",
            sql: include_str!("../migrations/004_recurring_and_installments.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "create_attachment_table",
            sql: include_str!("../migrations/005_attachments.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "seed_reference_data",
            sql: include_str!("../migrations/006_seed_reference_data.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "seed_purchases",
            sql: include_str!("../migrations/007_seed_purchases.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "seed_financial_movements",
            sql: include_str!("../migrations/008_seed_financial_movements.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "seed_recurring_and_installments",
            sql: include_str!("../migrations/009_seed_recurring_and_installments.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "schedule_rent_through_2026",
            sql: include_str!("../migrations/010_schedule_rent_through_2026.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "extend_rent_to_contract_end",
            sql: include_str!("../migrations/011_extend_rent_to_contract_end.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "add_financial_movement_cancellations",
            sql: include_str!("../migrations/012_financial_movement_cancellations.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "seed_2026_09_23_24_activity",
            sql: include_str!("../migrations/013_seed_2026_09_23_24_activity.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 14,
            description: "create_recurring_contribution_occurrences",
            sql: include_str!("../migrations/014_recurring_contribution_occurrences.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 15,
            description: "create_categories",
            sql: include_str!("../migrations/015_categories.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 16,
            description: "create_afterpay_payments",
            sql: include_str!("../migrations/016_afterpay_payments.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 17,
            description: "create_settlements_and_audit",
            sql: include_str!("../migrations/017_settlements_and_audit.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 18,
            description: "create_app_settings",
            sql: include_str!("../migrations/018_app_settings.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 19,
            description: "expand_audit_log",
            sql: include_str!("../migrations/019_expand_audit_log.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 20,
            description: "allocate_fund_adjustments",
            sql: include_str!("../migrations/020_allocate_fund_adjustments.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 21,
            description: "support_recurring_schedule_revisions",
            sql: include_str!("../migrations/021_recurring_schedule_revisions.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 22,
            description: "complete_audit_log",
            sql: include_str!("../migrations/022_complete_audit_log.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 23,
            description: "add_dynamic_reference_data",
            sql: include_str!("../migrations/023_dynamic_reference_data.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 24,
            description: "add_stable_category_references",
            sql: include_str!("../migrations/024_stable_category_references.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            execute_database_transaction,
            create_database_backup,
            create_automatic_backup,
            write_export_file,
            restore_database_backup,
            migrate_legacy_attachments,
        ])
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:housefund.db", migrations)
                .build(),
        )
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
