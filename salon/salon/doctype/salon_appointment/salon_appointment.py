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
		if not self.services:
			frappe.throw("Cannot create an appointment without service items.")
		if not self.status:
			self.status = "Booked"
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
		self.update_appointment_status("Cancelled")
		self.cancel_sales_invoice()
		self.cancel_additional_salaries()

	def cancel_sales_invoice(self):
		if self.sales_invoice:
			si = frappe.get_doc("Sales Invoice", self.sales_invoice)
			if si.docstatus == 1:
				si.cancel()
			self.db_set("sales_invoice", None)

	def cancel_additional_salaries(self):
		salaries = frappe.get_all(
			"Additional Salary",
			filters={
				"ref_doctype": self.doctype,
				"ref_docname": self.name,
				"docstatus": 1,
			},
			pluck="name",
		)

		for salary_name in salaries:
			doc = frappe.get_doc("Additional Salary", salary_name)
			doc.flags.ignore_permissions = True
			doc.cancel()

	@frappe.whitelist()
	def update_appointment_status(self, target_status):
		ALLOWED_TRANSITIONS = {
			"Booked": ["In Progress", "Cancelled", "No Show"],
			"In Progress": ["Completed", "Cancelled", "No Show"],
			"Completed": ["Cancelled"],
			"Cancelled": [],
			"No Show": ["Booked", "Cancelled"],
		}

		current_status = self.status or "Booked"

		if target_status not in ALLOWED_TRANSITIONS.get(current_status, []):
			frappe.throw(f"Cannot transition status from '{current_status}' to '{target_status}'.")

		if target_status == "Completed":
			self.validate_stylist_assignment()

			if not self.sales_invoice:
				frappe.throw("Please create a Sales Invoice before completing the appointment.")

		self.db_set("status", target_status)

		if target_status == "Completed":
			self.create_stylist_commissions()

		return self.status

	@frappe.whitelist()
	def reschedule_appointment(self, target_time):
		if self.status != "No Show":
			frappe.throw("Rescheduling is only allowed for 'No Show' appointments.")

		self.db_set("scheduled_time", target_time)
		self.update_appointment_status("Booked")

		return self.status

	def validate_stylist_assignment(self):
		missing_stylist_rows = []
		for idx, row in enumerate(self.services, start=1):
			if not row.stylist:
				missing_stylist_rows.append(str(idx))

		if missing_stylist_rows:
			frappe.throw(
				f"Please assign a stylist for service row(s): {', '.join(missing_stylist_rows)} before completing the appointment."
			)

	def create_stylist_commissions(self):
		settings = frappe.get_single("Salon Settings")
		salary_component = getattr(settings, "salary_component", None)
		commission_pct = frappe.utils.flt(getattr(settings, "commission_percentage", 0))  # pyright: ignore[reportAttributeAccessIssue]

		if not salary_component:
			frappe.throw("Missing Salary Component in Salon Settings")

		if commission_pct <= 0:
			return

		stylist_totals = {}
		for row in self.services:
			if row.stylist and row.rate:
				stylist_totals[row.stylist] = stylist_totals.get(row.stylist, 0.0) + frappe.utils.flt(  # pyright: ignore[reportAttributeAccessIssue]
					row.rate
				)

		for stylist, total_service_amount in stylist_totals.items():
			commission_amount = total_service_amount * (commission_pct / 100.0)

			if commission_amount <= 0:
				continue

			company = frappe.db.get_value("Employee", stylist, "company")

			add_sal = frappe.get_doc(
				{
					"doctype": "Additional Salary",
					"employee": stylist,
					"salary_component": salary_component,
					"amount": commission_amount,
					"payroll_date": frappe.utils.getdate(self.scheduled_time),  # pyright: ignore[reportAttributeAccessIssue]
					"company": company,
					"overwrite_salary_structure_amount": 0,
					"ref_doctype": self.doctype,
					"ref_docname": self.name,
				}
			)
			add_sal.insert(ignore_permissions=True)
			add_sal.submit()

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
