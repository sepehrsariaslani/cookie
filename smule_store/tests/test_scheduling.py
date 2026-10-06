import unittest

from smule_store.domain.scheduling import normalize_coordinates, normalize_requested_schedule


class TestRequestedSchedule(unittest.TestCase):
	def test_allows_a_future_date_and_normalizes_time(self):
		self.assertEqual(
			normalize_requested_schedule("2026-09-28", "۰۹:۳۰", "2026-09-26"),
			("2026-09-28", "09:30:00"),
		)
		self.assertEqual(
			normalize_requested_schedule("2026-09-28", "09:30:00", "2026-09-26"),
			("2026-09-28", "09:30:00"),
		)

	def test_allows_as_soon_as_possible_without_a_requested_slot(self):
		self.assertEqual(normalize_requested_schedule("", "", "2026-09-26"), (None, None))

	def test_rejects_past_date_and_time_without_date(self):
		with self.assertRaises(ValueError):
			normalize_requested_schedule("2026-09-25", "", "2026-09-26")
		with self.assertRaises(ValueError):
			normalize_requested_schedule("", "10:00", "2026-09-26")

	def test_rejects_invalid_time(self):
		with self.assertRaises(ValueError):
			normalize_requested_schedule("2026-09-27", "24:10", "2026-09-26")

	def test_rejects_past_or_current_time_on_the_same_day(self):
		for requested_time in ("14:29", "14:30"):
			with self.subTest(requested_time=requested_time), self.assertRaisesRegex(ValueError, "از زمان فعلی"):
				normalize_requested_schedule("2026-09-26", requested_time, "2026-09-26", "14:30:00")

	def test_accepts_future_time_on_the_same_day(self):
		self.assertEqual(
			normalize_requested_schedule("2026-09-26", "۱۴:۳۱", "2026-09-26", "14:30:00"),
			("2026-09-26", "14:31:00"),
		)


class TestDeliveryCoordinates(unittest.TestCase):
	def test_accepts_and_normalizes_valid_coordinates(self):
		self.assertEqual(normalize_coordinates("۳۵.۷", "۵۱.۴"), (35.7, 51.4))

	def test_rejects_partial_and_out_of_range_coordinates(self):
		with self.assertRaises(ValueError):
			normalize_coordinates("35.7", "")
		with self.assertRaises(ValueError):
			normalize_coordinates("91", "51")


if __name__ == "__main__":
	unittest.main()
