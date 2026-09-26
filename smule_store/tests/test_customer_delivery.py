import unittest

from smule_store.domain.customer_delivery import customer_delivery_snapshot


class TestCustomerDeliverySnapshot(unittest.TestCase):
	def test_customer_request_details_are_preserved_with_native_delivery_status(self):
		self.assertEqual(
			customer_delivery_snapshot(
				request_method="ارسال",
				request_address="کرج، خیابان نمونه، پلاک ۱",
				sales_order_method="تحویل حضوری",
				sales_order_address="نشانی فروشگاه",
				delivery_status="Not Delivered",
			),
			{
				"deliveryMethod": "ارسال",
				"deliveryAddress": "کرج، خیابان نمونه، پلاک ۱",
				"deliveryStatus": "Not Delivered",
			},
		)

	def test_sales_order_details_are_used_when_request_link_is_missing(self):
		self.assertEqual(
			customer_delivery_snapshot(
				sales_order_method="تحویل حضوری",
				sales_order_address="نشانی ثبت‌شده در سفارش",
				delivery_status="Fully Delivered",
			),
			{
				"deliveryMethod": "تحویل حضوری",
				"deliveryAddress": "نشانی ثبت‌شده در سفارش",
				"deliveryStatus": "Fully Delivered",
			},
		)

	def test_missing_delivery_values_remain_empty_and_do_not_invent_status(self):
		self.assertEqual(
			customer_delivery_snapshot(),
			{"deliveryMethod": "", "deliveryAddress": "", "deliveryStatus": ""},
		)


if __name__ == "__main__":
	unittest.main()
