use std::collections::HashMap;

use reqwest::blocking::Client;
use serde::Deserialize;

use crate::error::AppError;
use crate::models::{PaperlessDocument, PaperlessTag};

pub struct PaperlessClient {
    base_url: String,
    token: String,
    client: Client,
}

#[derive(Deserialize)]
struct PaginatedResponse<T> {
    results: Vec<T>,
    next: Option<String>,
}

#[derive(Deserialize)]
struct ApiTag {
    id: i64,
    name: String,
}

#[derive(Deserialize)]
struct ApiDocument {
    id: i64,
    title: String,
    correspondent: Option<i64>,
    #[serde(default)]
    tags: Vec<i64>,
    #[serde(default)]
    custom_fields: Vec<ApiCustomField>,
    created: String,
}

#[derive(Deserialize)]
struct ApiCustomField {
    field: i64,
    value: Option<serde_json::Value>,
}

#[derive(Deserialize)]
struct ApiCorrespondent {
    id: i64,
    name: String,
}

#[derive(Deserialize)]
struct ApiCustomFieldDefinition {
    id: i64,
    name: String,
}

impl PaperlessClient {
    pub fn new(base_url: &str, token: &str) -> Self {
        let base_url = base_url.trim_end_matches('/').to_string();
        Self {
            base_url,
            token: token.to_string(),
            client: Client::new(),
        }
    }

    fn get<T: serde::de::DeserializeOwned>(&self, url: &str) -> Result<T, AppError> {
        let resp = self
            .client
            .get(url)
            .header("Authorization", format!("Token {}", self.token))
            .send()
            .map_err(|e| AppError::Paperless(format!("Request failed: {}", e)))?;

        if !resp.status().is_success() {
            return Err(AppError::Paperless(format!(
                "API returned status {}",
                resp.status()
            )));
        }

        resp.json::<T>()
            .map_err(|e| AppError::Paperless(format!("Failed to parse response: {}", e)))
    }

    pub fn get_tags(&self) -> Result<Vec<PaperlessTag>, AppError> {
        let url = format!("{}/api/tags/?page_size=9999", self.base_url);
        let resp: PaginatedResponse<ApiTag> = self.get(&url)?;
        Ok(resp
            .results
            .into_iter()
            .map(|t| PaperlessTag {
                id: t.id,
                name: t.name,
            })
            .collect())
    }

    pub fn get_correspondents(&self) -> Result<HashMap<i64, String>, AppError> {
        let url = format!("{}/api/correspondents/?page_size=9999", self.base_url);
        let resp: PaginatedResponse<ApiCorrespondent> = self.get(&url)?;
        Ok(resp.results.into_iter().map(|c| (c.id, c.name)).collect())
    }

    fn get_custom_field_id_for_betrag(&self) -> Result<Option<i64>, AppError> {
        let url = format!("{}/api/custom_fields/?page_size=9999", self.base_url);
        let resp: PaginatedResponse<ApiCustomFieldDefinition> = self.get(&url)?;
        Ok(resp
            .results
            .into_iter()
            .find(|f| f.name.eq_ignore_ascii_case("Betrag"))
            .map(|f| f.id))
    }

    pub fn get_documents(
        &self,
        tag_ids: &[i64],
    ) -> Result<Vec<PaperlessDocument>, AppError> {
        let correspondents = self.get_correspondents()?;
        let betrag_field_id = self.get_custom_field_id_for_betrag()?;

        let mut all_docs = Vec::new();
        let tag_csv: String = tag_ids
            .iter()
            .map(|id| id.to_string())
            .collect::<Vec<_>>()
            .join(",");

        let mut url = format!(
            "{}/api/documents/?tags__id__all={}&page_size=100",
            self.base_url, tag_csv
        );

        loop {
            let resp: PaginatedResponse<ApiDocument> = self.get(&url)?;
            for doc in resp.results {
                let correspondent_name = doc
                    .correspondent
                    .and_then(|cid| correspondents.get(&cid).cloned());

                let betrag = betrag_field_id.and_then(|fid| {
                    doc.custom_fields
                        .iter()
                        .find(|cf| cf.field == fid)
                        .and_then(|cf| cf.value.as_ref())
                        .and_then(|v| parse_betrag(v))
                });

                all_docs.push(PaperlessDocument {
                    id: doc.id,
                    title: doc.title,
                    correspondent_name,
                    betrag,
                    created: doc.created,
                    tag_ids: doc.tags,
                    already_imported: false,
                });
            }

            match resp.next {
                Some(next_url) => url = next_url,
                None => break,
            }
        }

        Ok(all_docs)
    }
}

fn parse_betrag(value: &serde_json::Value) -> Option<f64> {
    match value {
        serde_json::Value::Number(n) => n.as_f64(),
        serde_json::Value::String(s) => {
            let cleaned = s
                .trim()
                .trim_start_matches("EUR")
                .trim_start_matches("€")
                .trim()
                .replace(',', ".");
            cleaned.parse::<f64>().ok()
        }
        _ => None,
    }
}
