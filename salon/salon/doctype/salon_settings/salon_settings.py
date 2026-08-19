# Copyright (c) 2026, libermatic and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class SalonSettings(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		commission_percentage: DF.Percent
		end_time: DF.Time | None
		salary_component: DF.Link | None
		slot_duration: DF.Int
		start_time: DF.Time | None
	# end: auto-generated types
	pass
