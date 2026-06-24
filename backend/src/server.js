// Server entry point - starts the app and runs repository sync

const config = require("./config");
const dbInit = require("./services/dbInit.service");
const taskDispatcher = require("./services/taskDispatcher.service");
const app = require("./app");
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

// Bootstrap: sync repository and initialize database
dbInit.bootstrap();

// Initialize LDES feeds YAML file if it doesn't exist
const ldesFeedsPath = path.join(__dirname, "../../data/ldes-feeds.yaml");
if (!fs.existsSync(ldesFeedsPath)) {
  console.log("Creating empty ldes-feeds.yaml file...");
  try {
    const emptyConfig = { feeds: {} };
    fs.writeFileSync(ldesFeedsPath, yaml.dump(emptyConfig), "utf8");
    console.log("ldes-feeds.yaml created successfully");
  } catch (error) {
    console.error("Failed to create ldes-feeds.yaml:", error);
  }
}

// Start the task dispatcher (checks every minute for scheduled tasks)
taskDispatcher.startTaskDispatcher(60000);

// Process any pending tasks on startup
taskDispatcher.processPendingTasks();

// Start the mail queue worker (checks every 30 minutes)
const mailService = require("./services/mail.service");
mailService.startMailQueueWorker();

// Start the server
app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
});
