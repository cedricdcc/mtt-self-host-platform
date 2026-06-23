// Express application setup - middleware and route mounting

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const MemoryStore = require("memorystore")(session);
const swaggerUi = require("swagger-ui-express");
const config = require("./config");

const swaggerSpec = require("./docs/swagger");
const authRoutes = require("./routes/auth.routes");
const termsRoutes = require("./routes/terms.routes");
const teamsRoutes = require("./routes/teams.routes");
const appealsRoutes = require("./routes/appeals.routes");
const termDiscussionsRoutes = require("./routes/term-discussions.routes");
const userRoutes = require("./routes/user.routes");
const flowRoutes = require("./routes/flow.routes");
const browseRoutes = require("./routes/browse.routes");
const sourcesRoutes = require("./routes/sources.routes");
const sourceDetailRoutes = require("./routes/source-detail.routes");
const queryRoutes = require("./routes/query.routes");
const sparqlRoutes = require("./routes/sparql.routes");
const kpiRoutes = require("./routes/kpi.routes");
const tasksRoutes = require("./routes/tasks.routes");
const taskSchedulersRoutes = require("./routes/task-schedulers.routes");
const ldesRoutes = require("./routes/ldes.routes");
const adminRoutes = require("./routes/admin.routes");
const dockerRoutes = require("./routes/docker.routes");
const languagesRoutes = require("./routes/languages.routes");
const communityGoalsRoutes = require("./routes/community-goals.routes");
const communitiesRoutes = require("./routes/communities.routes");
const communityInvitationsRoutes = require("./routes/community-invitations.routes");
const communityStatsRoutes = require("./routes/community-stats.routes");
const notificationRoutes = require("./routes/notification.routes");
const vocabularyRequestsRoutes = require("./routes/vocabulary-requests.routes");

const app = express();

// Trust proxy when behind reverse proxy (Traefik, Nginx, etc.)
app.set('trust proxy', 1);

// Determine if we should use secure cookies
// Only use secure cookies in production AND when baseUrl uses HTTPS
const useSecureCookies = config.isProd && config.baseUrl.startsWith('https://');

// Session middleware
app.use(
  session({
    name: 'mtt.sid', // Custom session cookie name
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    store: new MemoryStore({ checkPeriod: 86400000 }), // 24h prune
    cookie: {
      httpOnly: true,
      secure: useSecureCookies,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      path: '/',
      domain: undefined, // Let browser auto-set
    },
  })
);

// Add session debugging middleware (development only)
if (!config.isProd) {
  app.use((req, res, next) => {
    console.log('[Session Debug] Path:', req.path);
    console.log('[Session Debug] Session ID:', req.sessionID);
    console.log('[Session Debug] Session exists:', !!req.session);
    console.log('[Session Debug] Session state:', req.session?.state);
    console.log('[Session Debug] Cookie secure:', useSecureCookies);
    console.log('[Session Debug] Base URL:', config.baseUrl);
    next();
  });
}

// CORS middleware
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

// Swagger documentation
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Mount routes with /api prefix
app.use("/", authRoutes);
app.use("/", userRoutes);
app.use("/", termsRoutes);
app.use("/", teamsRoutes);
app.use("/", appealsRoutes);
app.use("/", termDiscussionsRoutes);
app.use("/", flowRoutes);
app.use("/", browseRoutes);
app.use("/", sourcesRoutes);
app.use("/", sourceDetailRoutes);
app.use("/", queryRoutes);
app.use("/", sparqlRoutes);
app.use("/", kpiRoutes);
app.use("/", tasksRoutes);
app.use("/", taskSchedulersRoutes);
app.use("/", ldesRoutes);
app.use("/", adminRoutes);
app.use("/", dockerRoutes);
app.use("/", languagesRoutes);
app.use("/", communityGoalsRoutes);
app.use("/", communitiesRoutes);
app.use("/", communityInvitationsRoutes);
app.use("/", communityStatsRoutes);
app.use("/", notificationRoutes);
app.use("/", vocabularyRequestsRoutes);

app.post("/debug-log", (req, res) => {
  const fs = require('fs');
  const path = require('path');
  try {
    fs.writeFileSync(path.join(__dirname, '../../debug.log'), JSON.stringify(req.body, null, 2) + '\n');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;
