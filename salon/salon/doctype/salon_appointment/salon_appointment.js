// Copyright (c) 2026, libermatic and contributors
// For license information, please see license.txt

frappe.ui.form.on("Salon Appointment", {
	refresh(frm) {
		if (!frm.doc.sales_invoice && frm.doc.docstatus === 1) {
			frm.add_custom_button(__("Make Invoice"), function () {
				open_payment_dialog(frm);
			}).addClass("btn-primary");
		}
	},
});

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
