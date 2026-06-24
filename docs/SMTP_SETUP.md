# SMTP Setup Guide for Administrators

This guide describes how to configure the mailing service for your self-hosted instance of the Marine Term Translations (MTT) Platform. 

The mailing service allows the platform to send automated transactional emails, such as:
* **Discussion Replies**: Notifying active participants of discussion threads.
* **Translation Status Updates**: Informing users when suggestions are approved or rejected.
* **Broadcast Announcements**: System-wide announcements sent by administrators.

---

## Configuration Variables

SMTP connection parameters are securely configured using environment variables in your `.env` file.

Open the `.env` file in the root of your MTT installation and add or modify the following variables:

```ini
# SMTP Configuration for Mailing Service
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username-here
SMTP_PASS=your-smtp-password-here
SMTP_FROM_NAME="Marine Term Translations"
SMTP_FROM_EMAIL=no-reply@example.com
```

### Variable Reference

| Variable | Required | Default | Description |
|:---|:---:|:---:|:---|
| `SMTP_HOST` | Yes | - | The hostname of your SMTP server (e.g., `smtp.mailgun.org`, `smtp.sendgrid.net`, `smtp.gmail.com`). |
| `SMTP_PORT` | No | `587` | The port to connect to (typically `587` for STARTTLS/TLS, `465` for SSL, or `25` for unencrypted connections). |
| `SMTP_SECURE` | No | `false` | Set to `true` if you are using port `465` (forcing SSL connection from the start). Otherwise, set to `false` (most services use STARTTLS on port 587). |
| `SMTP_USER` | No | - | Your SMTP account username (often your email address). Leave empty if authentication is not required. |
| `SMTP_PASS` | No | - | Your SMTP account password or app-specific API key. Leave empty if authentication is not required. |
| `SMTP_FROM_NAME` | No | `"Marine Term Translations"` | The sender display name that users will see in their email client. |
| `SMTP_FROM_EMAIL` | No | `no-reply@example.com` | The email address the message appears to come from. Must be authorized on your SMTP server. |

---

## Applying Changes

After updating the `.env` file, restart the platform containers to apply the configuration:

```bash
docker compose restart backend
```

---

## Technical Details

* **Queue Management**: Emails are not sent instantly. They are stored in a database queue (`mail_queue` table) and processed by a background worker running **every 30 minutes** to prevent blocking web requests and ensure reliable delivery.
* **SSL Certificates**: The system includes automatic fallback (`rejectUnauthorized: false`) to support self-signed certificates or test mail environments (like MailHog).
* **Test Utility**: Administrators can check the status of the mail queue and trigger manual retries on failed deliveries directly from the Admin Mail Panel.
