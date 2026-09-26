#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
storefront_dir="$(cd "${script_dir}/.." && pwd)"
repo_dir="$(cd "${storefront_dir}/.." && pwd)"
export_dir="${storefront_dir}/dist/client"
site_dir="${repo_dir}/smule_store/public/site"
prefixed_assets="${export_dir}/assets/smule_store/site"

if [[ ! -f "${export_dir}/index.html" ]]; then
  echo "Static export is missing: ${export_dir}/index.html. Build the storefront first." >&2
  exit 69
fi

if [[ ! -d "${prefixed_assets}/_next" ]]; then
  echo "Vinext assets are missing: ${prefixed_assets}/_next. Check storefront assetPrefix." >&2
  exit 69
fi

mkdir -p "${site_dir}"
rsync -a --exclude='/assets/smule_store/site/_next/***' "${export_dir}/" "${site_dir}/"
rsync -a "${prefixed_assets}/" "${site_dir}/"

stale_prefixed_assets="${site_dir}/assets/smule_store/site/_next"
if [[ -d "${stale_prefixed_assets}" ]]; then
	rm -rf "${stale_prefixed_assets}"
fi

echo "Synced static site and placed prefixed Vinext assets at ${site_dir}/_next."
