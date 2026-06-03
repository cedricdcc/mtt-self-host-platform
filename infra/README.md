# Infrastructure Scripts

This directory contains utility scripts for managing the Marine Term Translations platform.

## Available Scripts

### backup.sh

Backs up the SQLite database to the `backups/` directory with a timestamp.

```bash
sh infra/backup.sh
```

Creates a backup file like: `backups/translations-20231210-120000.db`

### restore.sh

Restores the database from a backup file. Automatically backs up the current database before restoring.

```bash
sh infra/restore.sh backups/translations-20231210-120000.db
```

After restoring, restart the backend:
```bash
docker compose restart backend
```

### rebuild.sh

Rebuilds and restarts all containers. It includes:
- **Port 5000 Force-Clearing**: Automatically kills any process occupying port 5000 (even system-level processes if run with root privileges) to prevent container start failures.
- **Robust Health Verification**: Validates that all Docker containers are running and that backend/frontend endpoints are serving traffic properly.
- **Automated Self-Healing**: If the health check fails, it stops the stack, clears the port, rebuilds, and restarts automatically.
- **Log Archiving**: Logs all operations with timestamps to `infra/rebuild.log`.

```bash
# Normal rebuild (keeps data)
sh infra/rebuild.sh

# Rebuild and wipe database (⚠️ deletes all data)
sh infra/rebuild.sh --wipe
```

#### Scheduling as a Cron Job

Since freeing port 5000 requires killing system/root-level processes (like Nutanix services) and must run non-interactively, **the cron job must be configured in root's crontab**.

1. Open root's crontab:
   ```bash
   sudo crontab -e
   ```

2. Add a cron entry (e.g., to run every night at 2:00 AM):
   ```cron
   0 2 * * * cd /data/projects/mtt-self-host-platform && bash infra/rebuild.sh >> infra/rebuild.log 2>&1
   ```

3. View execution logs at any time:
   ```bash
   tail -f infra/rebuild.log
   ```

