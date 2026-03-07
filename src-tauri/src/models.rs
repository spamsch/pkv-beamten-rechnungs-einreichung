use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Person {
    pub id: String,
    pub name: String,
    pub beihilfe_percent: f64,
    pub debeka_percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Invoice {
    pub id: i64,
    pub person_id: String,
    pub arzt: String,
    pub datum: Option<String>,
    pub zahlbar_bis: Option<String>,
    pub rechnungs_nummer: String,
    pub betrag: f64,
    pub mahngebuehr: f64,
    pub beihilfe_eingereicht: Option<String>,
    pub debeka_eingereicht: Option<String>,
    pub beihilfe_zu_bezahlen: f64,
    pub debeka_zu_bezahlen: f64,
    pub beihilfe_bezahlt: f64,
    pub debeka_bezahlt: f64,
    pub zu_ueberweisen: f64,
    pub ueberwiesen_datum: Option<String>,
    pub differenz: f64,
    pub is_final: bool,
    pub paperless_doc_id: Option<i64>,
    pub notes: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceInput {
    pub person_id: String,
    pub arzt: Option<String>,
    pub datum: Option<String>,
    pub zahlbar_bis: Option<String>,
    pub rechnungs_nummer: Option<String>,
    pub betrag: Option<f64>,
    pub mahngebuehr: Option<f64>,
    pub beihilfe_eingereicht: Option<String>,
    pub debeka_eingereicht: Option<String>,
    pub beihilfe_bezahlt: Option<f64>,
    pub debeka_bezahlt: Option<f64>,
    pub ueberwiesen_datum: Option<String>,
    pub is_final: Option<bool>,
    pub paperless_doc_id: Option<i64>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceFilter {
    pub person_id: Option<String>,
    pub status: Option<String>,
    pub search: Option<String>,
    pub sort_by: Option<String>,
    pub sort_dir: Option<String>,
    pub hide_final: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchUpdateInput {
    pub ids: Vec<i64>,
    pub field: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardStats {
    pub total_invoices: i64,
    pub open_invoices: i64,
    pub overdue_invoices: i64,
    pub pending_submission: i64,
    pub pending_wire: i64,
    pub total_open_amount: f64,
    pub total_differenz: f64,
    pub total_beihilfe_offen: f64,
    pub total_debeka_offen: f64,
    pub total_zu_ueberweisen: f64,
    pub per_person: Vec<PersonStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonStats {
    pub person_id: String,
    pub person_name: String,
    pub count: i64,
    pub total_betrag: f64,
    pub open_count: i64,
    pub beihilfe_offen: f64,
    pub debeka_offen: f64,
    pub zu_ueberweisen: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub imported: i64,
    pub errors: Vec<String>,
}

// --- Paperless types ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub paperless_url: String,
    pub paperless_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaperlessTag {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaperlessDocument {
    pub id: i64,
    pub title: String,
    pub correspondent_name: Option<String>,
    pub betrag: Option<f64>,
    pub created: String,
    pub tag_ids: Vec<i64>,
    pub already_imported: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaperlessImportResult {
    pub imported: i64,
    pub errors: Vec<String>,
}

/// Computed fields based on person percentages and invoice amounts
pub struct ComputedFields {
    pub beihilfe_zu_bezahlen: f64,
    pub debeka_zu_bezahlen: f64,
    pub zu_ueberweisen: f64,
    pub differenz: f64,
}

pub fn compute_derived_fields(
    betrag: f64,
    mahngebuehr: f64,
    beihilfe_percent: f64,
    debeka_percent: f64,
    beihilfe_bezahlt: f64,
    debeka_bezahlt: f64,
) -> ComputedFields {
    let beihilfe_zu_bezahlen = (betrag * beihilfe_percent * 100.0).round() / 100.0;
    let debeka_zu_bezahlen = (betrag * debeka_percent * 100.0).round() / 100.0;
    let zu_ueberweisen = ((betrag + mahngebuehr) * 100.0).round() / 100.0;
    let differenz =
        ((beihilfe_bezahlt + debeka_bezahlt - zu_ueberweisen) * 100.0).round() / 100.0;

    ComputedFields {
        beihilfe_zu_bezahlen,
        debeka_zu_bezahlen,
        zu_ueberweisen,
        differenz,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_derived_johanna() {
        let result = compute_derived_fields(100.0, 0.0, 0.7, 0.3, 0.0, 0.0);
        assert_eq!(result.beihilfe_zu_bezahlen, 70.0);
        assert_eq!(result.debeka_zu_bezahlen, 30.0);
        assert_eq!(result.zu_ueberweisen, 100.0);
        assert_eq!(result.differenz, -100.0);
    }

    #[test]
    fn test_compute_derived_kids() {
        let result = compute_derived_fields(100.0, 0.0, 0.8, 0.2, 0.0, 0.0);
        assert_eq!(result.beihilfe_zu_bezahlen, 80.0);
        assert_eq!(result.debeka_zu_bezahlen, 20.0);
        assert_eq!(result.zu_ueberweisen, 100.0);
        assert_eq!(result.differenz, -100.0);
    }

    #[test]
    fn test_compute_with_mahngebuehr() {
        let result = compute_derived_fields(100.0, 5.0, 0.7, 0.3, 0.0, 0.0);
        assert_eq!(result.beihilfe_zu_bezahlen, 70.0);
        assert_eq!(result.debeka_zu_bezahlen, 30.0);
        assert_eq!(result.zu_ueberweisen, 105.0);
        assert_eq!(result.differenz, -105.0);
    }

    #[test]
    fn test_compute_fully_paid() {
        let result = compute_derived_fields(100.0, 0.0, 0.7, 0.3, 70.0, 30.0);
        assert_eq!(result.beihilfe_zu_bezahlen, 70.0);
        assert_eq!(result.debeka_zu_bezahlen, 30.0);
        assert_eq!(result.zu_ueberweisen, 100.0);
        assert_eq!(result.differenz, 0.0);
    }

    #[test]
    fn test_compute_partial_payment() {
        let result = compute_derived_fields(100.0, 0.0, 0.7, 0.3, 70.0, 0.0);
        assert_eq!(result.differenz, -30.0);
    }

    #[test]
    fn test_rounding() {
        let result = compute_derived_fields(33.33, 0.0, 0.7, 0.3, 0.0, 0.0);
        assert_eq!(result.beihilfe_zu_bezahlen, 23.33);
        assert_eq!(result.debeka_zu_bezahlen, 10.0);
    }
}
