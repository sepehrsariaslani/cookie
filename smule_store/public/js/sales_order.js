frappe.ui.form.on("Sales Order", {
	refresh(frm) {
		if (frm.doc.docstatus !== 1 || !frm.doc.items?.some((row) => row.smule_cookie_recipe_json)) return;

		frm.add_custom_button("پیش‌نمایش و ساخت دستورکار کوکی", () => {
			frappe.call({
				method: "smule_store.api.manufacturing.get_custom_cookie_work_order_preview",
				args: { sales_order: frm.doc.name },
				freeze: true,
				freeze_message: __("در حال بررسی دستور، انبار و موجودی…"),
				callback(response) {
					const preview = response.message;
					if (!preview) return;

					const html = renderPreview(preview);
					if (!preview.ready) {
						frappe.msgprint({
							title: __("ساخت دستورکار فعلاً ممکن نیست"),
							indicator: "orange",
							message: html,
						});
						return;
					}

					if (preview.lines.every((line) => line.alreadyCreated)) {
						frappe.msgprint({
							title: __("دستورکار قبلاً ساخته شده است"),
							indicator: "green",
							message: html,
						});
						return;
					}

					frappe.confirm(
						html + `<p><strong>${escapeHtml("با تأیید شما، مواد از انبار مبدا به انبار در جریان تولید منتقل می‌شود.")}</strong></p>`,
						() => {
							frappe.call({
								method: "smule_store.api.manufacturing.create_custom_cookie_work_orders",
								args: { sales_order: frm.doc.name },
								freeze: true,
								freeze_message: __("در حال ساخت BOM، دستورکار و انتقال مواد در ERPNext…"),
								callback(result) {
									if (!result.message) return;
									frappe.msgprint({
										title: __("دستورکار و انتقال مواد ثبت شد"),
										indicator: "green",
										message: renderCreatedDocuments(result.message.workOrders),
									});
									frm.reload_doc();
								},
							});
						},
					);
				},
			});
		}, __("تولید"));
	},
});

function escapeHtml(value) {
	return frappe.utils.escape_html(String(value ?? ""));
}

function formatQuantity(value) {
	const number = Number(value);
	return Number.isFinite(number) ? frappe.format(number, { fieldtype: "Float", precision: 6 }) : "—";
}

function renderPreview(preview) {
	const warehouses = `<p><strong>${escapeHtml("مبدا")}</strong>: ${escapeHtml(preview.sourceWarehouse || "—")}
		· <strong>${escapeHtml("در جریان تولید")}</strong>: ${escapeHtml(preview.wipWarehouse || "—")}
		· <strong>${escapeHtml("محصول نهایی")}</strong>: ${escapeHtml(preview.fgWarehouse || "—")}</p>`;
	const lines = (preview.lines || []).map((line) => {
		const materials = (line.materials || []).map((material) => `<li>
			${escapeHtml(material.name || material.itemCode)}
			(${escapeHtml(material.itemCode)}): ${formatQuantity(material.qtyGrams)} g
			${material.qtyStock == null ? "" : `· ${formatQuantity(material.qtyStock)} ${escapeHtml(material.stockUom)}`}
			${material.availableStockQty == null ? "" : `· ${escapeHtml("موجود آزاد")}: ${formatQuantity(material.availableStockQty)} ${escapeHtml(material.stockUom)}`}
		</li>`).join("");
		const status = line.alreadyCreated ? ` · ${escapeHtml("قبلاً ساخته شده")}` : "";
		return `<section><h4>${escapeHtml(line.itemName)} · ${escapeHtml(line.salesOrderItem)} × ${formatQuantity(line.qty)}${status}</h4><ul>${materials}</ul></section>`;
	}).join("");
	const blockers = (preview.blockers || []).length
		? `<div class="text-danger"><strong>${escapeHtml("موارد نیازمند اصلاح")}</strong><ul>${preview.blockers.map((blocker) => `<li>${escapeHtml(blocker)}</li>`).join("")}</ul></div>`
		: "";
	return `<div dir="rtl">${warehouses}${lines}${blockers}</div>`;
}

function renderCreatedDocuments(workOrders) {
	const links = (workOrders || []).map((row) => {
		const workOrder = `<a href="/app/work-order/${encodeURIComponent(row.workOrder)}">${escapeHtml(row.workOrder)}</a>`;
		const transfer = `<a href="/app/stock-entry/${encodeURIComponent(row.stockEntry)}">${escapeHtml(row.stockEntry)}</a>`;
		return `<li>${escapeHtml(row.salesOrderItem)}: ${workOrder} · ${transfer}${row.alreadyCreated ? ` (${escapeHtml("موجود")})` : ""}</li>`;
	}).join("");
	return `<div dir="rtl"><p>${escapeHtml("مواد به انبار در جریان تولید منتقل شد. ثبت تولید نهایی را بعداً از خود دستورکار انجام دهید.")}</p><ul>${links}</ul></div>`;
}
