### Smule Store

Smule cookie storefront and ERPNext integration.

### Installation

You can install this app using the [bench](https://github.com/frappe/bench) CLI:

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch main
bench install-app smule_store
```

The app keeps ERPNext's native `Item`, `Item Price`, `Customer`, and `Sales Order` records authoritative. Its optional `seed_sample_catalog` command creates editable dough, topping, and product Items marked as unverified samples; it does not create prices or enable customer orders.

### Frappe Cloud installation

This repository is a custom app, not a Frappe Cloud Marketplace app. Frappe Cloud public bench groups allow Marketplace apps only, so install this app on a site attached to a private bench group. Add `https://github.com/sepehrsariaslani/cookie` from the bench group's Apps page using branch `main`, deploy the bench update, then install `smule_store` from the site's Apps page. The app declares compatibility with Frappe 16 in `pyproject.toml`.

### Smule site setup

1. Build the React/Vinext website (`output: "export"`), then run `bash storefront/scripts/sync-frappe-site.sh`. It copies the export into `smule_store/public/site/` and places Vinext's prefixed `_next` assets where Frappe serves `/assets/smule_store/site/_next/`.
2. Run `bench --site <site> clear-cache` so Frappe reloads the storefront route hooks.
3. Configure `Smule Store Settings`, create verified Item Prices, replace sample recipe/allergen data, and enter the pickup location and hours before enabling checkout.
4. For custom cookies, set each approved dough and topping's selling `Item Price` in `Gram`. The server prices the base and scaled toppings from those ERPNext rates; sample or unpriced recipes cannot be ordered.
5. Set the selling Price List and Company currency to `IRR`, choose a Bank/Cash Account and Mode of Payment, and save the ZarinPal merchant ID only in the encrypted Password field. Test in the ZarinPal sandbox first; live checkout remains disabled until sandbox mode is turned off and all required settings are valid. The callback requires a public HTTPS site.
6. To enable Snapp delivery in Karaj, choose whether its fee is paid separately to Snapp or added as a fixed ERPNext Item to the ZarinPal amount. Delivery stays unavailable until the fee policy is configured. Pickup address/hours and delivery policy are store-owned settings, not guessed defaults.
7. Checkout creates a submitted ERPNext Sales Order and native Payment Request. A native Payment Entry is created only after the server verifies the ZarinPal authority and exact stored Rial amount. Failed/uncertain callbacks never count as paid.

Customer registration follows Frappe's existing signup and outgoing-email settings; account pages use native ERPNext Customer, Address, Sales Order, and Payment Entry records.

Starter Items can be added using:

```bash
bench --site <site> execute smule_store.setup.install.after_install
bench --site <site> execute smule_store.setup.seed_catalog.seed_sample_catalog
```

### Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/smule_store
pre-commit install
```

Pre-commit is configured to use the following tools for checking and formatting your code:

- ruff
- eslint
- prettier
- pyupgrade

### License

mit
