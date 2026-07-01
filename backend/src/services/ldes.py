#!/usr/bin/env python3
"""
LDES (Linked Data Event Stream) service for generating and updating LDES feeds.
This service implements LDES creation and updating for all sources using py-sema.
"""

import sys
import sqlite3
import os
import json
import shutil
import requests
from io import StringIO
from datetime import datetime, timedelta
from pathlib import Path
from sema.subyt import (
    JinjaBasedGenerator,
    SinkFactory,
    SourceFactory,
    GeneratorSettings,
)
from rdflib import Graph, Namespace, URIRef, Literal
from rdflib.namespace import RDF, DCTERMS, XSD

# LDES and TREE namespaces
LDES = Namespace("https://w3id.org/ldes#")
TREE = Namespace("https://w3id.org/tree#")
SKOS = Namespace("http://www.w3.org/2004/02/skos/core#")


def parse_datetime(value):
    """
    Parse database/LDES datetime values into a Python datetime.

    Args:
        value: Datetime value as datetime, string, or None.

    Returns:
        datetime | None: Parsed datetime value or None when input is None.
    """
    if isinstance(value, datetime):
        return value
    if value is None:
        return None
    normalized = str(value).strip()
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"
    return datetime.fromisoformat(normalized)


def get_ldes_directory(source_id):
    """
    Get the LDES directory path for a given source.
    
    Args:
        source_id: Source identifier
        
    Returns:
        Path object for the LDES directory
    """
    # Use environment variable or default to /data/LDES relative to project root
    ldes_base = os.environ.get('LDES_BASE_DIR')
    if ldes_base:
        base_dir = Path(ldes_base)
    else:
        # Default: find data/LDES relative to this script's location
        # This script is in backend/src/services, so go up 3 levels to project root
        project_root = Path(__file__).parent.parent.parent.parent
        base_dir = project_root / "data" / "LDES"
    
    ldes_dir = base_dir / str(source_id)
    return ldes_dir


def detect_existing_ldes(source_id):
    """
    Check if an LDES feed already exists for the source.
    
    Args:
        source_id: Source identifier
        
    Returns:
        tuple: (exists: bool, latest_file: Path or None)
    """
    ldes_dir = get_ldes_directory(source_id)
    
    if not ldes_dir.exists():
        return False, None
    
    latest_file = ldes_dir / "latest.ttl"
    
    if latest_file.exists():
        return True, latest_file
    
    # Check for any .ttl files (fragments)
    ttl_files = list(ldes_dir.glob("*.ttl"))
    if ttl_files:
        return True, None
    
    return False, None




def get_latest_modified_from_fragment(fragment_path):
    """
    Parse an LDES fragment and find the latest dcterms:modified date.
    
    Args:
        fragment_path: Path to the fragment file
        
    Returns:
        datetime object of the latest modified date, or None
    """
    try:
        g = Graph()
        g.parse(fragment_path, format="turtle")
        
        # Query for all dcterms:modified values
        modified_dates = []
        for s, p, o in g.triples((None, DCTERMS.modified, None)):
            if isinstance(o, Literal):
                try:
                    # Parse the datetime
                    dt = o.toPython()
                    if isinstance(dt, datetime):
                        modified_dates.append(dt)
                except Exception:
                    # Skip invalid datetime literals
                    pass
        
        if modified_dates:
            return max(modified_dates)
        
        return None
    except Exception as e:
        print(f"Error parsing fragment {fragment_path}: {e}")
        return None


def get_previous_fragment(source_id):
    """
    Find the most recent (highest epoch number) fragment in the LDES directory.
    This will be used as the previous fragment for tree:relation.
    
    Args:
        source_id: Source identifier
        
    Returns:
        tuple: (fragment_timestamp: str or None, fragment_datetime: datetime or None)
    """
    ldes_dir = get_ldes_directory(source_id)
    
    if not ldes_dir.exists():
        return None, None
    
    # Find all .ttl files except latest.ttl
    ttl_files = [f for f in ldes_dir.glob("*.ttl") if f.name != "latest.ttl"]
    
    if not ttl_files:
        return None, None
    
    # Extract epoch timestamps from filenames
    epoch_fragments = []
    for f in ttl_files:
        try:
            # Filename should be like "1768758532.ttl"
            epoch_str = f.stem  # Remove .ttl extension
            epoch = int(epoch_str)
            epoch_fragments.append((epoch, f))
        except ValueError:
            # Skip non-numeric filenames
            continue
    
    if not epoch_fragments:
        return None, None
    
    # Sort by epoch timestamp (highest first)
    epoch_fragments.sort(reverse=True)
    
    # Get the most recent fragment
    latest_epoch, latest_file = epoch_fragments[0]
    
    # Convert epoch to datetime
    fragment_datetime = datetime.fromtimestamp(latest_epoch)
    
    return str(latest_epoch), fragment_datetime


def query_translations_for_ldes(db_path, source_id, start_date=None, end_date=None):
    """
    Query the database for translations with status='approved' for LDES generation.
    Date filtering uses the translation event timestamp:
    COALESCE(updated_at, modified_at, created_at).
    
    Args:
        db_path: Path to the SQLite database
        source_id: Source identifier
        start_date: Optional start date (datetime)
        end_date: Optional end date (datetime)
        
    Returns:
        List of translation records as dictionaries.
        Each record includes:
        - modified_at: original translation modified/created timestamp
        - event_at: effective event timestamp used for LDES incremental logic
          (COALESCE(updated_at, modified_at, created_at))
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Build the query
    query = """
        SELECT 
            t.id as translation_id,
            t.value as translation_value,
            t.language,
            t.status,
            t.modified_at,
            t.created_at,
            t.updated_at,
            tf.id as term_field_id,
            tf.field_uri,
            tf.original_value,
            tm.id as term_id,
            tm.uri as term_uri
        FROM translations t
        JOIN term_fields tf ON t.term_field_id = tf.id
        JOIN terms tm ON tf.term_id = tm.id
        WHERE tm.source_id = ?
        AND t.status = 'approved'
    """
    
    params = [source_id]
    
    # Add date filters if provided
    if start_date:
        query += " AND datetime(COALESCE(t.updated_at, t.modified_at, t.created_at)) >= datetime(?)"
        params.append(start_date.isoformat())
    
    if end_date:
        query += " AND datetime(COALESCE(t.updated_at, t.modified_at, t.created_at)) <= datetime(?)"
        params.append(end_date.isoformat())
    
    query += " ORDER BY datetime(COALESCE(t.updated_at, t.modified_at, t.created_at)) ASC"
    
    print(f"Executing translation query with params: {params}")
    print(f"Query: {query}")
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    # Convert rows to dictionaries
    results = []
    for row in rows:
        results.append({
            'translation_id': row['translation_id'],
            'translation_value': row['translation_value'],
            'language': row['language'],
            'status': row['status'],
            'modified_at': row['modified_at'] or row['created_at'],
            'event_at': row['updated_at'] or row['modified_at'] or row['created_at'],
            'term_field_id': row['term_field_id'],
            'field_uri': row['field_uri'],
            'original_value': row['original_value'],
            'term_id': row['term_id'],
            'term_uri': row['term_uri'],
        })
    
    conn.close()
    return results


def extract_types_from_source(db_path, source_id):
    """
    Extract the type URIs from a source's translation_config column.
    
    Args:
        db_path: Path to the SQLite database
        source_id: Source identifier
        
    Returns:
        List of type URIs (e.g., ["http://qudt.org/schema/qudt/CoordinateSystem"])
        Returns empty list if no types found or on error.
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Query the translation_config from sources table
        cursor.execute(
            "SELECT translation_config FROM sources WHERE source_id = ?",
            [source_id]
        )
        row = cursor.fetchone()
        
        if not row or not row[0]:
            print(f"No translation_config found for source {source_id}")
            return []
        
        # Parse the JSON string
        config = json.loads(row[0])
        
        # Extract type URIs from types array
        types = []
        if 'types' in config and isinstance(config['types'], list):
            for type_obj in config['types']:
                if isinstance(type_obj, dict) and 'type' in type_obj:
                    types.append(type_obj['type'])
        
        print(f"Extracted types for source {source_id}: {types}")
        return types
        
    except json.JSONDecodeError as e:
        print(f"Error parsing translation_config JSON for source {source_id}: {e}")
        return []
    except Exception as e:
        print(f"Error extracting types for source {source_id}: {e}")
        return []
    finally:
        conn.close()


def extract_ldes_paths_from_source(db_path, source_id=1):
    """
    Extract ldes:timestampPath and ldes:versionOfPath from a source's LDES feed.
    
    This function queries the sources table for the given source_id.
    If the source_type is 'LDES', it retrieves the TTL content from the source_path URI
    and extracts the LDES properties.
    
    Args:
        db_path: Path to the SQLite database
        source_id: Source identifier (default: 1)
        
    Returns:
        tuple: (ldes_timestampPath_property, ldes_versionOfPath_property)
               Defaults to full URIs if not found or on error
    """
    # Default values (full URIs)
    default_timestamp = 'http://purl.org/dc/terms/modified'
    default_versionof = 'http://purl.org/dc/terms/isVersionOf'
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Query source_path and source_type from sources table
        cursor.execute(
            "SELECT source_path, source_type FROM sources WHERE source_id = ?",
            [source_id]
        )
        row = cursor.fetchone()
        
        if not row:
            print(f"No source found for source_id {source_id}")
            return default_timestamp, default_versionof
        
        source_path, source_type = row
        
        if source_type != 'LDES':
            print(f"Source {source_id} is not of type LDES (type: {source_type})")
            return default_timestamp, default_versionof
        
        if not source_path:
            print(f"No source_path found for source {source_id}")
            return default_timestamp, default_versionof
        
        print(f"Retrieving LDES TTL from URI: {source_path}")
        
        # Fetch the TTL content from the URI
        try:
            response = requests.get(source_path, timeout=30)
            response.raise_for_status()
            ttl_content = response.text
        except requests.RequestException as e:
            print(f"Error fetching LDES TTL from {source_path}: {e}")
            return default_timestamp, default_versionof
        
        # Parse the TTL content
        g = Graph()
        try:
            g.parse(StringIO(ttl_content), format="turtle", publicID=source_path)
        except Exception as e:
            print(f"Error parsing TTL content from {source_path}: {e}")
            return default_timestamp, default_versionof
        
        # Extract ldes:timestampPath
        timestamp_path = None
        for s, p, o in g.triples((None, LDES.timestampPath, None)):
            timestamp_path = str(o)
            break
        
        # Extract ldes:versionOfPath
        versionof_path = None
        for s, p, o in g.triples((None, LDES.versionOfPath, None)):
            versionof_path = str(o)
            break
        
        # Use defaults if not found
        if not timestamp_path:
            print(f"ldes:timestampPath not found in {source_path}, using default: {default_timestamp}")
            timestamp_path = default_timestamp
        else:
            print(f"Found ldes:timestampPath: {timestamp_path}")
        
        if not versionof_path:
            print(f"ldes:versionOfPath not found in {source_path}, using default: {default_versionof}")
            versionof_path = default_versionof
        else:
            print(f"Found ldes:versionOfPath: {versionof_path}")
        
        return timestamp_path, versionof_path
        
    except Exception as e:
        print(f"Error extracting LDES paths for source {source_id}: {e}")
        import traceback
        traceback.print_exc()
        return default_timestamp, default_versionof
    finally:
        conn.close()


def prepare_ldes_data(translations):
    """
    Transform translation records into LDES-compatible format.
    Groups translations by term URI and preserves all field URIs dynamically.
    
    Args:
        translations: List of translation records
        
    Returns:
        List of dictionaries suitable for LDES fragment generation
    """
    # Group translations by term URI
    terms_data = {}
    
    for trans in translations:
        term_uri = trans['term_uri']
        field_uri = trans['field_uri']
        
        if term_uri not in terms_data:
            # Format datetime as xsd:dateTime compliant string
            modified_dt = parse_datetime(trans['event_at'])
            modified_str = modified_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
            
            terms_data[term_uri] = {
                'concept': term_uri,
                'modified': modified_str,  # Store as formatted string
                'fields': {}  # Store all fields dynamically
            }
        
        # Update the latest modified date
        trans_dt = parse_datetime(trans['event_at'])
        current_dt = datetime.strptime(terms_data[term_uri]['modified'], "%Y-%m-%dT%H:%M:%SZ")
        
        if trans_dt > current_dt:
            terms_data[term_uri]['modified'] = trans_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        
        # Store field value by field_uri (dynamically)
        # Multiple values for the same field_uri are stored as a list
        if field_uri not in terms_data[term_uri]['fields']:
            terms_data[term_uri]['fields'][field_uri] = []
        
        terms_data[term_uri]['fields'][field_uri].append({
            'value': trans['translation_value'],
            'language': trans['language']
        })
    
    return list(terms_data.values())


def generate_ldes_fragment(source_id, ldes_data, fragment_timestamp, prev_fragment_timestamp, prefix_uri, prev_fragment_time, types=None, ldes_timestampPath_property=None, ldes_versionOfPath_property=None):
    """
    Generate an LDES fragment using py-sema (Subyt).
    
    Args:
        source_id: Source identifier
        ldes_data: List of dictionaries with term data
        fragment_timestamp: Epoch timestamp for this fragment (string)
        prev_fragment_timestamp: Epoch timestamp for previous fragment (string or None)
        prefix_uri: Base URI prefix for the LDES
        prev_fragment_time: ISO datetime string for tree:value (or None)
        types: List of type URIs extracted from source translation_config (optional)
        ldes_timestampPath_property: Property for LDES timestampPath (e.g., "dc:modified")
        ldes_versionOfPath_property: Property for LDES versionOfPath (e.g., "dc:isVersionOf")
        
    Returns:
        Path to the generated fragment file
    """
    # Ensure LDES directory exists
    ldes_dir = get_ldes_directory(source_id)
    ldes_dir.mkdir(parents=True, exist_ok=True)
    
    # Prepare output file path
    fragment_filename = f"{fragment_timestamp}.ttl"
    output_file = ldes_dir / fragment_filename
    
    # Create a temporary JSON file with the data
    temp_json = ldes_dir / f"temp_{fragment_timestamp}.json"
    with open(temp_json, 'w') as f:
        json.dump(ldes_data, f)
    
    try:
        # Set default values if not provided
        if ldes_timestampPath_property is None:
            ldes_timestampPath_property = 'dc:modified'
        if ldes_versionOfPath_property is None:
            ldes_versionOfPath_property = 'dc:isVersionOf'
        
        # Prepare variables for template
        vars_dict = {
            'source_id': source_id,
            'fragment_timestamp': fragment_timestamp,
            'prev_fragment_timestamp': prev_fragment_timestamp,
            'prev_fragment_time': prev_fragment_time,
            'prefix_uri': prefix_uri,
            'has_previous': prev_fragment_timestamp is not None,
            'types': types if types else [],
            'ldes_timestampPath_property': ldes_timestampPath_property,
            'ldes_versionOfPath_property': ldes_versionOfPath_property,
        }
        
        # Get templates folder
        templates_folder = Path(__file__).parent / "ldes_templates"
        
        # Create generator and sink
        service = JinjaBasedGenerator(str(templates_folder))
        sink = SinkFactory.make_sink(str(output_file), False)
        inputs = {'qres': SourceFactory.make_source(str(temp_json))}
        settings = GeneratorSettings()
        settings.iteration = False  # Use collection mode for full fragment generation
        
        # Generate the fragment
        service.process("ldes_fragment.ttl", inputs, settings, sink, vars_dict)
        
        print(f"Generated LDES fragment: {output_file}")
        
        return output_file
        
    finally:
        # Clean up temp file
        if temp_json.exists():
            temp_json.unlink()


def update_latest_symlink(source_id, fragment_file):
    """
    Copy the newest fragment to latest.ttl.
    
    Args:
        source_id: Source identifier
        fragment_file: Path to the fragment file
    """
    ldes_dir = get_ldes_directory(source_id)
    latest_file = ldes_dir / "latest.ttl"
    
    # Copy the content
    shutil.copy2(fragment_file, latest_file)
    
    print(f"Updated latest.ttl -> {fragment_file.name}")


def update_translations_to_merged(db_path, translation_ids):
    """
    Update translations status from 'approved' to 'merged' after successful LDES fragment creation.
    
    Args:
        db_path: Path to the SQLite database
        translation_ids: List of translation IDs to update
        
    Returns:
        int: Number of translations updated
    """
    if not translation_ids:
        return 0
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Update translations in batch
        placeholders = ','.join('?' * len(translation_ids))
        query = f"""
            UPDATE translations 
            SET status = 'merged', 
                updated_at = CURRENT_TIMESTAMP 
            WHERE id IN ({placeholders})
            AND status = 'approved'
        """
        
        cursor.execute(query, translation_ids)
        updated_count = cursor.rowcount
        conn.commit()
        
        print(f"Updated {updated_count} translation(s) to 'merged' status")
        return updated_count
        
    except Exception as e:
        conn.rollback()
        print(f"Error updating translations to merged: {e}")
        raise
    finally:
        conn.close()


def create_or_update_ldes(source_id, db_path, prefix_uri="https://this_should_be_filled_in.com"):
    """
    Main function to create or update LDES feed for a source.
    
    This function works with all source types (LDES and Static_file sources).
    It generates LDES fragments from translations with status='approved', regardless
    of whether the source was originally from an LDES feed or a static file import.
    After successful fragment creation, translations are updated to status='merged'.
    
    Args:
        source_id: Source identifier
        db_path: Path to SQLite database
        prefix_uri: Base URI prefix for LDES (default: marine-term-translations)
        
    Returns:
        dict: Result with status and message
    """
    print(f"Processing LDES for source {source_id}")
    print(f"Database: {db_path}")
    print(f"Prefix URI: {prefix_uri}")
    
    # Step 1: Detect existing LDES feed
    # Always query all translations with status='approved' (no date filtering in query)
    translations = query_translations_for_ldes(db_path, source_id)
    
    if not translations:
        print("No translations with status='approved' found.")
        return {
            'status': 'skipped',
            'message': 'No translations with status=approved found',
            'fragment': None
        }
        
    print(f"Found {len(translations)} approved translation(s) in database")
    
    # Get previous fragment info to ensure monotonic order and adjust older timestamps
    prev_fragment_timestamp, prev_fragment_datetime = get_previous_fragment(source_id)
    
    if prev_fragment_datetime:
        prev_naive = prev_fragment_datetime.replace(tzinfo=None) if prev_fragment_datetime.tzinfo else prev_fragment_datetime
        for t in translations:
            t_dt = parse_datetime(t['event_at'])
            t_naive = t_dt.replace(tzinfo=None) if t_dt.tzinfo else t_dt
            if t_naive <= prev_naive:
                # Adjust event_at to be slightly newer than the previous fragment
                adjusted_dt = prev_naive + timedelta(seconds=1)
                t['event_at'] = adjusted_dt.strftime("%Y-%m-%d %H:%M:%S")
                # Also adjust updated_at, modified_at, created_at to avoid mismatches
                t['updated_at'] = t['event_at']
    
    print(f"Found {len(translations)} translation(s) for LDES")
    
    # Step 5: Prepare LDES data
    ldes_data = prepare_ldes_data(translations)
    
    # Determine fragment timestamp based on latest modified date in translations
    # Use epoch timestamp for fragment naming
    if translations:
        latest_trans_date = max(
            parse_datetime(t['event_at']) for t in translations
        )
        # Convert to epoch timestamp (seconds since 1970-01-01)
        epoch_timestamp = int(latest_trans_date.timestamp())
        fragment_timestamp = str(epoch_timestamp)
    else:
        now = datetime.now()
        epoch_timestamp = int(now.timestamp())
        fragment_timestamp = str(epoch_timestamp)
    
    # Step 5b: Get previous fragment information for tree:relation
    prev_fragment_timestamp, prev_fragment_datetime = get_previous_fragment(source_id)
    
    if prev_fragment_timestamp and prev_fragment_datetime:
        # Format the previous fragment datetime for tree:value
        prev_fragment_time = prev_fragment_datetime.strftime("%Y-%m-%dT%H:%M:%SZ")
        print(f"Previous fragment found: {prev_fragment_timestamp} ({prev_fragment_time})")
    else:
        prev_fragment_time = None
        print("No previous fragment found. This is the first fragment.")
    
    # Step 5c: Extract types from source translation_config
    types = extract_types_from_source(db_path, source_id)
    
    print(f"Types extracted for LDES: {types}")
    
    # Step 5d: Extract LDES paths (timestampPath and versionOfPath) from source
    ldes_timestampPath_property, ldes_versionOfPath_property = extract_ldes_paths_from_source(db_path, source_id)
    
    print(f"LDES timestampPath property: {ldes_timestampPath_property}")
    print(f"LDES versionOfPath property: {ldes_versionOfPath_property}")
    
    # Step 6: Generate LDES fragment
    fragment_file = generate_ldes_fragment(
        source_id,
        ldes_data,
        fragment_timestamp,
        prev_fragment_timestamp,
        prefix_uri,
        prev_fragment_time,
        types,
        ldes_timestampPath_property,
        ldes_versionOfPath_property
    )
    
    # Step 7: Update latest.ttl
    update_latest_symlink(source_id, fragment_file)
    
    # Step 8: Update translation statuses to 'merged' after successful fragment creation
    translation_ids = [t['translation_id'] for t in translations]
    updated_count = update_translations_to_merged(db_path, translation_ids)
    
    return {
        'status': 'success',
        'message': f'LDES fragment created successfully',
        'fragment': str(fragment_file),
        'translations_count': len(translations),
        'merged_count': updated_count
    }


def main():
    """Main execution function."""
    if len(sys.argv) < 3:
        print("Error: Source ID and database path are required")
        print("Usage: python ldes.py <source-id> <database-path> [prefix-uri]")
        sys.exit(1)
    
    source_id = sys.argv[1]
    db_path = sys.argv[2]
    prefix_uri = sys.argv[3] if len(sys.argv) > 3 else "https://marine-term-translations.github.io"
    
    # Validate inputs
    if not os.path.exists(db_path):
        print(f"Error: Database file not found: {db_path}")
        sys.exit(1)
    
    try:
        result = create_or_update_ldes(source_id, db_path, prefix_uri)
        print(f"\nResult: {result['status']}")
        print(f"Message: {result['message']}")
        
        if result.get('fragment'):
            print(f"Fragment: {result['fragment']}")
        if result.get('translations_count'):
            print(f"Translations processed: {result['translations_count']}")
        
        # Return appropriate exit code
        sys.exit(0 if result['status'] in ['success', 'skipped'] else 1)
        
    except Exception as e:
        print(f"Error during LDES generation: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
