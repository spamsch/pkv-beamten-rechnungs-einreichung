mod commands;
mod db;
mod error;
mod import;
mod models;
mod paperless;

use tauri::Manager;

use db::AppDb;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Resolve the app data directory for the database
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_dir).expect("Failed to create app data dir");

            let db_path = app_dir.join("pkv-tracking.db");
            let db = AppDb::new(db_path.to_str().unwrap())
                .expect("Failed to open database");
            db.run_migrations().expect("Failed to run migrations");

            app.manage(db);

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_persons,
            commands::get_invoices,
            commands::get_invoice,
            commands::create_invoice,
            commands::update_invoice,
            commands::delete_invoice,
            commands::delete_all_invoices,
            commands::batch_update_status,
            commands::batch_mark_eingereicht,
            commands::get_dashboard_stats,
            commands::import_excel,
            commands::get_settings,
            commands::save_settings,
            commands::paperless_get_tags,
            commands::paperless_get_documents,
            commands::paperless_import_documents,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
