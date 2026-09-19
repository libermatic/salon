export const sales_invoice = {
	async redeem_loyalty_points(frm) {
		frm.fields_dict["loyalty_details_html"].$wrapper.empty();
		const { customer, loyalty_program } = frm.doc;
		if (customer && loyalty_program && frm.doc.redeem_loyalty_points) {
			const { message = {} } = await frappe.call({
				method: "erpnext.accounts.doctype.loyalty_program.loyalty_program.get_loyalty_program_details_with_points",
				args: {
					customer: customer,
					loyalty_program: loyalty_program,
					silent: true,
				},
			});
			const { loyalty_points: available_points, conversion_factor } = message;
			frm.fields_dict["loyalty_details_html"].$wrapper.append(`
				<div style="border-radius: var(--border-radius-tiny); border: 1px solid var(--border-color); box-shadow: none; padding: var(--input-padding); margin-bottom: 1em;">
					Available Points: <strong>${new Intl.NumberFormat().format(available_points)}</strong>
				<div>
			`);
			frm.set_value(
				"loyalty_points",
				(frm.doc.rounded_total || frm.doc.grand_total) / conversion_factor,
			);
		} else {
			frm.set_value("loyalty_points", 0);
		}
	},
};
