# Copyright (c) 2026, libermatic and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class SalonAppointment(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		from salon.salon.doctype.salon_appointment_item.salon_appointment_item import SalonAppointmentItem

		amended_from: DF.Link | None
		customer: DF.Link
		customer_mobile: DF.Data | None
		customer_name: DF.Data | None
		notes: DF.SmallText | None
		sales_invoice: DF.Link | None
		scheduled_time: DF.Datetime
		services: DF.Table[SalonAppointmentItem]
		status: DF.Literal["Booked", "In Progress", "Completed", "Cancelled", "No Show"]
		total_amount: DF.Currency
		total_duration: DF.Int
	# end: auto-generated types

	def validate(self):
		self.calculate_totals()

	def calculate_totals(self):
		total_dur = 0
		total_amt = 0.0
		for row in self.services:
			total_dur += row.duration_mins or 0
			total_amt += row.rate or 0
		self.total_duration = total_dur
		self.total_amount = total_amt
