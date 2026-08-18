# Copyright (c) 2026, libermatic and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class SalonAppointmentItem(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		duration_mins: DF.Int
		item_code: DF.Link
		parent: DF.Data
		parentfield: DF.Data
		parenttype: DF.Data
		rate: DF.Currency
		service_name: DF.Data | None
		stylist: DF.Link | None
	# end: auto-generated types
	pass
