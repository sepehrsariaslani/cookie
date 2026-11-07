# Smule Store on erpyar.ir Implementation Plan

> **For agentic workers:** Execute the checklist in order. The user has approved the design and implementation in this conversation.

**Goal:** Install the existing Smule storefront app on the ERPNext site for erpyar.ir so `/` shows the store and `/desk` opens ERPNext Desk.

**Architecture:** Add the existing Frappe app `smule_store` to the self-hosted Docker bench, install it on internal site `boller.ir` (the configured target for `erpyar.ir`), and serve its checked-in static export from `public/site`. Use the app's APIs and native ERPNext records for commerce, and set Frappe's Website Settings home page to `smule_storefront` during installation and migrations.

**Tech Stack:** Docker Compose, Frappe 16, ERPNext 16, Python 3.14+, React 19, Next.js 16/Vinext static export.

**Implementation status:** The source compatibility and homepage changes are published to GitHub `main`. The app is present at `apps/smule_store`; deployment registration and install target are the local Docker bench and site `boller.ir`.

## Global Constraints

- Preserve the existing storefront UI and assets from the repository.
- `https://erpyar.ir/` must show the store and `https://erpyar.ir/desk` must remain ERPNext Desk.
- Keep ERPNext's native `Item`, `Item Price`, `Customer`, `Sales Order`, `Payment Request`, and `Payment Entry` authoritative.
- Do not activate real payments until the store's prices, company, currency, payment account, pickup/delivery details, and ZarinPal configuration are supplied.
- The Frappe Cloud custom app must declare its compatible Frappe version in `pyproject.toml`.
- The current repository branch is `main`; there is no `version-16` branch.
- The public domains `erpyar.ir` and `www.erpyar.ir` are mapped to the internal Frappe site `boller.ir`.

---

### Task 1: Declare Frappe Cloud compatibility and correct install instructions

**Files:**
- Modify: `pyproject.toml`
- Modify: `README.md`

**Interfaces:**
- Produces: Frappe Cloud can identify this app as compatible with Frappe 16, and the documented install source points to the existing `main` branch.

- [x] Add the Frappe dependency range under `[tool.bench.frappe-dependencies]`:

```toml
[tool.bench.frappe-dependencies]
frappe = ">=16.0.0-dev,<17.0.0"
```

- [x] Change the Bench install command in `README.md` from `--branch version-16` to `--branch main`.
- [x] Add a Frappe Cloud note explaining that the app must first be added to the site's private bench group, deployed to that bench, then installed from the site's Apps page; public bench sites accept marketplace apps only.
- [x] Keep the existing payment configuration requirements visible in the Cloud install notes.

### Task 2: Make the approved storefront homepage setting effective

**Files:**
- Modify: `smule_store/setup/install.py`

**Interfaces:**
- Produces: `after_install()` and `after_migrate()` set Website Settings `home_page` to `smule_storefront` for the site where the app is installed.

- [x] Add a small helper that loads Website Settings, sets `home_page = "smule_storefront"`, and saves with `ignore_permissions=True` only when the value differs.
- [x] Call the helper from both `after_install()` and `after_migrate()` so an existing `login` or other home page cannot prevent the approved storefront route from becoming primary.
- [x] Preserve custom field synchronization and cache clearing in both hooks.

### Task 3: Register the app in the self-hosted Docker bench

**Files:**
- Modify: `/home/sepehr/den-v16-docker/Dockerfile`
- Modify: `/home/sepehr/den-v16-docker/apps/link_runtime_apps.sh`
- Runtime manifest: `/home/sepehr/den-v16-docker/runtime/sites/apps.txt`

**Interfaces:**
- Consumes: source at `/home/sepehr/den-v16-docker/apps/smule_store`.
- Produces: Python can import `smule_store`, Bench lists the app, and image builds include its public assets.

- [ ] Include `smule_store` in Dockerfile's app copy list and `bench build --apps` list.
- [ ] Include `smule_store` in the runtime linker loop so it is appended to `sites/apps.txt` and the environment's `.pth` file.
- [ ] Run the runtime linker in the existing backend container and confirm `smule_store` appears in Bench's available app list.

### Task 4: Back up and install on the mapped site

**Files:**
- Create: timestamped Bench database and files backup for `/home/frappe/frappe-bench/sites/boller.ir`
- Modify: `boller.ir` database through Bench install/migrate hooks

**Interfaces:**
- Consumes: app registration from Task 3 and existing site `boller.ir`.
- Produces: `smule_store` installed only on `boller.ir`; hooks set `Website Settings.home_page` and create custom fields.

- [ ] Create and confirm a site backup before installing.
- [ ] Run `bench --site boller.ir install-app smule_store`.
- [ ] Build app assets, migrate the site, and clear website/cache data.
- [ ] Leave real ZarinPal payment disabled while business settings, verified prices, accounts, and credentials are missing.
- [ ] Do not seed sample catalog records into production without the user's request.

### Task 5: Check the live domain and Desk

**Files:**
- No repository files; inspect the site through the existing Docker backend and public domain.

**Interfaces:**
- Produces: the existing domain serves the store at `/`, with Desk available at `/desk`.

- [ ] Clear the site's cache after installation and migration.
- [ ] Check the homepage, a storefront page, and `/desk` on `https://erpyar.ir`.
- [ ] Confirm referenced `/assets/smule_store/site/_next/...` assets load and the checkout stays blocked until prices and payment settings are configured.
- [ ] Report any Frappe Cloud bench restriction or missing business configuration without guessing values.
