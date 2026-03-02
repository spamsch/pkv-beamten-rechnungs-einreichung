CREATE TABLE IF NOT EXISTS persons (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    beihilfe_percent REAL NOT NULL,
    debeka_percent REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO persons (id, name, beihilfe_percent, debeka_percent)
VALUES
    ('johanna', 'Johanna', 0.7, 0.3),
    ('thore', 'Thore', 0.8, 0.2),
    ('isabella', 'Isabella', 0.8, 0.2);

CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id TEXT NOT NULL REFERENCES persons(id),
    arzt TEXT NOT NULL DEFAULT '',
    datum TEXT,
    zahlbar_bis TEXT,
    rechnungs_nummer TEXT NOT NULL DEFAULT '',
    betrag REAL NOT NULL DEFAULT 0.0,
    mahngebuehr REAL NOT NULL DEFAULT 0.0,
    beihilfe_eingereicht TEXT,
    debeka_eingereicht TEXT,
    beihilfe_zu_bezahlen REAL NOT NULL DEFAULT 0.0,
    debeka_zu_bezahlen REAL NOT NULL DEFAULT 0.0,
    beihilfe_bezahlt REAL NOT NULL DEFAULT 0.0,
    debeka_bezahlt REAL NOT NULL DEFAULT 0.0,
    zu_ueberweisen REAL NOT NULL DEFAULT 0.0,
    ueberwiesen_datum TEXT,
    differenz REAL NOT NULL DEFAULT 0.0,
    is_final INTEGER NOT NULL DEFAULT 0,
    paperless_doc_id INTEGER,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_person_id ON invoices(person_id);
CREATE INDEX IF NOT EXISTS idx_invoices_is_final ON invoices(is_final);
CREATE INDEX IF NOT EXISTS idx_invoices_datum ON invoices(datum);
