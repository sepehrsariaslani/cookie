"""Create clearly marked, editable starter Item records for Smule's storefront."""

import frappe


def _nutrition(calories, protein, carbs, fat, sugar):
	return {
		"smule_kcal_per_100g": calories,
		"smule_protein_per_100g": protein,
		"smule_carbs_per_100g": carbs,
		"smule_fat_per_100g": fat,
		"smule_sugar_per_100g": sugar,
	}


def _item(slug, name, kind, *, description="", ingredients="", allergens="", group="", grams=0,
		base_weight=0, nutrition=(0, 0, 0, 0, 0), visual_group="crumb", color="#c98955",
		serving="", not_included="", image=""):
	return {
		"slug": slug,
		"name": name,
		"kind": kind,
		"description": description,
		"ingredients": ingredients,
		"allergens": allergens,
		"group": group,
		"grams": grams,
		"base_weight": base_weight,
		"nutrition": nutrition,
		"visual_group": visual_group,
		"color": color,
		"serving": serving,
		"not_included": not_included,
		"image": image,
	}


# Values copied from the existing prototype are intentionally marked as samples.
# Product prices and product nutrition are left unset; add verified Item Prices later.
SAMPLE_CATALOG = [
	_item("vanilla", "وانیلی کلاسیک", "Dough", description="آرد گندم سفید؛ بافت ریز و کره‌ای", ingredients="آرد گندم، کره، تخم‌مرغ، وانیل", allergens="گلوتن، لبنیات، تخم‌مرغ", nutrition=(486, 6, 64, 21, 30), color="#fff3d8"),
	_item("cocoa", "کاکائویی خالص", "Dough", description="تمام خمیر، شکلاتی", ingredients="آرد گندم، کره، تخم‌مرغ، کاکائو", allergens="گلوتن، لبنیات، تخم‌مرغ", nutrition=(498, 7, 62, 24, 32), visual_group="chocolate", color="#74412e"),
	_item("marble", "ماربل وانیل و کاکائو", "Dough", description="رگه‌های دو خمیر در هم", ingredients="آرد گندم، کره، تخم‌مرغ، وانیل، کاکائو", allergens="گلوتن، لبنیات، تخم‌مرغ", nutrition=(492, 6, 63, 23, 31), color="#d4a16d"),
	_item("oat", "جو دوسر و عسل", "Dough", description="بافت دانه‌دار و ملایم", ingredients="جو دوسر، کره، عسل، تخم‌مرغ", allergens="جو دوسر، لبنیات، تخم‌مرغ", nutrition=(448, 8, 61, 18, 24), color="#d5b17a"),
	_item("banana-oat", "جو دوسر و موز", "Dough", description="موز رسیده در خود خمیر", ingredients="جو دوسر، موز، کره، تخم‌مرغ", allergens="جو دوسر، لبنیات، تخم‌مرغ", nutrition=(402, 7, 63, 13, 22), color="#d9b76e"),
	_item("date-cinnamon", "خرما و دارچین", "Dough", description="گرم و میوه‌ای، با عطر ادویه", ingredients="آرد گندم، خرما، دارچین، کره", allergens="گلوتن، لبنیات", nutrition=(435, 6, 67, 16, 29), color="#bb8050"),
	_item("whole-wheat", "گندم کامل", "Dough", description="سبوس‌دار، دانه‌ریز و برشته", ingredients="آرد گندم کامل، کره، شکر قهوه‌ای، تخم‌مرغ", allergens="گلوتن، لبنیات، تخم‌مرغ", nutrition=(455, 8, 61, 19, 24), color="#ac7e4e"),
	_item("sugar", "کره‌ای شکری", "Dough", description="خمیر لطیف با دانه‌های ریز شکر", ingredients="آرد گندم، کره، شکر، تخم‌مرغ، وانیل", allergens="گلوتن، لبنیات، تخم‌مرغ", nutrition=(498, 5, 68, 23, 35), color="#ead3a2"),
	_item("almond", "پایهٔ بادام", "Dough", description="آجیلی و لطیف؛ دستور نمونه", ingredients="آرد بادام، تخم‌مرغ، وانیل", allergens="مغز بادام، تخم‌مرغ", nutrition=(524, 12, 45, 34, 21), visual_group="nut", color="#dfbd91"),

	_item("banana", "موز", "Topping", description="رسیده و نرم", group="fruit", grams=6, nutrition=(89, 1, 23, 0, 12), color="#e1bd5f"),
	_item("raisin", "کشمش", "Topping", description="شیرین و جویدنی", group="fruit", grams=5, nutrition=(299, 3, 79, 1, 59), color="#63372a"),
	_item("date", "خرمای خردشده", "Topping", description="شیرینی میوه‌ای", group="fruit", grams=6, nutrition=(282, 2, 75, 0, 63), color="#805037"),
	_item("cranberry", "کرنبری خشک", "Topping", description="کمی ترش و میوه‌ای", group="fruit", grams=4, nutrition=(308, 0, 83, 1, 72), color="#9d3340"),
	_item("dark-chocolate", "شکلات تلخ", "Topping", description="عمیق و کم‌شیرین", group="chocolate", grams=6, nutrition=(598, 8, 46, 43, 24), visual_group="chocolate", color="#3a1d17"),
	_item("milk-chocolate", "شکلات شیری", "Topping", description="نرم و خامه‌ای", group="chocolate", grams=6, allergens="لبنیات", nutrition=(535, 7, 59, 30, 52), visual_group="chocolate", color="#80503b"),
	_item("white-chocolate", "شکلات سفید", "Topping", description="شیرین و لطیف", group="chocolate", grams=6, allergens="لبنیات", nutrition=(539, 6, 59, 32, 59), visual_group="chocolate", color="#f2dfbd"),
	_item("walnut", "گردو", "Topping", description="کمی تلخ و ترد", group="nuts", grams=4, allergens="مغز گردو", nutrition=(654, 15, 14, 65, 3), visual_group="nut", color="#9a6b43"),
	_item("pistachio", "پستهٔ خردشده", "Topping", description="سبز و خوش‌عطر", group="nuts", grams=4, allergens="مغز پسته", nutrition=(562, 20, 28, 45, 8), visual_group="nut", color="#83924d"),
	_item("almond", "بادام", "Topping", description="ترد و ملایم", group="nuts", grams=4, allergens="مغز بادام", nutrition=(579, 21, 22, 50, 4), visual_group="nut", color="#c29365"),
	_item("hazelnut", "فندق", "Topping", description="عطر آجیلی برشته", group="nuts", grams=4, allergens="مغز فندق", nutrition=(628, 15, 17, 61, 4), visual_group="nut", color="#956341"),
	_item("peanut-butter", "کرهٔ بادام‌زمینی", "Topping", description="مغزی و کرمی", group="creams", grams=5, allergens="بادام‌زمینی", nutrition=(588, 25, 20, 50, 9), visual_group="chocolate", color="#bd8550"),
	_item("pistachio-cream", "کرم پسته", "Topping", description="مرکز نرم و پسته‌ای", group="creams", grams=5, allergens="پسته؛ احتمال لبنیات، دستور نهایی لازم است", nutrition=(560, 12, 45, 38, 35), visual_group="chocolate", color="#a3a461"),
	_item("caramel", "کارامل", "Topping", description="مغزی شیرین و کش‌دار", group="creams", grams=6, allergens="وابسته به دستور نهایی", nutrition=(390, 2, 79, 8, 68), color="#c47b3c"),
	_item("cinnamon", "دارچین", "Topping", description="گرم و ادویه‌ای", group="flavor", grams=0.5, nutrition=(247, 4, 81, 1, 2), color="#a36d3d"),
	_item("sea-salt", "نمک دریا", "Topping", description="برای تعادل شیرینی", group="flavor", grams=0.3, nutrition=(0, 0, 0, 0, 0), visual_group="salt", color="#f2ecdf"),
	_item("vanilla", "وانیل", "Topping", description="عطر لطیف", group="flavor", grams=0.4, nutrition=(288, 0, 13, 0, 13), color="#e5c98f"),
	_item("orange-zest", "پوست پرتقال", "Topping", description="عطر مرکبات تازه", group="flavor", grams=1, nutrition=(97, 2, 25, 0, 0), color="#df913e"),
	_item("oat-flakes", "پرک جو دوسر", "Topping", description="بافت دانه‌دار", group="crunch", grams=5, allergens="جو دوسر", nutrition=(389, 17, 66, 7, 1), visual_group="nut", color="#d8bd91"),
	_item("sesame", "کنجد برشته", "Topping", description="ریز و خوش‌عطر", group="crunch", grams=3, allergens="کنجد", nutrition=(573, 18, 23, 50, 1), visual_group="nut", color="#d9c291"),

	_item("classic-chocolate", "کلاسیک شکلاتی", "Product", description="خمیر کره‌ای با تکه‌های شکلات تلخ و قلب نرم.", ingredients="آرد گندم، کره، شکر قهوه‌ای، شکلات تلخ", allergens="گلوتن، لبنیات", base_weight=110, serving="یک عدد · حدود ۱۱۰ گرم", not_included="گردو، دارچین", image="/assets/smule_store/site/images/smule-cookie-chocolate.png"),
	_item("sea-salt", "نمک دریا", "Product", description="شیرینی کنترل‌شده، شکلات عمیق و چند کریستال نمک.", ingredients="آرد گندم، کره، شکر قهوه‌ای، شکلات تلخ، نمک دریا", allergens="گلوتن، لبنیات", base_weight=112, serving="یک عدد · حدود ۱۱۲ گرم", not_included="گردو، کارامل", image="/assets/smule_store/site/images/smule-cookie-sea-salt.webp"),
	_item("cinnamon-caramel", "دارچین کارامل", "Product", description="عطر دارچین تازه با تکه‌های کارامل ترد و کش‌دار.", ingredients="آرد گندم، کره، شکر قهوه‌ای، دارچین، کارامل", allergens="گلوتن، لبنیات؛ دستور نهایی بررسی شود", base_weight=110, serving="یک عدد · حدود ۱۱۰ گرم", not_included="گردو، شکلات تلخ", image="/assets/smule_store/site/images/smule-cookie-cinnamon-caramel.webp"),
	_item("mini-box", "پک مینی اسموله", "Product", description="چهار طعم کوچک برای وقتی که انتخاب‌کردن سخت است.", ingredients="آرد گندم، کره، شکر قهوه‌ای، شکلات، گردو، کارامل", allergens="گلوتن، لبنیات، مغزها", base_weight=180, serving="یک پک چهارعددی · حدود ۱۸۰ گرم", not_included="—", image="/assets/smule_store/site/images/smule-cookie-mini-box.webp"),
]


def _ensure_sample_item_masters():
	if not frappe.db.exists("UOM", "Nos"):
		frappe.get_doc({"doctype": "UOM", "uom_name": "Nos", "must_be_whole_number": 0}).insert(
			ignore_permissions=True
		)

	root_group = "All Item Groups"
	if not frappe.db.exists("Item Group", root_group):
		frappe.get_doc(
			{"doctype": "Item Group", "item_group_name": root_group, "is_group": 1}
		).insert(ignore_permissions=True)

	store_group = "Smule Store"
	if not frappe.db.exists("Item Group", store_group):
		frappe.get_doc(
			{
				"doctype": "Item Group",
				"item_group_name": store_group,
				"parent_item_group": root_group,
				"is_group": 0,
			}
		).insert(ignore_permissions=True)
	return store_group


def seed_sample_catalog():
	"""Idempotently create sample Items; never overwrite a verified Item."""
	item_group = _ensure_sample_item_masters()
	stock_uom = "Nos"

	created = 0
	updated = 0
	skipped = 0
	for row in SAMPLE_CATALOG:
		matches = frappe.get_all(
			"Item",
			filters={"smule_slug": row["slug"], "smule_storefront_type": row["kind"]},
			fields=["name"],
			limit_page_length=2,
		)
		if len(matches) > 1:
			frappe.throw(f"شناسهٔ {row['slug']} روی بیش از یک کالا ثبت شده است.")
		if matches:
			if not frappe.db.get_value("Item", matches[0].name, "smule_recipe_is_sample"):
				skipped += 1
				continue
			doc = frappe.get_doc("Item", matches[0].name)
			updated += 1
		else:
			doc = frappe.new_doc("Item")
			doc.item_code = f"SM-{row['kind'].upper()}-{row['slug'].upper()}"[:140]
			doc.item_name = row["name"]
			doc.item_group = item_group
			doc.stock_uom = stock_uom
			doc.is_stock_item = 0
			doc.is_sales_item = int(row["kind"] == "Product")
			created += 1

		doc.disabled = 0
		doc.is_sales_item = int(row["kind"] == "Product")
		doc.smule_enabled_in_storefront = 1
		doc.smule_storefront_type = row["kind"]
		doc.smule_slug = row["slug"]
		doc.smule_display_name_fa = row["name"]
		doc.smule_description_fa = row["description"]
		doc.smule_serving_description_fa = row["serving"]
		doc.smule_category_fa = "کوکی" if row["kind"] == "Product" else ""
		doc.smule_ingredients_fa = row["ingredients"]
		doc.smule_not_included_fa = row["not_included"]
		doc.smule_component_group = row["group"]
		doc.smule_grams_per_50g = row["grams"]
		doc.smule_base_weight_grams = row["base_weight"]
		doc.smule_allergens_fa = row["allergens"]
		doc.smule_visual_group = row["visual_group"]
		doc.smule_visual_color = row["color"]
		doc.smule_recipe_is_sample = 1
		doc.image = row["image"]
		doc.update(_nutrition(*row["nutrition"]))
		if doc.is_new():
			doc.insert(ignore_permissions=True)
		else:
			doc.save(ignore_permissions=True)

	frappe.clear_cache()
	return {"created": created, "updated": updated, "verified_records_skipped": skipped}
