import frappe
from erpnext.accounts.doctype.sales_invoice.sales_invoice import SalesInvoice as BaseSalesInvoice

# TODO: in v16, there is a field dont_create_loyalty_points
# use this and refactor before migrate

class SalesInvoice(BaseSalesInvoice):
	def validate(self):
		for item in self.items:
			program = frappe.db.get_value("Loyalty Program", {"package_item": item.item_code}, "name")
			if program:
				if item.qty != 1:
					frappe.throw(f"Loyalty package: {item.item_name} qty must be 1")
				self.loyalty_program = str(program)
				self.flags.will_add_loyalty_points = True
				break

		if self.flags.will_add_loyalty_points:
			if len(self.items) > 1:
				frappe.throw("Loyalty packages should be sold one at a time")
			if self.redeem_loyalty_points:
				frappe.throw("Cannot redeem loyalty package")


	def before_submit(self):
		if self.flags.will_add_loyalty_points and self.loyalty_program:
			frappe.db.set_value("Customer", self.customer, "loyalty_program", self.loyalty_program)
		super().before_submit()


	def make_loyalty_point_entry(self):
		if self.flags.will_add_loyalty_points:
			super().make_loyalty_point_entry()
