# Changelog


## [3.1.3](https://github.com/dxxta/slipakar/compare/v3.1.2...v3.1.3) (2026-11-10)

### Features

* **admin-web:** add tactile pressed feedback ([c0d949a](https://github.com/dxxta/slipakar/commit/c0d949a24d7966475a10cdac2ee23bbacd2c2814))
* **admin-web:** align theme tokens and fonts ([1c39395](https://github.com/dxxta/slipakar/commit/1c393958d45aec89dbd1591652fecb0b7695818e))
* **admin-web:** apply shared tactile UI surfaces ([bea42c9](https://github.com/dxxta/slipakar/commit/bea42c9219d2829ad338983141f204e3e6280ae1))
* **admin-web:** restyle responsive sidebar controls ([6a0dc54](https://github.com/dxxta/slipakar/commit/6a0dc5436089fc5c62890d7ea5a029546bffe0d1))
* **admin-web:** unify feature page appearance ([8298c3a](https://github.com/dxxta/slipakar/commit/8298c3a748033c108d326ef4f9d679aabb4fd6b6))
* **infra:** add a landing-only compose file ([3dfefdd](https://github.com/dxxta/slipakar/commit/3dfefdd23c5384ce6b122421903a2c515e4eefb1))
* **infra:** make API, Grafana and Uptime Kuma host ports configurable ([d61fcb8](https://github.com/dxxta/slipakar/commit/d61fcb8af2a0cd37122c6cf060521e6e6f5dfd5a))
* use the Slipakar app icon as favicon for landing, user and admin web ([d53fd7a](https://github.com/dxxta/slipakar/commit/d53fd7a11fc2aeb1d79a3e6c603b25b57f147d79))
* **web:** toast every form result in the top right and fix the admin error message style ([a5ab385](https://github.com/dxxta/slipakar/commit/a5ab3855b5a3cd35d45a2ba8ad9f5da79365fd2b))

### Bug Fixes

* **admin-web:** open the user app on the same origin and show test results in the setup badge ([d9e4b45](https://github.com/dxxta/slipakar/commit/d9e4b459f71f3a42438dc347f946d3f56c399860))
* **admin-web:** use the accent colour and a visible error colour for the setup test badge ([a672f14](https://github.com/dxxta/slipakar/commit/a672f14b3a97f464b6c60dc6b6f57e0803ca8b6f))
* **api:** build the shared package before the API in the Docker image ([2d3918b](https://github.com/dxxta/slipakar/commit/2d3918b7bbaa82aa3e2ef4faa74f86975ae242c7))
* **landing-web:** drop the stale Content-Length after rewriting runtime URLs so the page is not truncated ([7447b3c](https://github.com/dxxta/slipakar/commit/7447b3cfcc4a5fbf72b35a445b3a03ffa1905cef))
* **web:** build the shared package before the Angular apps in the web image ([f2ff64a](https://github.com/dxxta/slipakar/commit/f2ff64a9a79e49d1231fcb79b0e8039c6aa123a9))
* **web:** use relative redirects so /console redirects work behind a proxy ([8652e8e](https://github.com/dxxta/slipakar/commit/8652e8e15a45f774c13f90208fd01d03eec49fcd))

### Documentation

* add Slipakar branding guide, logo assets and default design system ([fcc5cdd](https://github.com/dxxta/slipakar/commit/fcc5cdd7cd91808d11dd43c02ba1ba367ac89177))
* remove the Open Graph image to-do ([d0a5316](https://github.com/dxxta/slipakar/commit/d0a5316801a188517ae98ed5f1bb1215e9e77d24))

## [3.1.2](///compare/v3.1.1...v3.1.2) (2026-11-10)

### Features

* **admin-web:** add a shared ripple directive with click tooltips 5ace35d
* **admin-web:** add a top loading bar driven by API requests 5489fca
* **admin-web:** add an icon-only back button 2428649
* **admin-web:** add segmented pill tabs d6a8dbe
* **admin-web:** add sticky drawer footer slot b097f0b
* **admin-web:** align broadcasts page sizes, card tables on mobile and ripple fe1245d
* **admin-web:** align confirm modal control sizes 1679370
* **admin-web:** align feature flags page sizes, card tables on mobile and ripple 17c9b39
* **admin-web:** align list body action sizes 576425c
* **admin-web:** align login activity page sizes, card tables on mobile and ripple 1b386ce
* **admin-web:** align monitoring page sizes, card tables on mobile and ripple c191210
* **admin-web:** align page header 3249254
* **admin-web:** align page state ripple and sizes b3e14e0
* **admin-web:** align pagination spacing and sizes 2c0953a
* **admin-web:** align preferences page sizes, card tables on mobile and ripple 6abe770
* **admin-web:** align select control height b2267f0
* **admin-web:** align setup page sizes, card tables on mobile and ripple 6e19d5d
* **admin-web:** align tabs a95e70b
* **admin-web:** align users page sizes, card tables on mobile and ripple d366faf
* **admin-web:** broadcast drawers use the sticky footer for actions 96d208b
* **admin-web:** broadcasts page action becomes a 3-dot menu on mobile a8ed220
* **admin-web:** export back button and segmented tabs 1fd24ea
* **admin-web:** fixed collapsible icon sidebar and surface mobile header e137d10
* **admin-web:** float the account menu above the sidebar with the theme toggle a2ff974
* **admin-web:** move the theme toggle into a menu item ba27f2b
* **admin-web:** right-align row actions with icon set and solid variant c4ea218
* **admin-web:** setup drawer uses the sticky footer for actions 6991ca4
* **admin-web:** stack list filters evenly on mobile 4e81900
* **admin-web:** users drawer uses the sticky footer for actions e8ac63f
* **landing-web:** floating theme toggle e201057
* **landing-web:** palette, fonts and pressed directive be9c7c8
* **landing-web:** playful redesign with chunky type, pill buttons and bold colour blocks c93a6c2
* **landing-web:** refine playful landing design cc2cb0b
* **pdf:** add a resizable solid sheet element and a template name header card 96d1d8a
* **pdf:** show uploaded images in the editor, add print preview and fold the template name into the editor card 2826599
* **theme:** tint surfaces, borders and muted colors with the chosen accent and fix accent swatch spacing 29a10f6
* **user-web:** accent table headers, drawer footers, surface mobile header and card-style tables on mobile e010661
* **user-web:** add plus icons to new actions 680f26b
* **user-web:** add styled and unstyled appearance e364a60
* **user-web:** align the sidebar toggle with the row-action button style 2c0179f
* **user-web:** align theme tokens and fonts 7f2a1c4
* **user-web:** card-per-row mobile tables with a main column, status aside and action button 1428bd4
* **user-web:** customize per-theme base colors c31b0c9
* **user-web:** mobile icon-only actions, desktop control sizes, even filters, scrollable summary cards and profile remove fix 8b0e543
* **user-web:** put project tabs beside the back link and move detail back buttons next to page actions 0748f63
* **user-web:** top loading bar, two-column mobile tables and a shared ripple directive 3c80083
* **user-web:** upload images into PDF templates and use icon chips for new elements 5a5501c
* **user-web:** use solid icon buttons to duplicate or delete a PDF node 47c8b4b

### Bug Fixes

* **admin-web:** keep drawer footers in their own blocks so they project into the footer e1fa27c
* **api:** explain why an integration connection test failed bcc9061
* **landing-web:** audience cards, dark accent text, language tabs and section dividers 939562a
* **landing-web:** remove open-source borders and keep ink borders on coloured blocks f2aab9f
* **user-web:** apply content link styling inside layout 80266c6
* **user-web:** apply tactile styling to standalone buttons efc9269
* **user-web:** drop the duplicate close button from detail drawers cf12b03
* **user-web:** keep accent swatches consistent across themes 14fcc9b
* **user-web:** keep content links readable across themes 38b202b
* **user-web:** keep page actions beside headings 049b722
* **user-web:** keep sortable headers plain eea87e8
* **user-web:** let the pressed state win over hover on sidebar buttons 0d0ac20
* **user-web:** make avatar URL and Remove a true joined input group c7d7c0f
* **user-web:** make PDF editor chips quiet controls 50a3ab2
* **user-web:** make sidebar toggle and account button press like New project 0b164bc
* **user-web:** match collapsed profile button radius to the sidebar toggle 84a5604
* **user-web:** remove logo eafb509
* **user-web:** render accent swatches with real colors cceabc4
* **user-web:** render sortable column names as plain header text 4a54ad7
* **user-web:** restore lime accent and black third e343424
* **user-web:** restore pressed style on sidebar collapse button 064f709
* **user-web:** restyle account menu actions d844dce
* **user-web:** show unsaved changes beside the template name label 1b4f328
* **user-web:** simplify account menu sign out 55cdf97
* **user-web:** simplify dropdown menu rows 81912e1
* **user-web:** square sidebar navigation controls 4f18b54
* **user-web:** unify avatar URL input group 1d82c0c
* **user-web:** wrap multi-line mobile table values below each other, right-aligned 65a5b41

### Chores

* **infra:** allow Google Fonts in web CSP 6176e5a

## [3.1.1](///compare/v3.1.0...v3.1.1) (2026-11-10)

### Bug Fixes

* **user-web:** align delete modals, action menus, icon buttons and sidebar dd4729a

## [3.1.0](///compare/v3.0.0...v3.1.0) (2026-11-10)

### Features

* **api:** seed a demo workspace at startup under a system owner bdb0b5f
* **setup:** preconfigure Grafana and Uptime Kuma through Docker 335e7c4
* **ui:** add an extra-large avatar size 26f3430
* **user-web:** refresh layout, lists, forms and navigation 4518808

### Tests

* **api:** prove the first admin claims the demo project once fce59e8

## [3.0.0](///compare/v2.0.0...v3.0.0) (2026-11-10)

### ⚠ BREAKING CHANGES

* npm workspace packages move to the `@slipakar` scope, Prometheus metrics use the slipakar_ prefix, the Grafana dashboard, datasource and job are renamed, the browser theme storage key changes (the previous key is still read as a fallback), and the default PostgreSQL, RabbitMQ, S3 bucket and Compose project names change. Existing deployments keep their data by setting POSTGRES_USER, POSTGRES_DB, RABBITMQ_USER, S3_BUCKET and COMPOSE_PROJECT_NAME to the previous values; see the upgrade section in docs/SELF-HOSTING.md.

### Features

* **landing-web:** public Angular SSR landing site fdfb6e0
* rebrand to Slipakar 403d037
* **ui:** align admin and user themes with the landing palette ef8416d

### Bug Fixes

* **user-web:** use the default size for the remove-avatar button 492b43d

### Refactoring

* **landing-web:** remove the dev-only admin link and keep admin and API paths off the page bbcc8f0
* **web:** serve user and admin apps from a single origin 7a33d93
* **web:** switch admin and user apps to Tabler icons 6b2d8c7

### Documentation

* **dev:** document running the landing site locally 277fbc3

### Chores

* **dev:** run each app locally against dockerized infrastructure 31af8c4

## 2.0.0 (2026-11-08)

### Features

* **admin-web:** setup gate for Uptime Kuma, Grafana and mail (6fdf8d0)

## 1.13.0 (2026-11-08)

### Features

* **infra:** Docker Compose stack with single Nginx web container (cf08f12)

## 1.12.0 (2026-11-08)

### Features

* **admin-web:** broadcasts, preferences and login activity of all users (8abab0d)

## 1.11.0 (2026-11-06)

### Features

* **admin-web:** users, feature flags and monitoring pages (8bdcf6f)

## 1.10.0 (2026-11-06)

### Features

* **admin-web:** Angular application shell, layout and shared UI (4a82002)

## 1.9.0 (2026-11-06)

### Features

* **user-web:** profile with avatar and verified email change, login activity (b5ae621)

## 1.8.1 (2026-11-06)

### Documentation

* add README (e9e7067)

## 1.8.0 (2026-11-05)

### Features

* **user-web:** PDF template list, editor and builder canvas (530515c)

## 1.7.0 (2026-11-05)

### Features

* **user-web:** notifications and announcements (a91b096)

## 1.6.1 (2026-11-05)

### Tests

* add Playwright config, mobile and visual review checks (6d6088d)

## 1.6.0 (2026-11-05)

### Features

* **user-web:** campaign creation, sending and recipients (d336e9a)

## 1.5.0 (2026-11-04)

### Features

* **user-web:** data upload and mapping wizard (53886d7)

## 1.4.2 (2026-11-04)

### Tests

* add Playwright admin flows (6a17610)

## 1.4.1 (2026-11-04)

### Tests

* add Playwright user flows (3ca84ee)

## 1.4.0 (2026-11-04)

### Features

* **user-web:** SMTP connections and email template editor (e92ad64)

## 1.3.1 (2026-11-02)

### Tests

* **web:** add placeholder guard specs for both web apps (53d5b01)

## 1.3.0 (2026-11-02)

### Features

* **user-web:** login pages, projects list and project overview (050ee3b)

## 1.2.0 (2026-11-02)

### Features

* **user-web:** shared UI primitives and application layout (f4c3733)

## 1.1.0 (2026-11-02)

### Features

* **user-web:** shared UI package and Angular application shell (5ef513f)

## 1.0.0 (2026-11-01)

### Features

* **api:** compose all modules into the production server and end-to-end send pipeline (078abcf)

## 0.16.0 (2026-11-01)

### Features

* **admin:** broadcasts, integration setup gate and example project seed (d8423b2)

## 0.15.0 (2026-11-01)

### Features

* **account:** avatar upload, theme preferences, user notices and login activity (a36bb70)

## 0.14.0 (2026-10-31)

### Features

* **admin:** admin user management with disable and enable (ca7486c)

## 0.13.0 (2026-10-31)

### Features

* **observability:** Prometheus metrics, error reporting and OpenAPI reference (dad93cc)

## 0.12.0 (2026-10-31)

### Features

* **pdf:** PDF templates and PDFKit renderer (97e52ae)

## 0.11.0 (2026-10-29)

### Features

* **notifications:** project notifications with unread tracking (3d29beb)

## 0.10.1 (2026-10-29)

### Documentation

* add self-hosting guide (7a540a5)

## 0.10.0 (2026-10-29)

### Features

* **campaigns:** campaigns, recipients and retry flow (28c93c7)

## 0.9.0 (2026-10-29)

### Features

* **sending:** RabbitMQ queue and SMTP sending worker (e9631dc)

## 0.8.0 (2026-10-29)

### Features

* **templates:** column mapping and email templates with placeholder validation (39a0601)

## 0.7.0 (2026-10-28)

### Features

* **storage:** Garage object storage, data file uploads and attachments (f12196a)

## 0.6.1 (2026-10-28)

### Tests

* **api:** add end-to-end send pipeline test (505a03c)

## 0.6.0 (2026-10-28)

### Features

* **admin:** feature flags and system configuration (6d5e758)

## 0.5.0 (2026-10-28)

### Features

* **smtp:** encrypted SMTP connections with connection test (3ac46c8)

## 0.4.2 (2026-10-28)

### Chores

* **infra:** add Prometheus, Grafana and Garage configuration (609cafe)

## 0.4.1 (2026-10-27)

### Build

* **api:** add production Dockerfile and entrypoint (c103907)

## 0.4.0 (2026-10-27)

### Features

* **projects:** project CRUD with ownership checks and audit log (8a62eeb)

## 0.3.0 (2026-10-27)

### Features

* **auth:** Google sign-in with better-auth and session guard (359ad03)

## 0.2.1 (2026-10-27)

### Tests

* add Nginx, Prometheus and Grafana configuration checks (93f7975)

## 0.2.0 (2026-10-26)

### Features

* **api:** core library, configuration, error handling and database schema (6bd8935)

## 0.1.2 (2026-10-26)

### Build

* add Makefile with documented targets (d4635d4)

## 0.1.1 (2026-10-26)

### Documentation

* add license, code of conduct and security policy (0bd252b)

## 0.1.0 (2026-10-26)

### Features

* **workspace:** scaffold npm workspaces, tooling and shared package (0a09f0e)
