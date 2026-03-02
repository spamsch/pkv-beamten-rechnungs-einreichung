use calamine::{open_workbook, Data, Reader, Xlsx};
use std::collections::HashMap;

use crate::db::AppDb;
use crate::error::AppError;
use crate::models::{ImportResult, InvoiceInput};

pub fn import_excel(db: &AppDb, file_path: &str) -> Result<ImportResult, AppError> {
    let mut workbook: Xlsx<_> =
        open_workbook(file_path).map_err(|e| AppError::Import(format!("Cannot open file: {}", e)))?;

    let sheet_name = workbook
        .sheet_names()
        .first()
        .cloned()
        .ok_or_else(|| AppError::Import("No sheets found in workbook".into()))?;

    let range = workbook
        .worksheet_range(&sheet_name)
        .map_err(|e| AppError::Import(format!("Cannot read sheet: {}", e)))?;

    let mut rows = range.rows();
    let header_row = rows
        .next()
        .ok_or_else(|| AppError::Import("Empty spreadsheet".into()))?;

    // Build header index mapping, stripping parenthetical suffixes like "(Datum)" or "(Summe)"
    let headers: HashMap<String, usize> = header_row
        .iter()
        .enumerate()
        .filter_map(|(i, cell)| {
            let raw = cell.to_string().trim().to_lowercase();
            if raw.is_empty() {
                None
            } else {
                // Strip trailing parenthetical like " (datum)", " (summe)"
                let name = if let Some(idx) = raw.find('(') {
                    raw[..idx].trim().to_string()
                } else {
                    raw
                };
                Some((name, i))
            }
        })
        .collect();

    let mut imported: i64 = 0;
    let mut errors: Vec<String> = Vec::new();

    for (row_idx, row) in rows.enumerate() {
        let row_num = row_idx + 2; // 1-indexed + header

        match parse_row(&headers, row, row_num) {
            Ok(input) => match db.create_invoice(&input) {
                Ok(_) => imported += 1,
                Err(e) => errors.push(format!("Row {}: Insert error: {}", row_num, e)),
            },
            Err(e) => errors.push(e),
        }
    }

    Ok(ImportResult { imported, errors })
}

fn parse_row(
    headers: &HashMap<String, usize>,
    row: &[Data],
    row_num: usize,
) -> Result<InvoiceInput, String> {
    let get_str = |key: &str| -> Option<String> {
        headers.get(key).and_then(|&i| {
            row.get(i).and_then(|cell| {
                let s = cell.to_string().trim().to_string();
                if s.is_empty() || s == "NULL" {
                    None
                } else {
                    Some(s)
                }
            })
        })
    };

    let get_f64 = |key: &str| -> Option<f64> {
        headers.get(key).and_then(|&i| {
            row.get(i).and_then(|cell| match cell {
                Data::Float(f) => Some(*f),
                Data::Int(n) => Some(*n as f64),
                Data::String(s) => s.trim().replace(',', ".").parse::<f64>().ok(),
                _ => None,
            })
        })
    };

    let get_date = |key: &str| -> Option<String> {
        headers.get(key).and_then(|&i| {
            row.get(i).and_then(|cell| match cell {
                Data::DateTime(dt) => dt
                    .as_datetime()
                    .map(|d| d.format("%Y-%m-%d").to_string()),
                Data::DateTimeIso(s) => {
                    // Take just the date part
                    Some(s.split('T').next().unwrap_or(s).to_string())
                }
                Data::Float(f) => excel_serial_to_iso(*f),
                Data::String(s) => parse_date_string(s.trim()),
                _ => None,
            })
        })
    };

    // Determine person from "Prozent" column
    let prozent = get_f64("prozent");
    let person_id = match prozent {
        Some(p) if (p - 0.7).abs() < 0.01 => "johanna".to_string(),
        Some(p) if (p - 0.8).abs() < 0.01 => "thore".to_string(),
        Some(p) => {
            return Err(format!(
                "Row {}: Unknown Prozent value: {}",
                row_num, p
            ))
        }
        None => {
            // Try to get person by name
            let name = get_str("name").or_else(|| get_str("person"));
            match name.as_deref() {
                Some(n) if n.to_lowercase().contains("johanna") => "johanna".to_string(),
                Some(n) if n.to_lowercase().contains("thore") => "thore".to_string(),
                Some(n) if n.to_lowercase().contains("isabella") => "isabella".to_string(),
                _ => return Err(format!("Row {}: Cannot determine person", row_num)),
            }
        }
    };

    let betrag = get_f64("betrag").or_else(|| get_f64("rechnungsbetrag"));
    if betrag.is_none() || betrag == Some(0.0) {
        return Err(format!("Row {}: No betrag, skipping", row_num));
    }

    Ok(InvoiceInput {
        person_id,
        arzt: get_str("arzt").or_else(|| get_str("doctor")).or_else(|| get_str("behandler")),
        datum: get_date("datum").or_else(|| get_date("rechnungsdatum")),
        zahlbar_bis: get_date("zahlbar bis").or_else(|| get_date("zahlbar_bis")).or_else(|| get_date("fällig")),
        rechnungs_nummer: get_str("rechnungs-nummer")
            .or_else(|| get_str("rechnungsnummer"))
            .or_else(|| get_str("rechnungs_nummer"))
            .or_else(|| get_str("rechnungs nummer"))
            .or_else(|| get_str("re-nr")),
        betrag,
        mahngebuehr: get_f64("mahngebühr").or_else(|| get_f64("mahngebuehr")).or_else(|| get_f64("mahngebühr")),
        beihilfe_eingereicht: get_date("beihilfe eingereicht").or_else(|| get_date("beihilfe_eingereicht")),
        debeka_eingereicht: get_date("debeka eingereicht").or_else(|| get_date("debeka_eingereicht")),
        beihilfe_bezahlt: get_f64("beihilfe bezahlt").or_else(|| get_f64("beihilfe_bezahlt")),
        debeka_bezahlt: get_f64("debeka bezahlt").or_else(|| get_f64("debeka_bezahlt")),
        ueberwiesen_datum: get_date("überwiesen")
            .or_else(|| get_date("ueberwiesen"))
            .or_else(|| get_date("überwiesen datum"))
            .or_else(|| get_date("ueberwiesen_datum")),
        is_final: get_str("abgeschlossen")
            .or_else(|| get_str("final"))
            .map(|s| s == "1" || s.to_lowercase() == "ja" || s.to_lowercase() == "true" || s.to_lowercase() == "x"),
        paperless_doc_id: get_f64("paperless").or_else(|| get_f64("paperless_doc_id")).map(|f| f as i64),
        notes: get_str("notizen").or_else(|| get_str("notes")).or_else(|| get_str("bemerkung")),
    })
}

/// Convert Excel serial date number to ISO 8601 string
fn excel_serial_to_iso(serial: f64) -> Option<String> {
    if serial < 1.0 {
        return None;
    }
    let days = serial as i64 - 25569; // days since Unix epoch
    let secs = days * 86400;
    let dt = chrono::DateTime::from_timestamp(secs, 0)?;
    Some(dt.format("%Y-%m-%d").to_string())
}

/// Try to parse various German date formats
fn parse_date_string(s: &str) -> Option<String> {
    if s.is_empty() {
        return None;
    }
    if let Ok(d) = chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d") {
        return Some(d.format("%Y-%m-%d").to_string());
    }
    if let Ok(d) = chrono::NaiveDate::parse_from_str(s, "%d.%m.%Y") {
        return Some(d.format("%Y-%m-%d").to_string());
    }
    if let Ok(d) = chrono::NaiveDate::parse_from_str(s, "%d.%m.%y") {
        return Some(d.format("%Y-%m-%d").to_string());
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_excel_serial_to_iso() {
        assert_eq!(excel_serial_to_iso(45292.0), Some("2024-01-01".to_string()));
    }

    #[test]
    fn test_parse_date_german() {
        assert_eq!(
            parse_date_string("15.03.2024"),
            Some("2024-03-15".to_string())
        );
    }

    #[test]
    fn test_parse_date_iso() {
        assert_eq!(
            parse_date_string("2024-03-15"),
            Some("2024-03-15".to_string())
        );
    }

    #[test]
    fn test_parse_date_empty() {
        assert_eq!(parse_date_string(""), None);
    }
}
