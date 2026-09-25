### Smule Store

Smule cookie storefront and ERPNext integration.

### Installation

You can install this app using the [bench](https://github.com/frappe/bench) CLI:

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch version-16
bench install-app smule_store
```

The app keeps ERPNext's native `Item`, `Item Price`, `Customer`, and `Sales Order` records authoritative. Its optional `seed_sample_catalog` command creates editable dough, topping, and product Items marked as unverified samples; it does not create prices or enable customer orders.

### Smule site setup

1. Export the React/Vinext website as static files (`output: "export"`) and place the contents of its `dist/client` directory in `smule_store/public/site/`. The export must use `/assets/smule_store/site` as its static asset prefix.
2. Run `bench --site <site> clear-cache` so Frappe reloads the storefront route hooks.
3. Configure `Smule Store Settings`, create verified Item Prices, replace sample recipe/allergen data, and set pickup details before enabling order requests.
4. Configure Company, selling price list, and the custom-cookie Item before converting reviewed requests into native draft Sales Orders. Payment remains separate until the merchant chooses and configures a gateway.

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
