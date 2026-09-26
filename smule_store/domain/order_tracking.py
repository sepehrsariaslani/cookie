"""High-entropy bearer tokens for privacy-preserving guest order tracking."""

import hashlib
import re
import secrets


_TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9_-]{43}$")


def hash_tracking_token(token):
	"""Validate and hash one URL-safe 256-bit token without retaining its value."""
	if not isinstance(token, str) or not _TOKEN_PATTERN.fullmatch(token):
		raise ValueError("پیوند پیگیری معتبر نیست.")
	return hashlib.sha256(token.encode("ascii")).hexdigest()


def create_tracking_token():
	"""Return a new private token and the only value that should be persisted."""
	token = secrets.token_urlsafe(32)
	return token, hash_tracking_token(token)
