const express = require("express");
const router = express.Router();
const eventController = require("../controllers/eventController");
const { requireAuth, requireAdmin } = require("../middleware/admin");

/**
 * @openapi
 * /api/events:
 *   get:
 *     summary: List all events with status and user participation
 *     tags: [Events]
 *     responses:
 *       200:
 *         description: List of events
 *   post:
 *     summary: Create a new event (Admin only)
 *     tags: [Events]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, startDate, endDate]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               startDate:
 *                 type: string
 *               endDate:
 *                 type: string
 *               rewardTitle:
 *                 type: string
 *               sourceIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       201:
 *         description: Event created successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Admin access required
 */
router.get("/events", eventController.listEvents);
router.post("/events", requireAdmin, eventController.createEvent);

/**
 * @openapi
 * /api/events/sources:
 *   get:
 *     summary: Get available vocabulary sources for event creation
 *     tags: [Events]
 *     responses:
 *       200:
 *         description: List of available sources
 */
router.get("/events/sources", eventController.getSources);

/**
 * @openapi
 * /api/events/{id}:
 *   get:
 *     summary: Get event details by ID
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Event details
 *       404:
 *         description: Event not found
 *   delete:
 *     summary: Delete an event (Admin only)
 *     tags: [Events]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Event deleted successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Admin access required
 */
router.get("/events/:id", eventController.getEvent);

/**
 * @openapi
 * /api/events/{id}/stats:
 *   get:
 *     summary: Get event statistics, timeline, and individual leaderboard
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: resolution
 *         schema:
 *           type: string
 *           enum: [smart, hour, day, week]
 *       - in: query
 *         name: userOnly
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Event statistics
 *       401:
 *         description: Authentication required for user-only statistics
 *       404:
 *         description: Event not found
 */
router.get("/events/:id/stats", eventController.getEventStats);
router.delete("/events/:id", requireAdmin, eventController.deleteEvent);

/**
 * @openapi
 * /api/events/{id}/status:
 *   patch:
 *     summary: Update event status (Admin only)
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [UPCOMING, ACTIVE, PAUSED, COMPLETED]
 *     responses:
 *       200:
 *         description: Status updated
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Admin access required
 */
router.patch("/events/:id/status", requireAdmin, eventController.updateStatus);

/**
 * @openapi
 * /api/events/{id}/teams:
 *   post:
 *     summary: Create a team for an event (Authenticated)
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               imageUrl:
 *                 type: string
 *     responses:
 *       201:
 *         description: Team created
 *       401:
 *         description: Not authenticated
 */
router.post("/events/:id/teams", requireAuth, eventController.createTeam);

/**
 * @openapi
 * /api/events/{id}/join:
 *   post:
 *     summary: Join an event team using join code (Authenticated)
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [identifier]
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: Team join code or team ID
 *     responses:
 *       200:
 *         description: Joined team successfully
 *       401:
 *         description: Not authenticated
 */
router.post("/events/:id/join", requireAuth, eventController.joinTeam);

/**
 * @openapi
 * /api/events/{id}/qr:
 *   get:
 *     summary: Generate event or team QR code
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: teamId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: QR Code SVG/PNG
 */
router.get("/events/:id/qr", eventController.generateQR);

/**
 * @openapi
 * /api/events/{eventId}/teams/{teamId}:
 *   delete:
 *     summary: Delete a team from an event (Admin only)
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Team deleted
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Admin access required
 */
router.delete("/events/:eventId/teams/:teamId", requireAdmin, eventController.deleteTeam);

/**
 * @openapi
 * /api/events/featured:
 *   patch:
 *     summary: Toggle or set featured event (Admin only)
 *     tags: [Events]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               eventId:
 *                 type: string
 *               isFeatured:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Featured event updated
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Admin access required
 */
router.patch("/events/featured", requireAdmin, eventController.setFeatured);
router.patch("/events/:id/featured", requireAdmin, eventController.setFeatured);

/**
 * @openapi
 * /api/events/{id}/settle:
 *   post:
 *     summary: Settle event rewards and award winner titles (Admin only)
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Event settled
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Admin access required
 */
router.post("/events/:id/settle", requireAdmin, eventController.settleEvent);

/**
 * @openapi
 * /api/users/{id}/titles:
 *   get:
 *     summary: Get user competition titles
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User titles
 */
router.get("/users/:id/titles", eventController.getUserTitles);

/**
 * @openapi
 * /api/users/titles/equip:
 *   post:
 *     summary: Equip a competition title for authenticated user
 *     tags: [Events]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *     responses:
 *       200:
 *         description: Title equipped
 *       401:
 *         description: Not authenticated
 */
router.post("/users/titles/equip", requireAuth, eventController.equipUserTitle);

module.exports = router;
