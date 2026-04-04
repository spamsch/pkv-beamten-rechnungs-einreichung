use tauri::{Emitter, State};

use crate::db::AppDb;
use crate::error::AppError;
use crate::import;
use crate::models::*;
use crate::paperless::PaperlessClient;

#[tauri::command]
pub fn get_persons(db: State<'_, AppDb>) -> Result<Vec<Person>, AppError> {
    db.get_persons()
}

#[tauri::command]
pub fn get_invoices(db: State<'_, AppDb>, filter: InvoiceFilter) -> Result<Vec<Invoice>, AppError> {
    db.get_invoices(&filter)
}

#[tauri::command]
pub fn get_invoice(db: State<'_, AppDb>, id: i64) -> Result<Invoice, AppError> {
    db.get_invoice(id)
}

#[tauri::command]
pub fn create_invoice(db: State<'_, AppDb>, input: InvoiceInput) -> Result<Invoice, AppError> {
    db.create_invoice(&input)
}

#[tauri::command]
pub fn update_invoice(
    db: State<'_, AppDb>,
    id: i64,
    input: InvoiceInput,
) -> Result<Invoice, AppError> {
    db.update_invoice(id, &input)
}

#[tauri::command]
pub fn delete_invoice(db: State<'_, AppDb>, id: i64) -> Result<(), AppError> {
    db.delete_invoice(id)
}

#[tauri::command]
pub fn batch_update_status(
    db: State<'_, AppDb>,
    input: BatchUpdateInput,
) -> Result<Vec<Invoice>, AppError> {
    db.batch_update_status(&input)
}

#[tauri::command]
pub fn batch_mark_bezahlt(
    db: State<'_, AppDb>,
    ids: Vec<i64>,
    source: String,
) -> Result<Vec<Invoice>, AppError> {
    db.batch_mark_bezahlt(&ids, &source)
}

#[tauri::command]
pub fn batch_mark_eingereicht(
    db: State<'_, AppDb>,
    ids: Vec<i64>,
    date: String,
) -> Result<Vec<Invoice>, AppError> {
    let result = db.batch_mark_eingereicht(&ids, &date)?;

    // Try to remove "WF: Einreichen" tag from linked Paperless documents
    if let Ok(client) = build_paperless_client(&db) {
        if let Ok(tags) = client.get_tags() {
            if let Some(wf_tag) = tags.iter().find(|t| t.name == "WF: Einreichen") {
                let tag_id = wf_tag.id;
                if let Ok(doc_ids) = db.get_paperless_doc_ids_for_invoices(&ids) {
                    for doc_id in doc_ids {
                        let _ = client.remove_tag_from_document(doc_id, tag_id);
                    }
                }
            }
        }
    }

    Ok(result)
}

#[tauri::command]
pub fn get_dashboard_stats(db: State<'_, AppDb>) -> Result<DashboardStats, AppError> {
    db.get_dashboard_stats()
}

#[tauri::command]
pub fn delete_all_invoices(db: State<'_, AppDb>) -> Result<i64, AppError> {
    db.delete_all_invoices()
}

#[tauri::command]
pub fn import_excel(db: State<'_, AppDb>, file_path: String) -> Result<ImportResult, AppError> {
    import::import_excel(&db, &file_path)
}

#[tauri::command]
pub fn get_settings(db: State<'_, AppDb>) -> Result<Settings, AppError> {
    Ok(Settings {
        paperless_url: db.get_setting("paperless_url")?.unwrap_or_default(),
        paperless_token: db.get_setting("paperless_token")?.unwrap_or_default(),
    })
}

#[tauri::command]
pub fn save_settings(db: State<'_, AppDb>, settings: Settings) -> Result<(), AppError> {
    db.set_setting("paperless_url", &settings.paperless_url)?;
    db.set_setting("paperless_token", &settings.paperless_token)?;
    Ok(())
}

#[tauri::command]
pub fn get_notes(db: State<'_, AppDb>) -> Result<String, AppError> {
    Ok(db.get_setting("general_notes")?.unwrap_or_default())
}

#[tauri::command]
pub fn save_notes(db: State<'_, AppDb>, content: String) -> Result<(), AppError> {
    db.set_setting("general_notes", &content)
}

fn build_paperless_client(db: &AppDb) -> Result<PaperlessClient, AppError> {
    let url = db
        .get_setting("paperless_url")?
        .unwrap_or_default();
    let token = db
        .get_setting("paperless_token")?
        .unwrap_or_default();
    if url.is_empty() || token.is_empty() {
        return Err(AppError::Validation(
            "Paperless URL and token must be configured in settings".into(),
        ));
    }
    Ok(PaperlessClient::new(&url, &token))
}

#[tauri::command]
pub fn paperless_download_invoices(
    app: tauri::AppHandle,
    db: State<'_, AppDb>,
    ids: Vec<i64>,
) -> Result<PaperlessDownloadResult, AppError> {
    let client = build_paperless_client(&db)?;
    let doc_ids = db.get_paperless_doc_ids_for_invoices(&ids)?;

    if doc_ids.is_empty() {
        return Err(AppError::Validation(
            "Keine der ausgewählten Rechnungen hat ein verknüpftes Paperless-Dokument".into(),
        ));
    }

    let downloads_dir = dirs::download_dir().ok_or_else(|| {
        AppError::Validation("Downloads-Ordner konnte nicht ermittelt werden".into())
    })?;

    let total = doc_ids.len() as i64;
    let mut downloaded = 0i64;
    let mut errors = Vec::new();

    for (i, doc_id) in doc_ids.iter().enumerate() {
        let _ = app.emit("download-progress", serde_json::json!({
            "current": i + 1,
            "total": total,
            "doc_id": doc_id,
            "phase": "downloading",
        }));

        match client.download_document(*doc_id, &downloads_dir) {
            Ok(_) => downloaded += 1,
            Err(e) => errors.push(format!("Dokument #{}: {}", doc_id, e)),
        }
    }

    Ok(PaperlessDownloadResult { downloaded, errors })
}

#[tauri::command]
pub fn paperless_get_tags(db: State<'_, AppDb>) -> Result<Vec<PaperlessTag>, AppError> {
    let client = build_paperless_client(&db)?;
    client.get_tags()
}

#[tauri::command]
pub fn paperless_get_documents(
    db: State<'_, AppDb>,
    tag_ids: Vec<i64>,
) -> Result<Vec<PaperlessDocument>, AppError> {
    let client = build_paperless_client(&db)?;
    let imported_ids = db.get_imported_paperless_ids()?;
    let mut docs = client.get_documents(&tag_ids)?;
    for doc in &mut docs {
        doc.already_imported = imported_ids.contains(&doc.id);
    }
    Ok(docs)
}

#[tauri::command]
pub fn paperless_import_documents(
    db: State<'_, AppDb>,
    document_ids: Vec<i64>,
    tag_ids: Vec<i64>,
) -> Result<PaperlessImportResult, AppError> {
    let client = build_paperless_client(&db)?;
    let all_docs = client.get_documents(&tag_ids)?;
    let all_tags = client.get_tags()?;
    let persons = db.get_persons()?;

    // Build tag id → name map
    let tag_map: std::collections::HashMap<i64, String> =
        all_tags.into_iter().map(|t| (t.id, t.name)).collect();

    let person_patterns: Vec<(&str, &str)> = vec![
        ("johanna", "johanna"),
        ("thore", "thore"),
        ("isabella", "isabella"),
    ];

    let mut imported = 0i64;
    let mut errors = Vec::new();

    for doc in &all_docs {
        if !document_ids.contains(&doc.id) {
            continue;
        }

        // Determine person from this document's own tags
        let mut person_id_opt: Option<String> = None;
        for &doc_tag_id in &doc.tag_ids {
            if let Some(tname) = tag_map.get(&doc_tag_id) {
                let lower = tname.to_lowercase();
                for &(pid, pattern) in &person_patterns {
                    if lower.contains(pattern) {
                        person_id_opt = Some(pid.to_string());
                        break;
                    }
                }
                if person_id_opt.is_some() {
                    break;
                }
            }
        }

        let person_id = match person_id_opt {
            Some(pid) => pid,
            None => {
                errors.push(format!(
                    "Doc #{} ({}): Konnte Person nicht aus Tags bestimmen",
                    doc.id, doc.title
                ));
                continue;
            }
        };

        // Verify person exists
        let person = match persons.iter().find(|p| p.id == person_id) {
            Some(p) => p,
            None => {
                errors.push(format!("Doc #{}: Person '{}' nicht gefunden", doc.id, person_id));
                continue;
            }
        };

        let betrag = doc.betrag.unwrap_or(0.0);
        if betrag == 0.0 {
            errors.push(format!(
                "Doc #{} ({}): Betrag ist 0 oder fehlt",
                doc.id, doc.title
            ));
            continue;
        }

        let input = InvoiceInput {
            person_id: person.id.clone(),
            arzt: doc.correspondent_name.clone(),
            datum: Some(doc.created.chars().take(10).collect()),
            zahlbar_bis: None,
            rechnungs_nummer: None,
            betrag: Some(betrag),
            mahngebuehr: None,
            beihilfe_eingereicht: None,
            debeka_eingereicht: None,
            beihilfe_bezahlt: None,
            debeka_bezahlt: None,
            ueberwiesen_datum: None,
            is_final: None,
            paperless_doc_id: Some(doc.id),
            notes: None,
        };

        match db.create_invoice(&input) {
            Ok(_) => imported += 1,
            Err(e) => errors.push(format!("Doc #{}: {}", doc.id, e)),
        }
    }

    Ok(PaperlessImportResult { imported, errors })
}
