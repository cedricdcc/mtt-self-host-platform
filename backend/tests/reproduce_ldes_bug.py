# backend/tests/reproduce_ldes_bug.py
import os
import sys
import sqlite3
import shutil
from pathlib import Path
from datetime import datetime

# Adjust path to find backend/src/services
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../src/services')))

import ldes

def setup_test_db(db_path):
    if os.path.exists(db_path):
        os.remove(db_path)
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    # Create simple tables matching schema for our test
    cursor.execute("""
    CREATE TABLE sources (
        source_id INTEGER PRIMARY KEY,
        source_path TEXT,
        source_type TEXT
    );
    """)
    cursor.execute("""
    CREATE TABLE terms (
        id INTEGER PRIMARY KEY,
        uri TEXT,
        source_id INTEGER
    );
    """)
    cursor.execute("""
    CREATE TABLE term_fields (
        id INTEGER PRIMARY KEY,
        term_id INTEGER,
        field_uri TEXT,
        original_value TEXT,
        field_roles TEXT
    );
    """)
    cursor.execute("""
    CREATE TABLE translations (
        id INTEGER PRIMARY KEY,
        term_field_id INTEGER,
        language TEXT,
        value TEXT,
        status TEXT,
        created_at DATETIME,
        updated_at DATETIME,
        modified_at DATETIME
    );
    """)
    
    # Insert source, term, field, and translation
    cursor.execute("INSERT INTO sources (source_id, source_path, source_type) VALUES (1, 'https://example.com/vocab.ttl', 'LDES')")
    cursor.execute("INSERT INTO terms (id, uri, source_id) VALUES (10, 'http://example.com/term10', 1)")
    cursor.execute("INSERT INTO term_fields (id, term_id, field_uri, original_value, field_roles) VALUES (20, 10, 'http://www.w3.org/2004/02/skos/core#prefLabel', 'Original', '[\"label\",\"translatable\"]')")
    
    # Translation approved in the past (back-dated to 2026-03-20)
    cursor.execute("""
    INSERT INTO translations (id, term_field_id, language, value, status, created_at, updated_at)
    VALUES (30, 20, 'nl', 'Vertaling', 'approved', '2026-03-20 12:00:00', '2026-03-20 12:00:00')
    """)
    
    conn.commit()
    conn.close()

def run_test():
    test_dir = Path(__file__).parent / "test_ldes_temp"
    if test_dir.exists():
        shutil.rmtree(test_dir)
    test_dir.mkdir(parents=True, exist_ok=True)
    
    os.environ['LDES_BASE_DIR'] = str(test_dir)
    db_path = str(test_dir / "test.db")
    setup_test_db(db_path)
    
    # Create an existing fragment in the LDES directory that is newer than March 2026 (e.g. June 28, 2026)
    # Filename: epoch 1782488827 -> June 28, 2026
    source_ldes_dir = test_dir / "1"
    source_ldes_dir.mkdir(parents=True, exist_ok=True)
    
    latest_file = source_ldes_dir / "latest.ttl"
    with open(latest_file, "w") as f:
        f.write("""
        @prefix dcterms: <http://purl.org/dc/terms/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        <http://example.com/term9>
            dcterms:modified "2026-06-28T00:00:00Z"^^xsd:dateTime .
        """)
        
    fragment_file = source_ldes_dir / "1782488827.ttl"
    shutil.copy2(latest_file, fragment_file)
    
    print("Running create_or_update_ldes...")
    result = ldes.create_or_update_ldes(1, db_path)
    print("Result:", result)
    
    # We expect this translation to NOT be skipped (meaning status should be success)
    assert result['status'] == 'success', f"Expected success but got: {result['status']}"
    print("✓ Reproduction test passed! Backdated translations successfully processed.")
    
    if test_dir.exists():
        shutil.rmtree(test_dir)

if __name__ == "__main__":
    try:
        run_test()
    except Exception as e:
        print("Test failed as expected or due to error:", e)
        sys.exit(1)
