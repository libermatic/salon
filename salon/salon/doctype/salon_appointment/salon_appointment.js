// Copyright (c) 2026, libermatic and contributors
// For license information, please see license.txt

frappe.ui.form.on("Salon Appointment", {
	refresh(frm) {
		if (frm.doc.docstatus === 1) {
			if (frm.doc.status === "Booked") {
				frm.add_custom_button(
					__("Start Service"),
					async function () {
						await set_server_status(frm, "In Progress");
					},
					__("Status"),
				);
			}

			if (["Booked", "In Progress"].includes(frm.doc.status)) {
				frm.add_custom_button(
					__("Mark No Show"),
					async function () {
						await set_server_status(frm, "No Show");
					},
					__("Status"),
				);
			}

			if (!frm.doc.sales_invoice && frm.doc.status !== "Cancelled") {
				frm.add_custom_button(__("Create & Pay Invoice"), function () {
					open_payment_dialog(frm);
				}).addClass("btn-primary");
			}
		}
	},
});

async function set_server_status(frm, target_status) {
	frappe.dom.freeze(__("Updating status..."));
	try {
		await frappe.call({
			method: "update_appointment_status",
			doc: frm.doc,
			args: {
				target_status: target_status,
			},
		});
		await frm.reload_doc();
		frappe.show_alert({
			message: __("Status updated to {0}", [target_status]),
			indicator: "green",
		});
	} catch (error) {
		frappe.msgprint({
			title: __("Status Update Failed"),
			indicator: "red",
			message: error.message || __("Could not update status."),
		});
	} finally {
		frappe.dom.unfreeze();
	}
}

function open_payment_dialog(frm) {
	let d = new frappe.ui.Dialog({
		title: __("Payment Details"),
		fields: [
			{
				label: __("Mode of Payment"),
				fieldname: "mode_of_payment",
				fieldtype: "Link",
				options: "Mode of Payment",
				reqd: 1,
			},
			{
				label: __("Amount Paid"),
				fieldname: "paid_amount",
				fieldtype: "Currency",
				default: frm.doc.total_amount || 0,
				reqd: 1,
			},
		],
		primary_action_label: __("Submit"),
		async primary_action(values) {
			d.hide();

			frappe.dom.freeze(__("Creating Sales Invoice..."));

			try {
				const { message: invoice_name } = await frappe.call({
					method: "make_sales_invoice",
					doc: frm.doc,
					args: {
						mode_of_payment: values.mode_of_payment,
						paid_amount: values.paid_amount,
					},
				});

				if (invoice_name) {
					frappe.msgprint({
						title: __("Success"),
						indicator: "green",
						alert: true,
						message: __(
							`Sales Invoice <a href='/app/sales-invoice/${invoice_name}'><b>${invoice_name}</b></a> generated successfully.`,
						),
					});
				}
				await frm.reload_doc();
			} finally {
				frappe.dom.unfreeze();
			}
		},
	});

	d.show();
}
