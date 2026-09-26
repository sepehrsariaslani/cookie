"""Validation and safe formatting for customer support requests."""

import html
import re


SUPPORT_TOPICS = {
	"محصول و ترکیبات",
	"حساسیت غذایی",
	"کوکی سفارشی",
	"سفارش و تحویل",
	"حریم خصوصی و اطلاعات من",
	"سایر پرسش‌ها",
}


def _clean_text(value, limit):
	if not isinstance(value, str):
		return ""
	value = value.replace("\r\n", "\n").replace("\r", "\n")
	value = "".join(char for char in value if char in "\n\t" or ord(char) >= 32 and ord(char) != 127)
	return value.strip()[:limit]


def normalize_support_submission(name, email, topic, message):
	"""Return bounded, validated values or raise ValueError with a customer-safe message."""
	name = _clean_text(name, 80)
	email = _clean_text(email, 254).lower()
	topic = _clean_text(topic, 80)
	message = _clean_text(message, 2000)

	if len(name) < 2:
		raise ValueError("نام را با دست‌کم دو نویسه وارد کن.")
	if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
		raise ValueError("نشانی ایمیل را درست وارد کن تا پاسخ به آن ارسال شود.")
	if topic not in SUPPORT_TOPICS:
		raise ValueError("موضوع پیام را از فهرست انتخاب کن.")
	if len(message) < 10:
		raise ValueError("پیامت را کمی کامل‌تر بنویس؛ دست‌کم ۱۰ نویسه لازم است.")

	return {"name": name, "email": email, "topic": topic, "message": message}


def format_support_description(submission):
	"""Format customer-provided values as escaped HTML for ERPNext's Issue editor."""
	name = html.escape(submission["name"])
	email = html.escape(submission["email"])
	topic = html.escape(submission["topic"])
	message = "<br>".join(html.escape(line) for line in submission["message"].split("\n"))
	return (
		f"<p><strong>نام:</strong> {name}</p>"
		f"<p><strong>ایمیل پاسخ:</strong> {email}</p>"
		f"<p><strong>موضوع:</strong> {topic}</p>"
		f"<p><strong>پیام:</strong><br>{message}</p>"
	)
