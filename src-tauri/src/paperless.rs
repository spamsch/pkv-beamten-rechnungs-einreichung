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

    fn patch_json(
        &self,
        url: &str,
        body: &serde_json::Value,
    ) -> Result<(), AppError> {
        let resp = self
            .client
            .patch(url)
            .header("Authorization", format!("Token {}", self.token))
            .json(body)
            .send()
            .map_err(|e| AppError::Paperless(format!("PATCH request failed: {}", e)))?;

        if !resp.status().is_success() {
            return Err(AppError::Paperless(format!(
                "PATCH returned status {}",
                resp.status()
            )));
        }
        Ok(())
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

    /// Remove a specific tag from a Paperless document.
    pub fn remove_tag_from_document(&self, doc_id: i64, tag_id: i64) -> Result<(), AppError> {
        // First get the document's current tags
        let url = format!("{}/api/documents/{}/", self.base_url, doc_id);
        let doc: ApiDocument = self.get(&url)?;
        let new_tags: Vec<i64> = doc.tags.into_iter().filter(|&t| t != tag_id).collect();
        let body = serde_json::json!({ "tags": new_tags });
        self.patch_json(&url, &body)
    }

    /// Download a document's original file from Paperless and save it to the given directory.
    /// Returns the path of the saved file.
    pub fn download_document(&self, doc_id: i64, dest_dir: &std::path::Path) -> Result<std::path::PathBuf, AppError> {
        let url = format!("{}/api/documents/{}/download/", self.base_url, doc_id);
        let resp = self
            .client
            .get(&url)
            .header("Authorization", format!("Token {}", self.token))
            .send()
            .map_err(|e| AppError::Paperless(format!("Download request failed: {}", e)))?;

        if !resp.status().is_success() {
            return Err(AppError::Paperless(format!(
                "Download returned status {}",
                resp.status()
            )));
        }

        // Derive filename from Content-Disposition header or fall back to doc_id.pdf
        let filename = resp
            .headers()
            .get("content-disposition")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| parse_content_disposition_filename(v))
            .unwrap_or_else(|| format!("paperless-{}.pdf", doc_id));

        // macOS has a 255-byte filename limit; truncate the stem if needed
        let filename = truncate_filename(&filename, 255);

        let dest_path = dest_dir.join(&filename);
        let bytes = resp
            .bytes()
            .map_err(|e| AppError::Paperless(format!("Failed to read download body: {}", e)))?;

        std::fs::write(&dest_path, &bytes)
            .map_err(|e| AppError::Paperless(format!("Failed to write file {}: {}", dest_path.display(), e)))?;

        // Compress PDF via Ghostscript; keep original if compression fails
        if let Err(e) = compress_pdf(&dest_path) {
            log::warn!("PDF compression failed for {}, keeping original: {}", dest_path.display(), e);
        }

        Ok(dest_path)
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

/// Extract the filename from a Content-Disposition header value.
/// Handles both `filename="..."` and `filename*=utf-8''...` (RFC 5987).
fn parse_content_disposition_filename(header: &str) -> Option<String> {
    // Prefer filename*= (RFC 5987, percent-encoded UTF-8) over plain filename=
    if let Some(pos) = header.find("filename*=") {
        let rest = &header[pos + "filename*=".len()..];
        // Format: utf-8''percent-encoded-name
        if let Some(tick_pos) = rest.find("''") {
            let encoded = rest[tick_pos + 2..].split(';').next().unwrap_or("").trim();
            if let Ok(decoded) = urlencoding::decode(encoded) {
                let name = decoded.trim_matches('"').to_string();
                if !name.is_empty() {
                    return Some(name);
                }
            }
        }
    }

    // Fall back to plain filename=
    for part in header.split(';') {
        let part = part.trim();
        if let Some(rest) = part.strip_prefix("filename=") {
            let name = rest.trim_matches('"').trim_matches('\'').to_string();
            // Stop at any semicolon that was already split
            if !name.is_empty() {
                return Some(name);
            }
        }
    }

    None
}

/// Truncate a filename to fit within `max_bytes`, preserving the extension.
fn truncate_filename(filename: &str, max_bytes: usize) -> String {
    if filename.len() <= max_bytes {
        return filename.to_string();
    }

    let path = std::path::Path::new(filename);
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("pdf");
    let dot_ext = format!(".{}", ext); // e.g. ".pdf"
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(filename);

    // Truncate the stem on a char boundary so we stay under max_bytes
    let budget = max_bytes - dot_ext.len();
    let truncated: String = stem.chars().take_while({
        let mut len = 0usize;
        move |c| {
            len += c.len_utf8();
            len <= budget
        }
    }).collect();

    format!("{}{}", truncated, dot_ext)
}

const ONE_MB: u64 = 1_024 * 1_024;

/// Compress a PDF in-place using Ghostscript.
/// Tries `/ebook` first, then `/screen` if the result is still over 1 MB.
fn compress_pdf(path: &std::path::Path) -> Result<(), AppError> {
    run_gs(path, "/ebook")?;

    let size = std::fs::metadata(path)
        .map(|m| m.len())
        .unwrap_or(0);
    if size > ONE_MB {
        run_gs(path, "/screen")?;
    }

    Ok(())
}

fn run_gs(path: &std::path::Path, pdf_settings: &str) -> Result<(), AppError> {
    let tmp_path = std::env::temp_dir().join(format!("gs_compress_{}.pdf", std::process::id()));

    let output = std::process::Command::new("/opt/homebrew/bin/gs")
        .args([
            "-sDEVICE=pdfwrite",
            "-dCompatibilityLevel=1.4",
            &format!("-dPDFSETTINGS={}", pdf_settings),
            "-dNOPAUSE",
            "-dQUIET",
            "-dBATCH",
        ])
        .arg(format!("-sOutputFile={}", tmp_path.display()))
        .arg(path)
        .output()
        .map_err(|e| AppError::Paperless(format!("Failed to run Ghostscript: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let _ = std::fs::remove_file(&tmp_path);
        let detail = if stderr.trim().is_empty() { stdout.trim().to_string() } else { stderr.trim().to_string() };
        return Err(AppError::Paperless(format!(
            "Ghostscript failed ({}): {}",
            pdf_settings, detail
        )));
    }

    // Replace original with compressed version
    std::fs::rename(&tmp_path, path).or_else(|_| {
        std::fs::copy(&tmp_path, path)
            .and_then(|_| std::fs::remove_file(&tmp_path))
            .map_err(|e| AppError::Paperless(format!("Failed to replace with compressed PDF: {}", e)))
    })?;

    Ok(())
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
