use rusqlite::{params, Connection, OptionalExtension};
use std::sync::Mutex;

use crate::error::AppError;
use crate::models::*;

pub struct AppDb {
    pub conn: Mutex<Connection>,
}

impl AppDb {
    pub fn new(db_path: &str) -> Result<Self, AppError> {
        let conn = Connection::open(db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn run_migrations(&self) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        let m1 = include_str!("../migrations/001_initial.sql");
        conn.execute_batch(m1)?;
        let m2 = include_str!("../migrations/002_settings.sql");
        conn.execute_batch(m2)?;
        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>, AppError> {
        let conn = self.conn.lock().unwrap();
        let result = conn
            .query_row(
                "SELECT value FROM settings WHERE key = ?1",
                params![key],
                |row| row.get(0),
            )
            .optional()?;
        Ok(result)
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn get_imported_paperless_ids(&self) -> Result<std::collections::HashSet<i64>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT paperless_doc_id FROM invoices WHERE paperless_doc_id IS NOT NULL",
        )?;
        let ids = stmt
            .query_map([], |row| row.get::<_, i64>(0))?
            .collect::<Result<std::collections::HashSet<_>, _>>()?;
        Ok(ids)
    }

    pub fn get_persons(&self) -> Result<Vec<Person>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, beihilfe_percent, debeka_percent FROM persons ORDER BY name")?;
        let persons = stmt
            .query_map([], |row| {
                Ok(Person {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    beihilfe_percent: row.get(2)?,
                    debeka_percent: row.get(3)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(persons)
    }

    pub fn get_person(&self, id: &str) -> Result<Person, AppError> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT id, name, beihilfe_percent, debeka_percent FROM persons WHERE id = ?1",
            params![id],
            |row| {
                Ok(Person {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    beihilfe_percent: row.get(2)?,
                    debeka_percent: row.get(3)?,
                })
            },
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound(format!("Person '{}' not found", id)))
    }

    fn row_to_invoice(row: &rusqlite::Row) -> rusqlite::Result<Invoice> {
        Ok(Invoice {
            id: row.get(0)?,
            person_id: row.get(1)?,
            arzt: row.get(2)?,
            datum: row.get(3)?,
            zahlbar_bis: row.get(4)?,
            rechnungs_nummer: row.get(5)?,
            betrag: row.get(6)?,
            mahngebuehr: row.get(7)?,
            beihilfe_eingereicht: row.get(8)?,
            debeka_eingereicht: row.get(9)?,
            beihilfe_zu_bezahlen: row.get(10)?,
            debeka_zu_bezahlen: row.get(11)?,
            beihilfe_bezahlt: row.get(12)?,
            debeka_bezahlt: row.get(13)?,
            zu_ueberweisen: row.get(14)?,
            ueberwiesen_datum: row.get(15)?,
            differenz: row.get(16)?,
            is_final: row.get::<_, i32>(17)? != 0,
            paperless_doc_id: row.get(18)?,
            notes: row.get(19)?,
            created_at: row.get(20)?,
            updated_at: row.get(21)?,
        })
    }

    pub fn get_invoices(&self, filter: &InvoiceFilter) -> Result<Vec<Invoice>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut sql = String::from(
            "SELECT id, person_id, arzt, datum, zahlbar_bis, rechnungs_nummer, \
             betrag, mahngebuehr, beihilfe_eingereicht, debeka_eingereicht, \
             beihilfe_zu_bezahlen, debeka_zu_bezahlen, beihilfe_bezahlt, debeka_bezahlt, \
             zu_ueberweisen, ueberwiesen_datum, differenz, is_final, \
             paperless_doc_id, notes, created_at, updated_at \
             FROM invoices WHERE 1=1",
        );
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(ref person_id) = filter.person_id {
            sql.push_str(&format!(" AND person_id = ?{}", param_values.len() + 1));
            param_values.push(Box::new(person_id.clone()));
        }

        if let Some(ref search) = filter.search {
            if !search.is_empty() {
                let like = format!("%{}%", search);
                let idx = param_values.len() + 1;
                sql.push_str(&format!(
                    " AND (arzt LIKE ?{idx} OR rechnungs_nummer LIKE ?{idx} OR notes LIKE ?{idx})"
                ));
                param_values.push(Box::new(like));
            }
        }

        if filter.hide_final.unwrap_or(false) {
            sql.push_str(" AND is_final = 0");
        }

        if let Some(ref status) = filter.status {
            match status.as_str() {
                "neu" => sql.push_str(
                    " AND beihilfe_eingereicht IS NULL AND debeka_eingereicht IS NULL AND is_final = 0",
                ),
                "teilweise_eingereicht" => sql.push_str(
                    " AND ((beihilfe_eingereicht IS NOT NULL AND debeka_eingereicht IS NULL) \
                     OR (beihilfe_eingereicht IS NULL AND debeka_eingereicht IS NOT NULL)) AND is_final = 0",
                ),
                "eingereicht" => sql.push_str(
                    " AND beihilfe_eingereicht IS NOT NULL AND debeka_eingereicht IS NOT NULL \
                     AND (beihilfe_bezahlt = 0 OR debeka_bezahlt = 0) AND is_final = 0",
                ),
                "teilweise_bezahlt" => sql.push_str(
                    " AND ((beihilfe_bezahlt > 0 AND debeka_bezahlt = 0) \
                     OR (beihilfe_bezahlt = 0 AND debeka_bezahlt > 0)) AND is_final = 0",
                ),
                "bezahlt" => sql.push_str(
                    " AND beihilfe_bezahlt > 0 AND debeka_bezahlt > 0 \
                     AND ueberwiesen_datum IS NULL AND is_final = 0",
                ),
                "ueberwiesen" => sql.push_str(
                    " AND ueberwiesen_datum IS NOT NULL AND is_final = 0",
                ),
                "abgeschlossen" => sql.push_str(" AND is_final = 1"),
                "ueberfaellig" => {
                    sql.push_str(
                        " AND zahlbar_bis IS NOT NULL AND zahlbar_bis < date('now') AND is_final = 0",
                    );
                }
                _ => {}
            }
        }

        let sort_by = filter
            .sort_by
            .as_deref()
            .unwrap_or("datum");
        let sort_dir = filter
            .sort_dir
            .as_deref()
            .unwrap_or("DESC");
        let sort_dir = if sort_dir.eq_ignore_ascii_case("ASC") {
            "ASC"
        } else {
            "DESC"
        };

        let allowed_columns = [
            "id", "person_id", "arzt", "datum", "zahlbar_bis", "rechnungs_nummer",
            "betrag", "mahngebuehr", "beihilfe_eingereicht", "debeka_eingereicht",
            "beihilfe_zu_bezahlen", "debeka_zu_bezahlen", "beihilfe_bezahlt",
            "debeka_bezahlt", "zu_ueberweisen", "ueberwiesen_datum", "differenz",
            "is_final", "created_at", "updated_at",
        ];
        let sort_col = if allowed_columns.contains(&sort_by) {
            sort_by
        } else {
            "datum"
        };

        sql.push_str(&format!(" ORDER BY {} {}", sort_col, sort_dir));

        let params_refs: Vec<&dyn rusqlite::types::ToSql> =
            param_values.iter().map(|p| p.as_ref()).collect();
        let mut stmt = conn.prepare(&sql)?;
        let invoices = stmt
            .query_map(params_refs.as_slice(), Self::row_to_invoice)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(invoices)
    }

    pub fn get_invoice(&self, id: i64) -> Result<Invoice, AppError> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT id, person_id, arzt, datum, zahlbar_bis, rechnungs_nummer, \
             betrag, mahngebuehr, beihilfe_eingereicht, debeka_eingereicht, \
             beihilfe_zu_bezahlen, debeka_zu_bezahlen, beihilfe_bezahlt, debeka_bezahlt, \
             zu_ueberweisen, ueberwiesen_datum, differenz, is_final, \
             paperless_doc_id, notes, created_at, updated_at \
             FROM invoices WHERE id = ?1",
            params![id],
            Self::row_to_invoice,
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound(format!("Invoice {} not found", id)))
    }

    pub fn create_invoice(&self, input: &InvoiceInput) -> Result<Invoice, AppError> {
        let person = self.get_person(&input.person_id)?;
        let betrag = input.betrag.unwrap_or(0.0);
        let mahngebuehr = input.mahngebuehr.unwrap_or(0.0);
        let beihilfe_bezahlt = input.beihilfe_bezahlt.unwrap_or(0.0);
        let debeka_bezahlt = input.debeka_bezahlt.unwrap_or(0.0);

        let computed = compute_derived_fields(
            betrag,
            mahngebuehr,
            person.beihilfe_percent,
            person.debeka_percent,
            beihilfe_bezahlt,
            debeka_bezahlt,
        );

        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO invoices (person_id, arzt, datum, zahlbar_bis, rechnungs_nummer, \
             betrag, mahngebuehr, beihilfe_eingereicht, debeka_eingereicht, \
             beihilfe_zu_bezahlen, debeka_zu_bezahlen, beihilfe_bezahlt, debeka_bezahlt, \
             zu_ueberweisen, ueberwiesen_datum, differenz, is_final, \
             paperless_doc_id, notes, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, datetime('now'))",
            params![
                input.person_id,
                input.arzt.as_deref().unwrap_or(""),
                input.datum,
                input.zahlbar_bis,
                input.rechnungs_nummer.as_deref().unwrap_or(""),
                betrag,
                mahngebuehr,
                input.beihilfe_eingereicht,
                input.debeka_eingereicht,
                computed.beihilfe_zu_bezahlen,
                computed.debeka_zu_bezahlen,
                beihilfe_bezahlt,
                debeka_bezahlt,
                computed.zu_ueberweisen,
                input.ueberwiesen_datum,
                computed.differenz,
                input.is_final.unwrap_or(false) as i32,
                input.paperless_doc_id,
                input.notes.as_deref().unwrap_or(""),
            ],
        )?;

        let id = conn.last_insert_rowid();
        drop(conn);
        self.get_invoice(id)
    }

    pub fn update_invoice(&self, id: i64, input: &InvoiceInput) -> Result<Invoice, AppError> {
        let _existing = self.get_invoice(id)?;
        let person = self.get_person(&input.person_id)?;

        let betrag = input.betrag.unwrap_or(0.0);
        let mahngebuehr = input.mahngebuehr.unwrap_or(0.0);
        let beihilfe_bezahlt = input.beihilfe_bezahlt.unwrap_or(0.0);
        let debeka_bezahlt = input.debeka_bezahlt.unwrap_or(0.0);

        let computed = compute_derived_fields(
            betrag,
            mahngebuehr,
            person.beihilfe_percent,
            person.debeka_percent,
            beihilfe_bezahlt,
            debeka_bezahlt,
        );

        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE invoices SET person_id = ?1, arzt = ?2, datum = ?3, zahlbar_bis = ?4, \
             rechnungs_nummer = ?5, betrag = ?6, mahngebuehr = ?7, \
             beihilfe_eingereicht = ?8, debeka_eingereicht = ?9, \
             beihilfe_zu_bezahlen = ?10, debeka_zu_bezahlen = ?11, \
             beihilfe_bezahlt = ?12, debeka_bezahlt = ?13, \
             zu_ueberweisen = ?14, ueberwiesen_datum = ?15, \
             differenz = ?16, is_final = ?17, paperless_doc_id = ?18, notes = ?19, \
             updated_at = datetime('now') \
             WHERE id = ?20",
            params![
                input.person_id,
                input.arzt.as_deref().unwrap_or(""),
                input.datum,
                input.zahlbar_bis,
                input.rechnungs_nummer.as_deref().unwrap_or(""),
                betrag,
                mahngebuehr,
                input.beihilfe_eingereicht,
                input.debeka_eingereicht,
                computed.beihilfe_zu_bezahlen,
                computed.debeka_zu_bezahlen,
                beihilfe_bezahlt,
                debeka_bezahlt,
                computed.zu_ueberweisen,
                input.ueberwiesen_datum,
                computed.differenz,
                input.is_final.unwrap_or(false) as i32,
                input.paperless_doc_id,
                input.notes.as_deref().unwrap_or(""),
                id,
            ],
        )?;
        drop(conn);
        self.get_invoice(id)
    }

    pub fn delete_invoice(&self, id: i64) -> Result<(), AppError> {
        let conn = self.conn.lock().unwrap();
        let affected = conn.execute("DELETE FROM invoices WHERE id = ?1", params![id])?;
        if affected == 0 {
            return Err(AppError::NotFound(format!("Invoice {} not found", id)));
        }
        Ok(())
    }

    pub fn delete_all_invoices(&self) -> Result<i64, AppError> {
        let conn = self.conn.lock().unwrap();
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM invoices", [], |row| row.get(0))?;
        conn.execute("DELETE FROM invoices", [])?;
        Ok(count)
    }

    pub fn batch_update_status(&self, input: &BatchUpdateInput) -> Result<Vec<Invoice>, AppError> {
        let allowed_fields = [
            "beihilfe_eingereicht",
            "debeka_eingereicht",
            "ueberwiesen_datum",
            "is_final",
        ];
        if !allowed_fields.contains(&input.field.as_str()) {
            return Err(AppError::Validation(format!(
                "Field '{}' is not allowed for batch update",
                input.field
            )));
        }

        let conn = self.conn.lock().unwrap();
        for id in &input.ids {
            let sql = format!(
                "UPDATE invoices SET {} = ?1, updated_at = datetime('now') WHERE id = ?2",
                input.field
            );
            conn.execute(&sql, params![input.value, id])?;
        }
        drop(conn);

        // Recompute derived fields for affected invoices
        for id in &input.ids {
            let invoice = self.get_invoice(*id)?;
            let person = self.get_person(&invoice.person_id)?;
            let computed = compute_derived_fields(
                invoice.betrag,
                invoice.mahngebuehr,
                person.beihilfe_percent,
                person.debeka_percent,
                invoice.beihilfe_bezahlt,
                invoice.debeka_bezahlt,
            );
            let conn = self.conn.lock().unwrap();
            conn.execute(
                "UPDATE invoices SET beihilfe_zu_bezahlen = ?1, debeka_zu_bezahlen = ?2, \
                 zu_ueberweisen = ?3, differenz = ?4 WHERE id = ?5",
                params![
                    computed.beihilfe_zu_bezahlen,
                    computed.debeka_zu_bezahlen,
                    computed.zu_ueberweisen,
                    computed.differenz,
                    id,
                ],
            )?;
        }

        let mut result = Vec::new();
        for id in &input.ids {
            result.push(self.get_invoice(*id)?);
        }
        Ok(result)
    }

    pub fn batch_mark_eingereicht(&self, ids: &[i64], date: &str) -> Result<Vec<Invoice>, AppError> {
        let conn = self.conn.lock().unwrap();
        for id in ids {
            conn.execute(
                "UPDATE invoices SET \
                 beihilfe_eingereicht = COALESCE(beihilfe_eingereicht, ?1), \
                 debeka_eingereicht = COALESCE(debeka_eingereicht, ?1), \
                 updated_at = datetime('now') \
                 WHERE id = ?2",
                params![date, id],
            )?;
        }
        drop(conn);

        let mut result = Vec::new();
        for id in ids {
            result.push(self.get_invoice(*id)?);
        }
        Ok(result)
    }

    pub fn get_dashboard_stats(&self) -> Result<DashboardStats, AppError> {
        let conn = self.conn.lock().unwrap();

        let total_invoices: i64 =
            conn.query_row("SELECT COUNT(*) FROM invoices", [], |row| row.get(0))?;

        let open_invoices: i64 = conn.query_row(
            "SELECT COUNT(*) FROM invoices WHERE is_final = 0",
            [],
            |row| row.get(0),
        )?;

        let overdue_invoices: i64 = conn.query_row(
            "SELECT COUNT(*) FROM invoices WHERE zahlbar_bis IS NOT NULL AND zahlbar_bis < date('now') AND is_final = 0",
            [],
            |row| row.get(0),
        )?;

        let pending_submission: i64 = conn.query_row(
            "SELECT COUNT(*) FROM invoices WHERE (beihilfe_eingereicht IS NULL OR debeka_eingereicht IS NULL) AND is_final = 0",
            [],
            |row| row.get(0),
        )?;

        let pending_wire: i64 = conn.query_row(
            "SELECT COUNT(*) FROM invoices WHERE beihilfe_bezahlt > 0 AND debeka_bezahlt > 0 AND ueberwiesen_datum IS NULL AND is_final = 0",
            [],
            |row| row.get(0),
        )?;

        let total_open_amount: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM(zu_ueberweisen), 0) FROM invoices WHERE is_final = 0",
                [],
                |row| row.get(0),
            )?;

        let total_differenz: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM(differenz), 0) FROM invoices WHERE is_final = 0",
                [],
                |row| row.get(0),
            )?;

        let mut stmt = conn.prepare(
            "SELECT p.id, p.name, COUNT(i.id), COALESCE(SUM(i.betrag), 0), \
             COUNT(CASE WHEN i.is_final = 0 THEN 1 END), \
             COALESCE(SUM(CASE WHEN i.is_final = 0 THEN i.beihilfe_zu_bezahlen - i.beihilfe_bezahlt ELSE 0 END), 0), \
             COALESCE(SUM(CASE WHEN i.is_final = 0 THEN i.debeka_zu_bezahlen - i.debeka_bezahlt ELSE 0 END), 0), \
             COALESCE(SUM(CASE WHEN i.is_final = 0 AND i.ueberwiesen_datum IS NULL THEN i.zu_ueberweisen ELSE 0 END), 0) \
             FROM persons p LEFT JOIN invoices i ON p.id = i.person_id \
             GROUP BY p.id, p.name ORDER BY p.name",
        )?;
        let per_person = stmt
            .query_map([], |row| {
                Ok(PersonStats {
                    person_id: row.get(0)?,
                    person_name: row.get(1)?,
                    count: row.get(2)?,
                    total_betrag: row.get(3)?,
                    open_count: row.get(4)?,
                    beihilfe_offen: row.get(5)?,
                    debeka_offen: row.get(6)?,
                    zu_ueberweisen: row.get(7)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        let total_beihilfe_offen: f64 = per_person.iter().map(|p| p.beihilfe_offen).sum();
        let total_debeka_offen: f64 = per_person.iter().map(|p| p.debeka_offen).sum();
        let total_zu_ueberweisen: f64 = per_person.iter().map(|p| p.zu_ueberweisen).sum();

        Ok(DashboardStats {
            total_invoices,
            open_invoices,
            overdue_invoices,
            pending_submission,
            pending_wire,
            total_open_amount,
            total_differenz,
            total_beihilfe_offen,
            total_debeka_offen,
            total_zu_ueberweisen,
            per_person,
        })
    }
}
