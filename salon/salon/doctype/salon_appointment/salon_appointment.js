// Copyright (c) 2026, libermatic and contributors
// For license information, please see license.txt

frappe.ui.form.on("Salon Appointment", {
	refresh(frm) {
		if (frm.doc.docstatus === 1) {
			if (frm.doc.status === "Booked") {
				frm.add_custom_button(__("Start Service"), async function () {
					await set_server_status(frm, "In Progress");
				});
			}
			if (frm.doc.status === "In Progress" && frm.doc.sales_invoice) {
				frm.add_custom_button(__("Complete Service"), async function () {
					await set_server_status(frm, "Completed");
				});
			}

			if (["Booked", "In Progress"].includes(frm.doc.status)) {
				frm.add_custom_button(__("Mark No Show"), async function () {
					await set_server_status(frm, "No Show");
				});
			}

			if (frm.doc.status === "No Show") {
				frm.add_custom_button(__("Reschedule"), async function () {
						await handle_reschedule(frm);
				});
			}

			if (!frm.doc.sales_invoice && frm.doc.status !== "Cancelled") {
				frm.add_custom_button(__("Create Invoice"), function () {
					open_payment_dialog(frm);
				}).addClass("btn-primary");
			}
		}
	},

	async select_slot_btn(frm) {
		const selectedDatetime = await pick_time_slot({
			title: __("Select Appointment Slot"),
		});

		if (selectedDatetime) {
			frm.set_value("scheduled_time", selectedDatetime);
			frappe.show_alert({
				message: __("Scheduled Time set to {0}", [selectedDatetime]),
				indicator: "green",
			});
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

async function handle_reschedule(frm) {
	const selectedDatetime = await pick_time_slot({
		title: __("Reschedule Appointment Slot"),
	});

	if (!selectedDatetime) return;

	frappe.dom.freeze(__("Rescheduling appointment..."));
	try {
		await frappe.call({
			method: "reschedule_appointment",
			doc: frm.doc,
			args: {
				target_time: selectedDatetime,
			},
		});
		await frm.reload_doc();
		frappe.show_alert({
			message: __("Appointment rescheduled to {0} and set to Booked.", [selectedDatetime]),
			indicator: "green",
		});
	} catch (error) {
		frappe.msgprint({
			title: __("Reschedule Failed"),
			indicator: "red",
			message: error.message || __("Could not reschedule appointment."),
		});
	} finally {
		frappe.dom.unfreeze();
	}
}

function pick_time_slot(opts = {}) {
	return new Promise((resolve) => {
		let isResolved = false;

		let d = new frappe.ui.Dialog({
			title: opts.title || __("Select Time Slot"),
			fields: [
				{
					label: __("Appointment Date"),
					fieldname: "appointment_date",
					fieldtype: "Date",
					default: frappe.datetime.get_today(),
					reqd: 1,
					onchange() {
						render_slots_ui(d, resolve);
					},
				},
				{
					fieldtype: "HTML",
					fieldname: "slots_html",
				},
			],
			on_hide() {
				if (!isResolved) {
					resolve(null);
				}
			},
		});

		d.show();
		render_slots_ui(d, (val) => {
			isResolved = true;
			resolve(val);
		});
	});
}

async function render_slots_ui(dialog, resolve) {
	const date = dialog.get_value("appointment_date");
	const container = $(dialog.get_field("slots_html").wrapper);

	container.html(
		`<div class="text-muted text-center p-3">${__("Loading available slots...")}</div>`,
	);

	try {
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

		container.find(".slot-btn").on("click", function () {
			const selectedTime = $(this).attr("data-time");
			const fullDatetime = `${date} ${selectedTime}:00`;
			resolve(fullDatetime);
			dialog.hide();
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
