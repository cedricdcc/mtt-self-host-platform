// Browse routes - handles search and faceted browsing with FTS5

const express = require("express");
const router = express.Router();
const { getDatabase } = require("../db/database");
const { apiLimiter } = require("../middleware/rateLimit");
const { getUserLanguagePreferences, selectBestTranslation } = require("../utils/languagePreferences");

/**
 * @openapi
 * /api/browse:
 *   get:
 *     summary: Search and browse terms with faceted filtering
 *     description: |
 *       Search through terms using full-text search (FTS5) and filter by facets.
 *       Returns paginated results with facet counts.
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Full-text search query (searches uri, field_term, original_value, translation values)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Maximum number of results to return (default 20, max 100)
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of results to skip for pagination (default 0)
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *         description: Filter by translation language (e.g., 'fr', 'nl', 'de')
 *       - in: query
 *         name: language_mode
 *         schema:
 *           type: string
 *           enum: [has, missing]
 *           default: has
 *         description: Mode for language filter - 'has' shows terms with translation in language, 'missing' shows terms without
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by translation status (e.g., 'approved', 'draft', 'review')
 *       - in: query
 *         name: status_mode
 *         schema:
 *           type: string
 *           enum: [has, missing]
 *           default: has
 *         description: Mode for status filter - 'has' shows terms with translation status, 'missing' shows terms without
 *       - in: query
 *         name: field_uri
 *         schema:
 *           type: string
 *         description: Filter by field URI
 *       - in: query
 *         name: facets
 *         schema:
 *           type: string
 *         description: Comma-separated list of facets to compute (e.g., 'language,status,field_uri')
 *     responses:
 *       200:
 *         description: Search results with facets
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total:
 *                   type: integer
 *                   description: Total number of matching results
 *                 facets:
 *                   type: object
 *                   description: Facet counts for each requested facet
 *       400:
 *         description: Invalid parameters
 *       500:
 *         description: Server error
 */
router.get("/browse", apiLimiter, (req, res) => {
  try {
    const db = getDatabase();
    
    // Get user ID from session if authenticated
    const userId = req.session?.user?.id || req.session?.user?.user_id || null;
    const userPrefs = getUserLanguagePreferences(db, userId);
    
    // Parse parameters
    const searchQuery = req.query.query || '';
    let limit = parseInt(req.query.limit) || 20;
    let offset = parseInt(req.query.offset) || 0;
    const languageFilter = req.query.language || null;
    const languageMode = req.query.language_mode || 'has'; // 'has' or 'missing'
    const statusFilter = req.query.status || null;
    const statusMode = req.query.status_mode || 'has'; // 'has' or 'missing'
    const fieldUriFilter = req.query.field_uri || null;
    const requestedFacets = req.query.facets ? req.query.facets.split(',').map(f => f.trim()) : [];
    
    // Validate and cap parameters
    if (limit < 1) limit = 20;
    if (limit > 100) limit = 100;
    if (offset < 0) offset = 0;
    
    // Build WHERE clauses for filters
    const whereClauses = [];
    const params = [];
    
    // If there's a search query, use FTS
    if (searchQuery) {
      // Clean query for FTS5 to avoid syntax errors (like near "/")
      // Keep only alphanumeric characters, spaces, and wildcard '*'
      // Strip * unless it is at the end of a word (valid FTS5 prefix search)
      const cleanedFtsQuery = searchQuery
        .replace(/[^\w\s*]/g, ' ')
        .replace(/\*(?!\s|$)/g, ' ') // remove * if not followed by space or end of string
        .replace(/(?<!\w)\*/g, ' ')  // remove * if not preceded by a word character
        .trim()
        .replace(/\s+/g, ' ');

      if (cleanedFtsQuery) {
        // Search in translations FTS table and term_fields.original_value using LIKE
        // translations_fts contains translation data (rowid = translation.id)
        whereClauses.push(`(
          tr.id IN (
            SELECT rowid FROM translations_fts WHERE translations_fts MATCH ?
          ) OR 
          tf.original_value LIKE ?
          OR t.uri LIKE ?
        )`);
        params.push(cleanedFtsQuery, `%${searchQuery}%`, `%${searchQuery}%`);
      } else {
        // Fallback to LIKE search only if FTS query is empty after cleaning
        whereClauses.push(`(
          tf.original_value LIKE ?
          OR t.uri LIKE ?
        )`);
        params.push(`%${searchQuery}%`, `%${searchQuery}%`);
      }
    }
    
    // Apply facet filters
    if (languageFilter) {
      if (languageMode === 'missing') {
        // Find terms that DON'T have a translation in this language
        whereClauses.push(`t.id NOT IN (
          SELECT DISTINCT t2.id 
          FROM terms t2
          JOIN term_fields tf2 ON t2.id = tf2.term_id
          JOIN translations tr2 ON tf2.id = tr2.term_field_id
          WHERE tr2.language = ?
        )`);
        params.push(languageFilter);
      } else {
        // Default: find terms that HAVE a translation in this language
        whereClauses.push('tr.language = ?');
        params.push(languageFilter);
      }
    }
    
    if (statusFilter) {
      if (statusMode === 'missing') {
        // Find terms that DON'T have a translation with this status
        whereClauses.push(`t.id NOT IN (
          SELECT DISTINCT t2.id 
          FROM terms t2
          JOIN term_fields tf2 ON t2.id = tf2.term_id
          JOIN translations tr2 ON tf2.id = tr2.term_field_id
          WHERE tr2.status = ?
        )`);
        params.push(statusFilter);
      } else {
        // Default: find terms that HAVE a translation with this status
        whereClauses.push('tr.status = ?');
        params.push(statusFilter);
      }
    }
    
    if (fieldUriFilter) {
      whereClauses.push('tf.field_uri = ?');
      params.push(fieldUriFilter);
    }
    
    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    
    // Get total count of matching results
    const countQuery = `
      SELECT COUNT(DISTINCT t.id) as count
      FROM terms t
      LEFT JOIN term_fields tf ON t.id = tf.term_id
      LEFT JOIN translations tr ON tf.id = tr.term_field_id
      ${whereSQL}
    `;
    const totalCount = db.prepare(countQuery).get(...params).count;
    
    // Get paginated results
    // Group by term to avoid duplicates
    const resultsQuery = `
      SELECT DISTINCT t.id, t.uri
      FROM terms t
      LEFT JOIN term_fields tf ON t.id = tf.term_id
      LEFT JOIN translations tr ON tf.id = tr.term_field_id
      ${whereSQL}
      ORDER BY t.id
      LIMIT ? OFFSET ?
    `;
    const termResults = db.prepare(resultsQuery).all(...params, limit, offset);
    
    // For each term, get full details with fields and translations
    const results = termResults.map((term) => {
      // Get fields for this term
      const fields = db
        .prepare("SELECT * FROM term_fields WHERE term_id = ?")
        .all(term.id);
      
      // Get translations for all fields in one query
      const fieldIds = fields.map(f => f.id);
      let allTranslations = [];
      
      if (fieldIds.length > 0) {
        const placeholders = fieldIds.map(() => '?').join(',');
        allTranslations = db
          .prepare(`SELECT * FROM translations WHERE term_field_id IN (${placeholders})`)
          .all(...fieldIds);
      }
      
      // Group translations by field
      const translationsByField = {};
      for (const trans of allTranslations) {
        if (!translationsByField[trans.term_field_id]) {
          translationsByField[trans.term_field_id] = [];
        }
        translationsByField[trans.term_field_id].push(trans);
      }
      
      // Attach translations to fields
      const fieldsWithTranslations = fields.map((field) => ({
        ...field,
        field_roles: JSON.parse(field.field_roles), // Parse JSON string to array for frontend
        translations: translationsByField[field.id] || []
      }));
      
      // Find key fields for simplified result format (using field_uri since field_term/field_role removed)
      const labelField = fieldsWithTranslations.find(f => f.field_uri === 'http://www.w3.org/2004/02/skos/core#prefLabel')
        || fieldsWithTranslations.find(f => f.field_uri?.includes('prefLabel'))
        || fieldsWithTranslations.find(f => f.field_uri?.includes('label'))
        || fieldsWithTranslations[0];
      const referenceField = fieldsWithTranslations.find(f => f.field_uri === 'http://www.w3.org/2004/02/skos/core#definition')
        || fieldsWithTranslations.find(f => f.field_uri?.includes('definition'))
        || fieldsWithTranslations.find(f => f.field_uri?.includes('description'));
      const prefLabelField = fieldsWithTranslations.find(f => f.field_uri === 'http://www.w3.org/2004/02/skos/core#prefLabel');
      const definitionField = fieldsWithTranslations.find(f => f.field_uri === 'http://www.w3.org/2004/02/skos/core#definition');
      
      // Select best translation based on user language preferences
      const bestLabelTranslation = selectBestTranslation(
        prefLabelField?.translations || [],
        userPrefs.preferredLanguages
      );
      
      const bestDefinitionTranslation = selectBestTranslation(
        definitionField?.translations || [],
        userPrefs.preferredLanguages
      );
      
      return {
        uri: term.uri,
        original_value: prefLabelField?.original_value || definitionField?.original_value || null,
        // Include best matching translation based on user preferences
        displayValue: bestLabelTranslation?.value || prefLabelField?.original_value || definitionField?.original_value || null,
        displayLanguage: bestLabelTranslation?.language || 'undefined',
        displayStatus: bestLabelTranslation?.status || 'original',
        // Include all translations for clients that want to show multiple languages
        translations: fieldsWithTranslations.flatMap(f => f.translations).map(t => ({
          language: t.language,
          value: t.value,
          status: t.status
        })),
        // Include label and reference field information with original values
        labelField: labelField ? {
          field_uri: labelField.field_uri,
          original_value: labelField.original_value
        } : null,
        referenceField: referenceField ? {
          field_uri: referenceField.field_uri,
          original_value: referenceField.original_value
        } : null
      };
    });
    
    // Compute requested facets
    const facets = {};
    
    // Note: COUNT(DISTINCT) can be expensive on large datasets
    // For production with large data, consider:
    // 1. Using materialized views for facet counts
    // 2. Caching facet counts with periodic refresh
    // 3. Pre-computing counts during off-peak hours
    
    if (requestedFacets.includes('language')) {
      const langFacetQuery = `
        SELECT tr.language, COUNT(DISTINCT tr.id) as count
        FROM terms t
        LEFT JOIN term_fields tf ON t.id = tf.term_id
        LEFT JOIN translations tr ON tf.id = tr.term_field_id
        ${whereSQL}
        AND tr.language IS NOT NULL
        GROUP BY tr.language
        ORDER BY count DESC
      `;
      const langResults = db.prepare(langFacetQuery).all(...params);
      facets.language = {};
      langResults.forEach(row => {
        facets.language[row.language] = row.count;
      });
    }
    
    if (requestedFacets.includes('status')) {
      const statusFacetQuery = `
        SELECT tr.status, COUNT(DISTINCT tr.id) as count
        FROM terms t
        LEFT JOIN term_fields tf ON t.id = tf.term_id
        LEFT JOIN translations tr ON tf.id = tr.term_field_id
        ${whereSQL}
        AND tr.status IS NOT NULL
        GROUP BY tr.status
        ORDER BY count DESC
      `;
      const statusResults = db.prepare(statusFacetQuery).all(...params);
      facets.status = {};
      statusResults.forEach(row => {
        facets.status[row.status] = row.count;
      });
    }
    
    if (requestedFacets.includes('field_uri')) {
      const fieldUriFacetQuery = `
        SELECT tf.field_uri, COUNT(DISTINCT tf.id) as count
        FROM terms t
        LEFT JOIN term_fields tf ON t.id = tf.term_id
        LEFT JOIN translations tr ON tf.id = tr.term_field_id
        ${whereSQL}
        AND tf.field_uri IS NOT NULL
        GROUP BY tf.field_uri
        ORDER BY count DESC
        LIMIT 50
      `;
      const fieldUriResults = db.prepare(fieldUriFacetQuery).all(...params);
      facets.field_uri = {};
      fieldUriResults.forEach(row => {
        facets.field_uri[row.field_uri] = row.count;
      });
    }
    
    res.json({
      results,
      total: totalCount,
      limit,
      offset,
      facets
    });
  } catch (err) {
    console.error("[Browse API] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
