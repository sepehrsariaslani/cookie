import frappe
from frappe.model.document import Document


class SmuleStoreSettings(Document):
	def validate(self):
		if not self.online_orders_enabled:
			return

		if not self.company:
			frappe.throw("برای فعال‌کردن سفارش آنلاین، شرکت فروشنده را انتخاب کنید.")
		if not self.selling_price_list:
			frappe.throw("برای فعال‌کردن سفارش آنلاین، لیست قیمت فروش را انتخاب کنید.")
		if not self.automatic_pricing_enabled:
			frappe.throw("برای فعال‌کردن سفارش آنلاین، قانون قیمت‌گذاری خودکار را تأیید کنید.")
		if not self.material_cost_price_list:
			frappe.throw("لیست بهای خرید مواد را برای قیمت‌گذاری خودکار انتخاب کنید.")
		if self.markup_percentage is None or self.markup_percentage <= 0 or self.markup_percentage > 1000:
			frappe.throw("درصد افزوده روی هزینه را بین بیشتر از صفر تا ۱۰۰۰ وارد کنید.")
		if not self.price_rounding_increment or self.price_rounding_increment <= 0:
			frappe.throw("گام گردکردن قیمت باید بیشتر از صفر باشد.")
		if self.custom_cookie_fixed_cost is None or self.custom_cookie_fixed_cost < 0:
			frappe.throw("هزینهٔ ثابت ساخت و بسته‌بندی نمی‌تواند خالی یا منفی باشد.")
		if not self.custom_cookie_item or not frappe.db.get_value(
			"Item", {"name": self.custom_cookie_item, "disabled": 0, "is_sales_item": 1}, "name"
		):
			frappe.throw("کالای پایهٔ کوکی سفارشی را به‌عنوان کالای فعال و قابل فروش انتخاب کنید.")
		if not self.pickup_address and not self.delivery_enabled:
			frappe.throw("نشانی تحویل حضوری را ثبت کنید یا ارسال را فعال کنید.")
		if self.delivery_fee is not None and self.delivery_fee < 0:
			frappe.throw("هزینهٔ ارسال نمی‌تواند منفی باشد.")
		if self.delivery_enabled:
			if not self.delivery_fee_collection:
				frappe.throw("روش دریافت هزینهٔ اسنپ‌پیک را مشخص کنید.")
			if self.delivery_fee_collection == "افزودن به مبلغ زرین‌پال":
				if not self.delivery_fee or not self.delivery_charge_item:
					frappe.throw("برای افزودن هزینهٔ پیک به پرداخت، مبلغ ثابت و کالای هزینهٔ ارسال را مشخص کنید.")
				if not frappe.db.get_value("Item", {"name": self.delivery_charge_item, "disabled": 0, "is_sales_item": 1}, "name"):
					frappe.throw("کالای ارسال باید فعال و قابل فروش باشد.")
		if not self.zarinpal_enabled:
			frappe.throw("برای دریافت سفارش آنلاین، زرین‌پال را پس از تکمیل تنظیمات فعال کنید.")
		if not self.mode_of_payment or not self.payment_account:
			frappe.throw("روش پرداخت و حساب بانکی دریافت وجه را در ERPNext تنظیم کنید.")
		selling_price_list = frappe.db.get_value(
			"Price List", self.selling_price_list, ["currency", "selling"], as_dict=True
		)
		if not selling_price_list or not selling_price_list.selling or selling_price_list.currency != "IRR":
			frappe.throw("برای اتصال زرین‌پال، ارز لیست قیمت باید ریال (IRR) باشد.")
		material_price_list = frappe.db.get_value(
			"Price List", self.material_cost_price_list, ["currency", "buying"], as_dict=True
		)
		if not material_price_list or not material_price_list.buying or material_price_list.currency != "IRR":
			frappe.throw("لیست بهای مواد باید از نوع خرید و با ارز ریال (IRR) باشد.")
		if frappe.get_cached_value("Company", self.company, "default_currency") != "IRR":
			frappe.throw("برای اتصال زرین‌پال، ارز پیش‌فرض شرکت باید ریال (IRR) باشد.")
		account = frappe.db.get_value(
			"Account",
			self.payment_account,
			["company", "account_type", "account_currency", "is_group", "disabled"],
			as_dict=True,
		)
		if (
			not account
			or account.company != self.company
			or account.account_type not in {"Bank", "Cash"}
			or account.is_group
			or account.disabled
		):
			frappe.throw("حساب دریافت باید از نوع بانک یا وجه نقد و متعلق به شرکت فروشنده باشد.")
		if account.account_currency and account.account_currency != "IRR":
			frappe.throw("ارز حساب دریافت زرین‌پال باید ریال (IRR) باشد.")
		if not frappe.db.exists(
			"Mode of Payment Account",
			{"parent": self.mode_of_payment, "company": self.company, "default_account": self.payment_account},
		):
			frappe.throw("حساب بانکی را به همان روش پرداخت و شرکت در ERPNext وصل کنید.")
