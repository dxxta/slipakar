# Slipakar MVP demo

Run on the local development stack with Mailpit for email, using the demo admin account `demo-admin@slipakar.local`, on 2026-11-12. The API used port 3999 because port 3000 was occupied; the user app used port 4300, the admin app 4301, Mailpit 8025, and Grafana 3011.

| Screenshot | Feature | What it shows |
| --- | --- | --- |
| ![Sign-up form](01-sign-up.png) | Account creation | Demo account details entered with the password masked. |
| ![Verification email](02-verification-email.png) | Email verification | Mailpit filtered to the demo account’s verification email. |
| ![Sign-in](03-sign-in.png) | Authentication | Demo account sign-in form with password masked. |
| ![Projects](04-projects-empty.png) | Projects | Project list; the fresh workspace also contained a seeded example project. “Demo Payroll” was added. |
| ![Project overview](05-project-overview.png) | Project overview | Project activity and delivery summary. |
| ![SMTP connection](06-smtp-connection.png) | SMTP | Mailpit connection configured and tested at localhost:1025. |
| ![Email template](07-email-template.png) | Email templates | “Demo Payslip” template with month, name, and salary placeholders. |
| ![Data upload](08-data-upload.png) | Data upload | Three-row CSV upload and preview using example.test recipient addresses. |
| ![Field mapping](09-field-mapping.png) | Field mapping | Email and template placeholders mapped to CSV columns and saved. |
| ![Campaign creation](10-campaign-create.png) | Campaigns | Template, recipient data, email column, and SMTP selected before campaign creation. |
| ![Campaign sent](11-campaign-sent.png) | Campaign delivery | Completed campaign with three sent, zero failed, and zero pending recipients. |
| ![Delivered emails](12-delivered-emails.png) | Mailpit | Three delivered messages, filtered to example.test recipients. |
| ![PDF templates](13-pdf-templates.png) | PDF templates | Empty PDF template list and its create action. |
| ![Notifications](14-notifications.png) | Notifications | Activity and announcements view. |
| ![Profile](15-profile.png) | Profile | Demo account profile page. |
| ![Login activity](16-login-activity.png) | Login activity | Recent sign-in with unavailable location and no map. |
| ![Admin sign-in](18-admin-sign-in.png) | Admin authentication | Admin sign-in form with demo credentials entered and password masked. |
| ![Admin setup](19-admin-setup.png) | Integrations | Grafana and Mail integrations configured from environment and tested successfully. |
| ![Feature flags](20-admin-feature-flags.png) | Admin feature flags | Scalar documentation, PDF builder, and self sign-up flags. |
| ![Admin users](21-admin-users.png) | Admin users | Demo admin account in the user list. |
| ![Broadcasts](22-admin-broadcasts.png) | Admin broadcasts | Empty broadcast list with the create action. |
| ![Admin login activity](23-admin-login-activity.png) | Admin login activity | Sign-in activity for the demo account. |
| ![Admin preferences](24-admin-preferences.png) | Admin preferences | Light theme and appearance settings. |

## Not captured / issues found

- Scene 17 (login location map) was skipped because the available login event had no coordinates; it showed an unavailable location and “No map.”
- The PDF templates page had no PDF template configured, so the screenshot shows the empty list.
- The initial project list included the database’s seeded “Example payroll project”; the requested “Demo Payroll” project was created and used for the remaining scenes.
