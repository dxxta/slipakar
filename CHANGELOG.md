# Changelog


## [3.2.0](https://github.com/dxxta/slipakar/compare/v3.1.3...v3.2.0) (2026-11-12)

### Features

* **admin-web:** broadcast delivery channel, masked user emails, row menus and badge dots ([5fd4cd0](https://github.com/dxxta/slipakar/commit/5fd4cd0ca1056e5c9fa044fdd3478d9fa536e7c4))
* **admin-web:** remove every Uptime Kuma reference from the admin app ([e835389](https://github.com/dxxta/slipakar/commit/e835389697f0651ff3a5c06cfce82526a5ee916f))
* **admin-web:** remove Uptime Kuma from the Setup page since it runs as a separate status deployment ([0bb544f](https://github.com/dxxta/slipakar/commit/0bb544f512e9a3ae2efc4c0632d6df6d6c7e71f3))
* **api:** add API keys for self-hosted integrations behind flags ([3a36c28](https://github.com/dxxta/slipakar/commit/3a36c281125dc3dba939326b9ad14e8c4bb87298))
* **auth-pages:** use the sidebar wordmark, an input group for the password and text links on sign-in ([d4964c7](https://github.com/dxxta/slipakar/commit/d4964c7e9a330545ac6bc6619479aad87c429f1d))
* **auth:** add credential login with sign-in methods on the profile page ([8047d69](https://github.com/dxxta/slipakar/commit/8047d69af911c924602d3484980858ed661d1e69))
* **auth:** add TOTP two-factor authentication ([7788b85](https://github.com/dxxta/slipakar/commit/7788b85f9197d889d73c32ea11a970b3c5c5d54d))
* **brand:** new S icon and wordmark, branding docs folder, release scripts and sign-in fixes ([a4342f2](https://github.com/dxxta/slipakar/commit/a4342f2e3a6ed947fb9a3a36f1dd57f79072c662))
* **dev:** add Mailpit to the local development infrastructure ([b342736](https://github.com/dxxta/slipakar/commit/b342736a480fcfc622dc1f1ca28acce904783ca7))
* **embed:** add flag-gated iframe embedding with launch tokens ([5c634b0](https://github.com/dxxta/slipakar/commit/5c634b0fc1a9c45f14211339a3d4e48958080c8e))
* **infra:** run Uptime Kuma as a separate status page stack and drop it from the app stack ([87669c5](https://github.com/dxxta/slipakar/commit/87669c514e0f6b706b9609039bb1c4ec087282fc))
* **landing:** add live Uptime Kuma status badge, dev.akarun.site footer credit and more ([19c5c9f](https://github.com/dxxta/slipakar/commit/19c5c9ff566ee524428e73c1c506f87b1720db61))
* **login-activity:** record browser location after sign-in ([4038547](https://github.com/dxxta/slipakar/commit/40385479dd46979bd91b4a2e644ea186a7df35d5))
* **web:** move short drawers to modals and add zoom to the login location map ([51c61da](https://github.com/dxxta/slipakar/commit/51c61da7883e25e498af45af19bc4457f974d270))

### Bug Fixes

* **admin-web:** close the setup drawer on save and remove its test button; toast appearance saves ([313205b](https://github.com/dxxta/slipakar/commit/313205bb373890fd7472c06ffa32198f5da14f8a))
* **api:** treat setup as complete once Grafana and Mail are connected ([060df0b](https://github.com/dxxta/slipakar/commit/060df0bdc2ad5b9bbb8d011707ff0cc69431eb52))
* **auth:** show Google sign-in errors in the web apps and keep returning Google logins working ([c0c4915](https://github.com/dxxta/slipakar/commit/c0c49159e52b7b971e7bde6d03478311d43d197c))
* **landing:** press buttons straight down into their shadow and match card press offsets ([21d761a](https://github.com/dxxta/slipakar/commit/21d761a39ee3a0acc2daf72dff043ad7c7bf69c8))
* **web:** make the embed frame-ancestors entrypoint executable and default it to none ([e9247eb](https://github.com/dxxta/slipakar/commit/e9247eb8d0d0240ace0a9952daf26ce3d879a397))

### Documentation

* add MVP demo screenshots for the user and admin apps ([1202e2a](https://github.com/dxxta/slipakar/commit/1202e2a3ad4345cb28dd8b572aa3f963f75c0b92))
* explain real client IP behind Traefik and Cloudflare ([b68a848](https://github.com/dxxta/slipakar/commit/b68a848b4b0f3e08246c63d21e94045a8be53c07))

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

## [3.1.2](https://github.com/dxxta/slipakar/compare/v3.1.1...v3.1.2) (2026-11-10)

### Features

* **admin-web:** add a shared ripple directive with click tooltips ([5ace35d](https://github.com/dxxta/slipakar/commit/5ace35d))
* **admin-web:** add a top loading bar driven by API requests ([5489fca](https://github.com/dxxta/slipakar/commit/5489fca))
* **admin-web:** add an icon-only back button ([2428649](https://github.com/dxxta/slipakar/commit/2428649))
* **admin-web:** add segmented pill tabs ([d6a8dbe](https://github.com/dxxta/slipakar/commit/d6a8dbe))
* **admin-web:** add sticky drawer footer slot ([b097f0b](https://github.com/dxxta/slipakar/commit/b097f0b))
* **admin-web:** align broadcasts page sizes, card tables on mobile and ripple ([fe1245d](https://github.com/dxxta/slipakar/commit/fe1245d))
* **admin-web:** align confirm modal control sizes ([1679370](https://github.com/dxxta/slipakar/commit/1679370))
* **admin-web:** align feature flags page sizes, card tables on mobile and ripple ([17c9b39](https://github.com/dxxta/slipakar/commit/17c9b39))
* **admin-web:** align list body action sizes ([576425c](https://github.com/dxxta/slipakar/commit/576425c))
* **admin-web:** align login activity page sizes, card tables on mobile and ripple ([1b386ce](https://github.com/dxxta/slipakar/commit/1b386ce))
* **admin-web:** align monitoring page sizes, card tables on mobile and ripple ([c191210](https://github.com/dxxta/slipakar/commit/c191210))
* **admin-web:** align page header ([3249254](https://github.com/dxxta/slipakar/commit/3249254))
* **admin-web:** align page state ripple and sizes ([b3e14e0](https://github.com/dxxta/slipakar/commit/b3e14e0))
* **admin-web:** align pagination spacing and sizes ([2c0953a](https://github.com/dxxta/slipakar/commit/2c0953a))
* **admin-web:** align preferences page sizes, card tables on mobile and ripple ([6abe770](https://github.com/dxxta/slipakar/commit/6abe770))
* **admin-web:** align select control height ([b2267f0](https://github.com/dxxta/slipakar/commit/b2267f0))
* **admin-web:** align setup page sizes, card tables on mobile and ripple ([6e19d5d](https://github.com/dxxta/slipakar/commit/6e19d5d))
* **admin-web:** align tabs ([a95e70b](https://github.com/dxxta/slipakar/commit/a95e70b))
* **admin-web:** align users page sizes, card tables on mobile and ripple ([d366faf](https://github.com/dxxta/slipakar/commit/d366faf))
* **admin-web:** broadcast drawers use the sticky footer for actions ([96d208b](https://github.com/dxxta/slipakar/commit/96d208b))
* **admin-web:** broadcasts page action becomes a 3-dot menu on mobile ([a8ed220](https://github.com/dxxta/slipakar/commit/a8ed220))
* **admin-web:** export back button and segmented tabs ([1fd24ea](https://github.com/dxxta/slipakar/commit/1fd24ea))
* **admin-web:** fixed collapsible icon sidebar and surface mobile header ([e137d10](https://github.com/dxxta/slipakar/commit/e137d10))
* **admin-web:** float the account menu above the sidebar with the theme toggle ([a2ff974](https://github.com/dxxta/slipakar/commit/a2ff974))
* **admin-web:** move the theme toggle into a menu item ([ba27f2b](https://github.com/dxxta/slipakar/commit/ba27f2b))
* **admin-web:** right-align row actions with icon set and solid variant ([c4ea218](https://github.com/dxxta/slipakar/commit/c4ea218))
* **admin-web:** setup drawer uses the sticky footer for actions ([6991ca4](https://github.com/dxxta/slipakar/commit/6991ca4))
* **admin-web:** stack list filters evenly on mobile ([4e81900](https://github.com/dxxta/slipakar/commit/4e81900))
* **admin-web:** users drawer uses the sticky footer for actions ([e8ac63f](https://github.com/dxxta/slipakar/commit/e8ac63f))
* **landing-web:** floating theme toggle ([e201057](https://github.com/dxxta/slipakar/commit/e201057))
* **landing-web:** palette, fonts and pressed directive ([be9c7c8](https://github.com/dxxta/slipakar/commit/be9c7c8))
* **landing-web:** playful redesign with chunky type, pill buttons and bold colour blocks ([c93a6c2](https://github.com/dxxta/slipakar/commit/c93a6c2))
* **landing-web:** refine playful landing design ([cc2cb0b](https://github.com/dxxta/slipakar/commit/cc2cb0b))
* **pdf:** add a resizable solid sheet element and a template name header card ([96d1d8a](https://github.com/dxxta/slipakar/commit/96d1d8a))
* **pdf:** show uploaded images in the editor, add print preview and fold the template name into the editor card ([2826599](https://github.com/dxxta/slipakar/commit/2826599))
* **theme:** tint surfaces, borders and muted colors with the chosen accent and fix accent swatch spacing ([29a10f6](https://github.com/dxxta/slipakar/commit/29a10f6))
* **user-web:** accent table headers, drawer footers, surface mobile header and card-style tables on mobile ([e010661](https://github.com/dxxta/slipakar/commit/e010661))
* **user-web:** add plus icons to new actions ([680f26b](https://github.com/dxxta/slipakar/commit/680f26b))
* **user-web:** add styled and unstyled appearance ([e364a60](https://github.com/dxxta/slipakar/commit/e364a60))
* **user-web:** align the sidebar toggle with the row-action button style ([2c0179f](https://github.com/dxxta/slipakar/commit/2c0179f))
* **user-web:** align theme tokens and fonts ([7f2a1c4](https://github.com/dxxta/slipakar/commit/7f2a1c4))
* **user-web:** card-per-row mobile tables with a main column, status aside and action button ([1428bd4](https://github.com/dxxta/slipakar/commit/1428bd4))
* **user-web:** customize per-theme base colors ([c31b0c9](https://github.com/dxxta/slipakar/commit/c31b0c9))
* **user-web:** mobile icon-only actions, desktop control sizes, even filters, scrollable summary cards and profile remove fix ([8b0e543](https://github.com/dxxta/slipakar/commit/8b0e543))
* **user-web:** put project tabs beside the back link and move detail back buttons next to page actions ([0748f63](https://github.com/dxxta/slipakar/commit/0748f63))
* **user-web:** top loading bar, two-column mobile tables and a shared ripple directive ([3c80083](https://github.com/dxxta/slipakar/commit/3c80083))
* **user-web:** upload images into PDF templates and use icon chips for new elements ([5a5501c](https://github.com/dxxta/slipakar/commit/5a5501c))
* **user-web:** use solid icon buttons to duplicate or delete a PDF node ([47c8b4b](https://github.com/dxxta/slipakar/commit/47c8b4b))

### Bug Fixes

* **admin-web:** keep drawer footers in their own blocks so they project into the footer ([e1fa27c](https://github.com/dxxta/slipakar/commit/e1fa27c))
* **api:** explain why an integration connection test failed ([bcc9061](https://github.com/dxxta/slipakar/commit/bcc9061))
* **landing-web:** audience cards, dark accent text, language tabs and section dividers ([939562a](https://github.com/dxxta/slipakar/commit/939562a))
* **landing-web:** remove open-source borders and keep ink borders on coloured blocks ([f2aab9f](https://github.com/dxxta/slipakar/commit/f2aab9f))
* **user-web:** apply content link styling inside layout ([80266c6](https://github.com/dxxta/slipakar/commit/80266c6))
* **user-web:** apply tactile styling to standalone buttons ([efc9269](https://github.com/dxxta/slipakar/commit/efc9269))
* **user-web:** drop the duplicate close button from detail drawers ([cf12b03](https://github.com/dxxta/slipakar/commit/cf12b03))
* **user-web:** keep accent swatches consistent across themes ([14fcc9b](https://github.com/dxxta/slipakar/commit/14fcc9b))
* **user-web:** keep content links readable across themes ([38b202b](https://github.com/dxxta/slipakar/commit/38b202b))
* **user-web:** keep page actions beside headings ([049b722](https://github.com/dxxta/slipakar/commit/049b722))
* **user-web:** keep sortable headers plain ([eea87e8](https://github.com/dxxta/slipakar/commit/eea87e8))
* **user-web:** let the pressed state win over hover on sidebar buttons ([0d0ac20](https://github.com/dxxta/slipakar/commit/0d0ac20))
* **user-web:** make avatar URL and Remove a true joined input group ([c7d7c0f](https://github.com/dxxta/slipakar/commit/c7d7c0f))
* **user-web:** make PDF editor chips quiet controls ([50a3ab2](https://github.com/dxxta/slipakar/commit/50a3ab2))
* **user-web:** make sidebar toggle and account button press like New project ([0b164bc](https://github.com/dxxta/slipakar/commit/0b164bc))
* **user-web:** match collapsed profile button radius to the sidebar toggle ([84a5604](https://github.com/dxxta/slipakar/commit/84a5604))
* **user-web:** remove logo ([eafb509](https://github.com/dxxta/slipakar/commit/eafb509))
* **user-web:** render accent swatches with real colors ([cceabc4](https://github.com/dxxta/slipakar/commit/cceabc4))
* **user-web:** render sortable column names as plain header text ([4a54ad7](https://github.com/dxxta/slipakar/commit/4a54ad7))
* **user-web:** restore lime accent and black third ([e343424](https://github.com/dxxta/slipakar/commit/e343424))
* **user-web:** restore pressed style on sidebar collapse button ([064f709](https://github.com/dxxta/slipakar/commit/064f709))
* **user-web:** restyle account menu actions ([d844dce](https://github.com/dxxta/slipakar/commit/d844dce))
* **user-web:** show unsaved changes beside the template name label ([1b4f328](https://github.com/dxxta/slipakar/commit/1b4f328))
* **user-web:** simplify account menu sign out ([55cdf97](https://github.com/dxxta/slipakar/commit/55cdf97))
* **user-web:** simplify dropdown menu rows ([81912e1](https://github.com/dxxta/slipakar/commit/81912e1))
* **user-web:** square sidebar navigation controls ([4f18b54](https://github.com/dxxta/slipakar/commit/4f18b54))
* **user-web:** unify avatar URL input group ([1d82c0c](https://github.com/dxxta/slipakar/commit/1d82c0c))
* **user-web:** wrap multi-line mobile table values below each other, right-aligned ([65a5b41](https://github.com/dxxta/slipakar/commit/65a5b41))

### Chores

* **infra:** allow Google Fonts in web CSP ([6176e5a](https://github.com/dxxta/slipakar/commit/6176e5a))

## [3.1.1](https://github.com/dxxta/slipakar/compare/v3.1.0...v3.1.1) (2026-11-10)

### Bug Fixes

* **user-web:** align delete modals, action menus, icon buttons and sidebar ([dd4729a](https://github.com/dxxta/slipakar/commit/dd4729a))

## [3.1.0](https://github.com/dxxta/slipakar/compare/v3.0.0...v3.1.0) (2026-11-10)

### Features

* **api:** seed a demo workspace at startup under a system owner ([bdb0b5f](https://github.com/dxxta/slipakar/commit/bdb0b5f))
* **setup:** preconfigure Grafana and Uptime Kuma through Docker ([335e7c4](https://github.com/dxxta/slipakar/commit/335e7c4))
* **ui:** add an extra-large avatar size ([26f3430](https://github.com/dxxta/slipakar/commit/26f3430))
* **user-web:** refresh layout, lists, forms and navigation ([4518808](https://github.com/dxxta/slipakar/commit/4518808))

### Tests

* **api:** prove the first admin claims the demo project once ([fce59e8](https://github.com/dxxta/slipakar/commit/fce59e8))

## [3.0.0](https://github.com/dxxta/slipakar/compare/v2.0.0...v3.0.0) (2026-11-10)

### ⚠ BREAKING CHANGES

* npm workspace packages move to the `@slipakar` scope, Prometheus metrics use the slipakar_ prefix, the Grafana dashboard, datasource and job are renamed, the browser theme storage key changes (the previous key is still read as a fallback), and the default PostgreSQL, RabbitMQ, S3 bucket and Compose project names change. Existing deployments keep their data by setting POSTGRES_USER, POSTGRES_DB, RABBITMQ_USER, S3_BUCKET and COMPOSE_PROJECT_NAME to the previous values; see the upgrade section in docs/SELF-HOSTING.md.

### Features

* **landing-web:** public Angular SSR landing site ([fdfb6e0](https://github.com/dxxta/slipakar/commit/fdfb6e0))
* rebrand to Slipakar ([403d037](https://github.com/dxxta/slipakar/commit/403d037))
* **ui:** align admin and user themes with the landing palette ([ef8416d](https://github.com/dxxta/slipakar/commit/ef8416d))

### Bug Fixes

* **user-web:** use the default size for the remove-avatar button ([492b43d](https://github.com/dxxta/slipakar/commit/492b43d))

### Refactoring

* **landing-web:** remove the dev-only admin link and keep admin and API paths off the page ([bbcc8f0](https://github.com/dxxta/slipakar/commit/bbcc8f0))
* **web:** serve user and admin apps from a single origin ([7a33d93](https://github.com/dxxta/slipakar/commit/7a33d93))
* **web:** switch admin and user apps to Tabler icons ([6b2d8c7](https://github.com/dxxta/slipakar/commit/6b2d8c7))

### Documentation

* **dev:** document running the landing site locally ([277fbc3](https://github.com/dxxta/slipakar/commit/277fbc3))

### Chores

* **dev:** run each app locally against dockerized infrastructure ([31af8c4](https://github.com/dxxta/slipakar/commit/31af8c4))

## 2.0.0 (2026-11-08)

### Features

* **admin-web:** setup gate for Uptime Kuma, Grafana and mail ([6fdf8d0](https://github.com/dxxta/slipakar/commit/6fdf8d0))

## 1.13.0 (2026-11-08)

### Features

* **infra:** Docker Compose stack with single Nginx web container ([cf08f12](https://github.com/dxxta/slipakar/commit/cf08f12))

## 1.12.0 (2026-11-08)

### Features

* **admin-web:** broadcasts, preferences and login activity of all users ([8abab0d](https://github.com/dxxta/slipakar/commit/8abab0d))

## 1.11.0 (2026-11-06)

### Features

* **admin-web:** users, feature flags and monitoring pages ([8bdcf6f](https://github.com/dxxta/slipakar/commit/8bdcf6f))

## 1.10.0 (2026-11-06)

### Features

* **admin-web:** Angular application shell, layout and shared UI ([4a82002](https://github.com/dxxta/slipakar/commit/4a82002))

## 1.9.0 (2026-11-06)

### Features

* **user-web:** profile with avatar and verified email change, login activity ([b5ae621](https://github.com/dxxta/slipakar/commit/b5ae621))

## 1.8.1 (2026-11-06)

### Documentation

* add README ([e9e7067](https://github.com/dxxta/slipakar/commit/e9e7067))

## 1.8.0 (2026-11-05)

### Features

* **user-web:** PDF template list, editor and builder canvas ([530515c](https://github.com/dxxta/slipakar/commit/530515c))

## 1.7.0 (2026-11-05)

### Features

* **user-web:** notifications and announcements ([a91b096](https://github.com/dxxta/slipakar/commit/a91b096))

## 1.6.1 (2026-11-05)

### Tests

* add Playwright config, mobile and visual review checks ([6d6088d](https://github.com/dxxta/slipakar/commit/6d6088d))

## 1.6.0 (2026-11-05)

### Features

* **user-web:** campaign creation, sending and recipients ([d336e9a](https://github.com/dxxta/slipakar/commit/d336e9a))

## 1.5.0 (2026-11-04)

### Features

* **user-web:** data upload and mapping wizard ([53886d7](https://github.com/dxxta/slipakar/commit/53886d7))

## 1.4.2 (2026-11-04)

### Tests

* add Playwright admin flows ([6a17610](https://github.com/dxxta/slipakar/commit/6a17610))

## 1.4.1 (2026-11-04)

### Tests

* add Playwright user flows ([3ca84ee](https://github.com/dxxta/slipakar/commit/3ca84ee))

## 1.4.0 (2026-11-04)

### Features

* **user-web:** SMTP connections and email template editor ([e92ad64](https://github.com/dxxta/slipakar/commit/e92ad64))

## 1.3.1 (2026-11-02)

### Tests

* **web:** add placeholder guard specs for both web apps ([53d5b01](https://github.com/dxxta/slipakar/commit/53d5b01))

## 1.3.0 (2026-11-02)

### Features

* **user-web:** login pages, projects list and project overview ([050ee3b](https://github.com/dxxta/slipakar/commit/050ee3b))

## 1.2.0 (2026-11-02)

### Features

* **user-web:** shared UI primitives and application layout ([f4c3733](https://github.com/dxxta/slipakar/commit/f4c3733))

## 1.1.0 (2026-11-02)

### Features

* **user-web:** shared UI package and Angular application shell ([5ef513f](https://github.com/dxxta/slipakar/commit/5ef513f))

## 1.0.0 (2026-11-01)

### Features

* **api:** compose all modules into the production server and end-to-end send pipeline ([078abcf](https://github.com/dxxta/slipakar/commit/078abcf))

## 0.16.0 (2026-11-01)

### Features

* **admin:** broadcasts, integration setup gate and example project seed ([d8423b2](https://github.com/dxxta/slipakar/commit/d8423b2))

## 0.15.0 (2026-11-01)

### Features

* **account:** avatar upload, theme preferences, user notices and login activity ([a36bb70](https://github.com/dxxta/slipakar/commit/a36bb70))

## 0.14.0 (2026-10-31)

### Features

* **admin:** admin user management with disable and enable ([ca7486c](https://github.com/dxxta/slipakar/commit/ca7486c))

## 0.13.0 (2026-10-31)

### Features

* **observability:** Prometheus metrics, error reporting and OpenAPI reference ([dad93cc](https://github.com/dxxta/slipakar/commit/dad93cc))

## 0.12.0 (2026-10-31)

### Features

* **pdf:** PDF templates and PDFKit renderer ([97e52ae](https://github.com/dxxta/slipakar/commit/97e52ae))

## 0.11.0 (2026-10-29)

### Features

* **notifications:** project notifications with unread tracking ([3d29beb](https://github.com/dxxta/slipakar/commit/3d29beb))

## 0.10.1 (2026-10-29)

### Documentation

* add self-hosting guide ([7a540a5](https://github.com/dxxta/slipakar/commit/7a540a5))

## 0.10.0 (2026-10-29)

### Features

* **campaigns:** campaigns, recipients and retry flow ([28c93c7](https://github.com/dxxta/slipakar/commit/28c93c7))

## 0.9.0 (2026-10-29)

### Features

* **sending:** RabbitMQ queue and SMTP sending worker ([e9631dc](https://github.com/dxxta/slipakar/commit/e9631dc))

## 0.8.0 (2026-10-29)

### Features

* **templates:** column mapping and email templates with placeholder validation ([39a0601](https://github.com/dxxta/slipakar/commit/39a0601))

## 0.7.0 (2026-10-28)

### Features

* **storage:** Garage object storage, data file uploads and attachments ([f12196a](https://github.com/dxxta/slipakar/commit/f12196a))

## 0.6.1 (2026-10-28)

### Tests

* **api:** add end-to-end send pipeline test ([505a03c](https://github.com/dxxta/slipakar/commit/505a03c))

## 0.6.0 (2026-10-28)

### Features

* **admin:** feature flags and system configuration ([6d5e758](https://github.com/dxxta/slipakar/commit/6d5e758))

## 0.5.0 (2026-10-28)

### Features

* **smtp:** encrypted SMTP connections with connection test ([3ac46c8](https://github.com/dxxta/slipakar/commit/3ac46c8))

## 0.4.2 (2026-10-28)

### Chores

* **infra:** add Prometheus, Grafana and Garage configuration ([609cafe](https://github.com/dxxta/slipakar/commit/609cafe))

## 0.4.1 (2026-10-27)

### Build

* **api:** add production Dockerfile and entrypoint ([c103907](https://github.com/dxxta/slipakar/commit/c103907))

## 0.4.0 (2026-10-27)

### Features

* **projects:** project CRUD with ownership checks and audit log ([8a62eeb](https://github.com/dxxta/slipakar/commit/8a62eeb))

## 0.3.0 (2026-10-27)

### Features

* **auth:** Google sign-in with better-auth and session guard ([359ad03](https://github.com/dxxta/slipakar/commit/359ad03))

## 0.2.1 (2026-10-27)

### Tests

* add Nginx, Prometheus and Grafana configuration checks ([93f7975](https://github.com/dxxta/slipakar/commit/93f7975))

## 0.2.0 (2026-10-26)

### Features

* **api:** core library, configuration, error handling and database schema ([6bd8935](https://github.com/dxxta/slipakar/commit/6bd8935))

## 0.1.2 (2026-10-26)

### Build

* add Makefile with documented targets ([d4635d4](https://github.com/dxxta/slipakar/commit/d4635d4))

## 0.1.1 (2026-10-26)

### Documentation

* add license, code of conduct and security policy ([0bd252b](https://github.com/dxxta/slipakar/commit/0bd252b))

## 0.1.0 (2026-10-26)

### Features

* **workspace:** scaffold npm workspaces, tooling and shared package ([0a09f0e](https://github.com/dxxta/slipakar/commit/0a09f0e))
