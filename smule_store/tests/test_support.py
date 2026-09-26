import unittest

from smule_store.domain.support import (
	SUPPORT_TOPICS,
	format_support_description,
	normalize_support_submission,
)


class TestSupportSubmission(unittest.TestCase):
	def test_normalizes_valid_submission_and_bounds_each_field(self):
		result = normalize_support_submission(
			"  سپهر  ",
			"  Sepehr@example.com ",
			"محصول و ترکیبات",
			"  دربارهٔ کوکی شکلاتی سؤال دارم.  ",
		)
		self.assertEqual(result["name"], "سپهر")
		self.assertEqual(result["email"], "sepehr@example.com")
		self.assertEqual(result["message"], "دربارهٔ کوکی شکلاتی سؤال دارم.")
		self.assertEqual(len(normalize_support_submission("نام کاربر" * 20, "a@example.com", "سایر پرسش‌ها", "این پیام برای بررسی کافی است.")["name"]), 80)

	def test_rejects_invalid_or_unsupported_fields(self):
		invalid = [
			("ا", "a@example.com", "سایر پرسش‌ها", "این یک پیام معتبر برای پشتیبانی است."),
			("نام", "not-an-email", "سایر پرسش‌ها", "این یک پیام معتبر برای پشتیبانی است."),
			("نام", "a@example.com", "موضوع ساختگی", "این یک پیام معتبر برای پشتیبانی است."),
			("نام", "a@example.com", "سایر پرسش‌ها", "کوتاه"),
		]
		for values in invalid:
			with self.subTest(values=values), self.assertRaises(ValueError):
				normalize_support_submission(*values)
		self.assertGreaterEqual(len(SUPPORT_TOPICS), 5)

	def test_customer_markup_is_escaped_before_it_reaches_issue_html(self):
		submission = normalize_support_submission(
			"<script>alert(1)</script>",
			"safe@example.com",
			"سایر پرسش‌ها",
			"متن <img src=x onerror=alert(1)>\nخط دوم",
		)
		description = format_support_description(submission)
		self.assertNotIn("<script>", description)
		self.assertNotIn("<img", description)
		self.assertIn("&lt;script&gt;", description)
		self.assertIn("<br>", description)


if __name__ == "__main__":
	unittest.main()
