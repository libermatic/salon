import frappe


def mark_overdue_appointments_no_show():
	"""Scheduled task to mark all incomplete appointments for today past their scheduled time as 'No Show'."""
	current_time = frappe.utils.now_datetime()  # pyright: ignore[reportAttributeAccessIssue]

	overdue_appointments = frappe.get_all(
		"Salon Appointment",
		filters={
			"status": ["in", ["Booked", "In Progress"]],
			"docstatus": 1,
			"scheduled_time": ["<", current_time],
		},
		pluck="name",
	)

	for appt_name in overdue_appointments:
		try:
			doc = frappe.get_doc("Salon Appointment", appt_name)
			doc.db_set("status", "No Show", update_modified=False)
			frappe.db.commit()
		except Exception as e:
			frappe.log_error(
				message=f"Failed to auto-mark appointment {appt_name} as No Show: {e!s}",
				title="Salon Appointment Scheduled Task Error",
			)
