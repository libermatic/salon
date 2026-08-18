# Copyright (c) 2026, libermatic and contributors
# For license information, please see license.txt

import frappe
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

	def on_cancel(self):
		self.cancel_sales_invoice()

	def cancel_sales_invoice(self):
		if self.sales_invoice:
			si = frappe.get_doc("Sales Invoice", self.sales_invoice)
			if si.docstatus == 1:
				si.cancel()
			self.db_set("sales_invoice", None)

	@frappe.whitelist()
	def make_sales_invoice(self, mode_of_payment, paid_amount=None):
		if self.sales_invoice:
			frappe.throw(f"Sales Invoice {self.sales_invoice} already exists for this appointment.")

		paid_amount = frappe.utils.flt(paid_amount) or frappe.utils.flt(self.total_amount)  # pyright: ignore[reportAttributeAccessIssue]

		items = []
		for service in self.services:
			items.append(
				{
					"item_code": service.item_code,
					"qty": 1,
					"rate": service.rate,
					"description": service.service_name or service.item_code,
				}
			)

		si = frappe.get_doc(
			{
				"doctype": "Sales Invoice",
				"customer": self.customer,
				"posting_date": frappe.utils.today(),  # pyright: ignore[reportAttributeAccessIssue]
				"due_date": frappe.utils.today(),  # pyright: ignore[reportAttributeAccessIssue]
				"is_pos": 1,
				"items": items,
				"payments": [
					{
						"mode_of_payment": mode_of_payment,
						"amount": paid_amount,
					}
				],
				"remarks": f"Generated from Salon Appointment: {self.name}",
			}
		)

		si.insert(ignore_permissions=True)
		si.submit()

		self.db_set("sales_invoice", si.name)

		return si.name
