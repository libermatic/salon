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

	select_slot_btn(frm) {
		open_slot_picker_dialog(frm);
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

function open_slot_picker_dialog(frm) {
	let d = new frappe.ui.Dialog({
		title: __("Select Appointment Slot"),
		fields: [
			{
				label: __("Appointment Date"),
				fieldname: "appointment_date",
				fieldtype: "Date",
				default: frappe.datetime.get_today(),
				reqd: 1,
				onchange() {
					render_slots(d);
				},
			},
			{
				fieldtype: "HTML",
				fieldname: "slots_html",
			},
		],
	});

	d.show();
	render_slots(d);
}

async function render_slots(dialog) {
	const date = dialog.get_value("appointment_date");
	const container = $(dialog.get_field("slots_html").wrapper);

	container.html(
		`<div class="text-muted text-center p-3">${__("Loading available slots...")}</div>`,
	);

	try {
		// Fetch salon operating hours & slot settings
		const settings = await frappe.db.get_doc("Salon Settings");
		const startTime = settings.start_time || "09:00:00";
		const endTime = settings.end_time || "18:00:00";
		const duration = parseInt(settings.slot_duration) || 30;

		const slots = generate_time_slots(startTime, endTime, duration);

		if (!slots.length) {
			container.html(
				`<div class="text-danger text-center p-3">${__("No available slots found for operating hours.")}</div>`,
			);
			return;
		}

		// Render slots as clickable pill buttons
		let html = `
            <div class="form-group">
                <label class="control-label">${__("Available Time Slots")}</label>
                <div class="slot-container" style="max-height: 250px; overflow-y: auto; padding: 5px; display: flex; gap: 1em; flex-flow: wrap;">
        `;

		slots.forEach((slot) => {
			html += `
                <button type="button" class="btn btn-default btn-sm slot-btn" data-time="${slot}">
                    ${slot}
                </button>
            `;
		});

		html += `</div></div>`;
		container.html(html);

		// Bind click event to assign selected slot
		container.find(".slot-btn").on("click", function () {
			const selectedTime = $(this).attr("data-time");
			const fullDatetime = `${date} ${selectedTime}:00`;

			cur_frm.set_value("scheduled_time", fullDatetime);
			dialog.hide();

			frappe.show_alert({
				message: __("Scheduled Time set to {0}", [fullDatetime]),
				indicator: "green",
			});
		});
	} catch (error) {
		container.html(
			`<div class="text-danger text-center p-3">${__("Failed to load settings.")}</div>`,
		);
	}
}

function generate_time_slots(start, end, durationMins) {
	let slots = [];
	let current = moment(start, "HH:mm:ss");
	let endTime = moment(end, "HH:mm:ss");

	while (current.clone().add(durationMins, "minutes").isSameOrBefore(endTime)) {
		slots.push(current.format("HH:mm"));
		current.add(durationMins, "minutes");
	}

	return slots;
}
