# Design Specification: Mailing Service Transporter Update & Pre-Rebuild Verification

**Date**: 2026-09-02  
**Status**: Approved  
**Topic**: Mailing Service Unauthenticated Relay & SMTP Test Runner  

---

## 1. Context & Motivation

The MTT platform's mailing service (`backend/src/services/mail.service.js`) previously assumed authenticated SMTP (`SMTP_USER`, `SMTP_PASS`) on port 587. In the target deployment environment, email is relayed through an internal institutional SMTP host (`kms.vliz.be`) on port 25 without authentication. Passing authentication credentials or using port 587 defaults causes connection or authentication failures.

Additionally, before rebuilding the production or local backend Docker container, there is a requirement to safely dispatch a live test email directly to `cedric.decruw@vliz.be` to verify end-to-end delivery.

---

## 2. Technical Architecture

### 2.1 Transporter Configuration (`backend/src/services/mail.service.js`)
Update `getTransporter()` to use an unauthenticated relay configuration:
- **Host**: `process.env.SMTP_HOST` (e.g. `kms.vliz.be`)
- **Port**: `parseInt(process.env.SMTP_PORT || "25", 10)` (defaults to 25)
- **Secure**: `process.env.SMTP_SECURE === "true"` (defaults to false)
- **Authentication**: Omitted from Nodemailer options so no `AUTH` command is issued to the relay
- **TLS**: `rejectUnauthorized: false` to avoid failure on self-signed or internal institutional certificates

```javascript
function getTransporter() {
  if (!transporter) {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || "25", 10);
    const smtpSecure = process.env.SMTP_SECURE === "true";
    if (!smtpHost) {
      console.warn("[Mail Service] SMTP_HOST not configured. Mail service running in offline mode.");
      return null;
    }
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      tls: {
        rejectUnauthorized: false
      }
    });
  }
  return transporter;
}
```

### 2.2 Dedicated CLI Test Runner (`backend/scripts/test-smtp-send.js`)
Create a standalone CLI diagnostic script:
- Loads environment variables using `dotenv` (from repository `.env`).
- Reads `--to=<email>` argument, falling back to `cedric.decruw@vliz.be` (or `process.env.SMTP_USER`).
- Runs `transporter.verify()` to validate the SMTP connection handshake.
- Sends a styled HTML and plain-text test email with metadata (timestamp, host, port, sender address).
- Displays message ID and server response details.
- Exits with `0` on success and `1` on error.

### 2.3 Package Script (`backend/package.json`)
Add a convenience script to `backend/package.json`:
- `"test:mail": "node scripts/test-smtp-send.js"`

---

## 3. Verification Plan

1. **Pre-Rebuild Live Test**:
   Execute `node backend/scripts/test-smtp-send.js --to=cedric.decruw@vliz.be` from the workspace. Confirm SMTP acceptance (`250 OK` / message ID returned).
2. **User Confirmation**:
   Verify receipt of test email in `cedric.decruw@vliz.be` inbox.
3. **Local Regression Testing**:
   Run existing test suites (`npm test` in `backend/`) to confirm no regressions in database queueing and unit tests.
4. **Backend Container Rebuild / Restart**:
   Once verified, rebuild or restart the backend container.
