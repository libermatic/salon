# Copyright (c) 2026, libermatic and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class SalonCommissionRule(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		disabled: DF.Check
		employee: DF.Link | None
		item: DF.Link | None
		priority: DF.Int
		rate_type: DF.Literal["Percentage", "Flat Amount"]
		rate_value: DF.Float
	# end: auto-generated types
	pass


def calculate_row_commission(employee: str, item: str, rate: float) -> float:
	rules = frappe.get_all(
		"Salon Commission Rule",
		filters={"disabled": 0},
		fields=["employee", "item", "rate_type", "rate_value", "priority"],
		order_by="priority desc, creation desc",
	)

	best_match = None

	for rule in rules:
		emp_match = rule.employee in (employee, None, "")
		item_match = rule.item in (item, None, "")

		if emp_match and item_match:
			# Score calculation:
			# 3: Specific Employee & Specific Item
			# 2: Specific Item Only
			# 1: Specific Employee Only
			# 0: Global Fallback (Wildcard)
			score = (2 if rule.employee == employee else 0) + (1 if rule.item == item else 0)

			if best_match is None or score > best_match["score"]:
				best_match = {"rule": rule, "score": score}

			if score == 3:
				break

	if not best_match:
		return 0.0

	rule = best_match["rule"]
	rate_value = frappe.utils.flt(rule.rate_value)  # pyright: ignore[reportAttributeAccessIssue]

	if rule.rate_type == "Percentage":
		return rate * (rate_value / 100.0)
	elif rule.rate_type == "Flat Amount":
		return rate_value

	return 0.0
