import re

import frappe
from frappe.model.document import Document


class SmuleOrderRequest(Document):
	def validate(self):
		self.phone = re.sub(r"\D", "", self.phone or "")
		if len(self.phone) < 10 or len(self.phone) > 15:
			frappe.throw("شمارهٔ تماس معتبر نیست.")
		if len((self.customer_name or "").strip()) < 2:
			frappe.throw("نام مشتری را کامل وارد کنید.")
		if not self.items:
			frappe.throw("درخواست باید دست‌کم یک قلم داشته باشد.")
		if self.delivery_method == "ارسال" and len((self.delivery_address or "").strip()) < 8:
			frappe.throw("برای ارسال، شهر و نشانی کامل لازم است.")

		subtotal = 0
		needs_quote = False
		for row in self.items:
			if row.qty < 1 or row.qty > 20:
				frappe.throw("تعداد هر قلم باید بین ۱ تا ۲۰ باشد.")
			if row.line_type == "کوکی آماده" and not row.item_code:
				frappe.throw("برای کوکی آماده، کالای ERPNext الزامی است.")
			if row.line_type == "کوکی سفارشی" and not row.recipe_json:
				frappe.throw("مشخصات کوکی سفارشی ناقص است.")
			needs_quote = needs_quote or bool(row.quote_required)
			subtotal += (row.unit_price or 0) * row.qty

		self.ready_subtotal = subtotal
		if self.status not in {"تبدیل به سفارش فروش", "ردشده"}:
			self.status = "نیازمند قیمت‌گذاری" if needs_quote else "جدید"
