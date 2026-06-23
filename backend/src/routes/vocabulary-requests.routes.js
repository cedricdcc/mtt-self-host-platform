// Vocabulary requests routes - handles requests for new vocabularies/sources

const express = require("express");
const router = express.Router();
const { getDatabase } = require("../db/database");
const { apiLimiter, writeLimiter } = require("../middleware/rateLimit");

/**
 * Middleware to check if user is authenticated
 */
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
};

/**
 * Middleware to check if user is admin
 */
const requireAdmin = (req, res, next) => {
  if (!req.session || !req.session.user || !req.session.user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

/**
 * @openapi
 * /api/vocabulary-requests:
 *   get:
 *     summary: Retrieve all vocabulary requests (admins) or user-owned requests
 *     responses:
 *       200:
 *         description: Returns list of vocabulary requests
 *       401:
 *         description: Not authenticated
 */
router.get("/vocabulary-requests", apiLimiter, requireAuth, (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.session.user.id || req.session.user.user_id;
    const isAdmin = req.session.user.isAdmin;
    
    let requests;
    if (isAdmin) {
      // Admin sees everything with requester details
      requests = db.prepare(`
        SELECT vr.*, u.username as requested_by
        FROM vocabulary_requests vr
        LEFT JOIN users u ON vr.requested_by_id = u.id
        ORDER BY vr.created_at DESC
      `).all();
    } else {
      // User only sees their own
      requests = db.prepare(`
        SELECT vr.*, u.username as requested_by
        FROM vocabulary_requests vr
        LEFT JOIN users u ON vr.requested_by_id = u.id
        WHERE vr.requested_by_id = ?
        ORDER BY vr.created_at DESC
      `).all(userId);
    }
    
    res.json(requests);
  } catch (err) {
    console.error("Error fetching vocabulary requests:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/vocabulary-requests:
 *   post:
 *     summary: Create a new vocabulary request
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - sourceUri
 *             properties:
 *               title:
 *                 type: string
 *               sourceUri:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Request created successfully
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Not authenticated
 */
router.post("/vocabulary-requests", writeLimiter, requireAuth, (req, res) => {
  const { title, sourceUri, description } = req.body;
  
  if (!title || !sourceUri) {
    return res.status(400).json({ error: "Title and Source URI are required" });
  }
  
  const userId = req.session.user.id || req.session.user.user_id;
  
  try {
    const db = getDatabase();
    
    const stmt = db.prepare(`
      INSERT INTO vocabulary_requests (title, source_uri, description, requested_by_id)
      VALUES (?, ?, ?, ?)
    `);
    const info = stmt.run(title, sourceUri, description || null, userId);
    
    const created = db.prepare(`
      SELECT vr.*, u.username as requested_by
      FROM vocabulary_requests vr
      LEFT JOIN users u ON vr.requested_by_id = u.id
      WHERE vr.id = ?
    `).get(info.lastInsertRowid);
    
    res.status(201).json(created);
  } catch (err) {
    console.error("Error creating vocabulary request:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/vocabulary-requests/{id}:
 *   patch:
 *     summary: Update vocabulary request status (Admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, approved, rejected, completed]
 *               adminNotes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Request updated successfully
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: Request not found
 */
router.patch("/vocabulary-requests/:id", writeLimiter, requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { status, adminNotes } = req.body;
  
  const requestId = parseInt(id, 10);
  if (isNaN(requestId)) {
    return res.status(400).json({ error: "Invalid request ID" });
  }
  
  if (!status || !['pending', 'approved', 'rejected', 'completed'].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  
  try {
    const db = getDatabase();
    
    // Check if request exists
    const request = db.prepare("SELECT id FROM vocabulary_requests WHERE id = ?").get(requestId);
    if (!request) {
      return res.status(404).json({ error: "Vocabulary request not found" });
    }
    
    // Update status and notes
    db.prepare(`
      UPDATE vocabulary_requests
      SET status = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, adminNotes || null, requestId);
    
    const updated = db.prepare(`
      SELECT vr.*, u.username as requested_by
      FROM vocabulary_requests vr
      LEFT JOIN users u ON vr.requested_by_id = u.id
      WHERE vr.id = ?
    `).get(requestId);
    
    res.json(updated);
  } catch (err) {
    console.error("Error updating vocabulary request:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
