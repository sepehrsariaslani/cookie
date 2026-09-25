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
		if not self.pickup_address and not self.delivery_enabled:
			frappe.throw("نشانی تحویل حضوری را ثبت کنید یا ارسال را فعال کنید.")
		if self.delivery_fee is not None and self.delivery_fee < 0:
			frappe.throw("هزینهٔ ارسال نمی‌تواند منفی باشد.")
