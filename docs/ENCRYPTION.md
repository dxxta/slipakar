# Encryption of user data

Slipakar encrypts the data of each user at rest with **envelope encryption**. This page explains the method, what is encrypted, who can read it and what happens when a password changes or a campaign is sent.

## The method: envelope encryption

Envelope encryption uses two layers of keys.

| Term | Meaning in Slipakar |
| --- | --- |
| **DEK** (data encryption key) | A random 256-bit key created once for each user. It encrypts the user's data. |
| **KEK** (key encryption key) | A key that encrypts, or **wraps**, the DEK. A DEK is never stored in the clear. |
| **Key wrapping** | Encrypting a key with another key. The DEK is wrapped with AES-256-GCM. |
| **Key derivation function (KDF)** | Turns a password into a key. Slipakar uses **scrypt** with N = 2^15, r = 8 and p = 1 and a random 16-byte salt, so each guess costs time and memory. |
| **AES-256-GCM** | The authenticated cipher for both data and keys. Every encryption uses a fresh random 12-byte IV and carries a 16-byte authentication tag, so tampering is detected. |
| **Re-wrapping** | Replacing the wrapper of a DEK, for example after a password change. The data itself is not encrypted again. |
| **Key escrow** | The extra server-wrapped copy of the DEK that keeps data usable when no password is available. |

Each user has one row in `UserDataKey` with two wrapped copies of the same DEK.

| Copy | Wrapped with | Purpose |
| --- | --- | --- |
| `passwordWrapped` | A KEK derived from the user's password with scrypt | Ties the data key to the user's password. It is added when the user signs in with a password and refreshed when the password changes. |
| `serverWrapped` | `APP_ENCRYPTION_KEY` (the server key) | Lets the server decrypt for the signed-in owner and for the sending worker, and recovers the key after a password reset. |

The DEK of the **project owner** encrypts everything in that project.

## What is encrypted

| Data | Where it lives | Notes |
| --- | --- | --- |
| Uploaded data (`rows`, `columns`, `fileName`) | `DataUpload` in PostgreSQL | Stored as one `enc1:` value each |
| Field mappings | `FieldMapping.mapping` | Reveals your column structure, so it is encrypted |
| SMTP passwords of a project | `SmtpConnection.passwordEncrypted` | Encrypted with the owner's DEK |
| Project files, such as attachments, generated PDFs and images used in PDF layouts | Object storage under `<projectId>/` | Encrypted before upload, the stored bytes start with `SLE1` |
| Platform integration credentials (Grafana, Mail) | `IntegrationConfig` | Encrypted directly with the server key, because they belong to the platform and not to a user |

Stored text values start with `enc1:`. A value without the prefix is never accepted as encrypted data.

## What is not encrypted

- **Recipient email addresses and names** in `CampaignRecipient`. They stay readable so lists can be filtered, counted and retried. Slipakar uses them only to send the emails.
- Email template text, PDF layout trees, project names and settings.
- Status, row numbers and counts of campaigns.
- Avatars and login events (IP address, user agent, location).
- Error logs. Slipakar never writes decrypted rows or mapping values to the audit log or to error reports. The audit log records only counts such as the row count.

## Sending needs your consent

Slipakar sends email in a background worker, and the worker has no user password. It reads the data through the server-wrapped copy of the DEK. For that reason:

1. **Every send asks for consent.** Sending a campaign, resuming it or retrying a recipient requires `consent: true`. The user app shows a checkbox that must be ticked, and the API returns `CONSENT_REQUIRED` without it. Nothing is queued if consent is refused.
2. **Consent is recorded** on the campaign as `sendConsentAt`.
3. **The worker checks consent before every message.** If it is missing, the worker skips the message and leaves the recipient pending.
4. **Consent can be withdrawn at any time.** Stopping a campaign clears `sendConsentAt` and sets the status to `stopped`. Unsent recipients stay pending, and the campaign can be resumed with a new consent.

The server can also decrypt for the signed-in owner, for example to show a preview or to open a mapping. This happens only inside that user's session.

## Default mailer

A campaign is sent through the **platform mailer** (the SMTP configuration set by an admin) unless the owner picks one of the project's own SMTP connections. The platform mailer has its own rate-limit bucket. If the platform mailer is not configured, the campaign form asks for a project SMTP connection.

## Changing or resetting a password

| Case | What happens |
| --- | --- |
| Change password | The DEK is unwrapped with the server copy and wrapped again with a KEK from the new password. No data is re-encrypted. |
| Reset by email link | The old password is unknown, so the password copy cannot be opened. The server copy is used, and the password copy is repaired at the next password sign-in. Nothing is lost. |
| Google-only account | The DEK exists with the server copy only. A password copy is added when the user sets a password and signs in with it. |

## Ownership changes

The example project belongs to a system owner until the first admin signs in. When ownership is handed over, the uploads, mappings and SMTP passwords of that project are re-encrypted from the old owner's DEK to the new owner's DEK in the same transaction. If that fails, the hand-over rolls back.

## Honest limits

- This is **not zero-knowledge**. Because of the server copy, someone who has both the database and `APP_ENCRYPTION_KEY` can read user data. Consent, per-user keys and the audit rules limit and document the server's access, they do not remove it.
- A leaked database alone, without `APP_ENCRYPTION_KEY`, does not reveal user data.
- **Back up `APP_ENCRYPTION_KEY` separately from the database.** If it is lost, every DEK, and with it all user data, is unrecoverable.
- Do not rotate `APP_ENCRYPTION_KEY` without a plan to unwrap and wrap every `serverWrapped` DEK and every `IntegrationConfig` value again.
- Keep `.env` private (`chmod 600 .env`) and protect backups, because the key sits next to the application.

## For developers

- Key and value code: `apps/api/src/services/envelope.ts` and `apps/api/src/services/data-vault.ts`.
- Files: `apps/api/src/internal/storage/encrypted-storage.ts` wraps the storage client for project keys.
- Consent: `sendConsentDto` in `apps/api/src/domain/campaigns/dto.ts`, checked in the campaigns use case and again in the worker.
- Tests: `envelope.spec.ts`, `data-vault.spec.ts`, `encrypted-storage.spec.ts` and the consent cases in the campaigns and worker specs.
