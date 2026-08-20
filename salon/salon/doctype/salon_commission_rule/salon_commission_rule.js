// Copyright (c) 2026, libermatic and contributors
// For license information, please see license.txt

frappe.ui.form.on("Salon Commission Rule", {
	refresh(frm) {
		frm.trigger("render_hierarchy_info");
	},

	render_hierarchy_info(frm) {
		const html = `
				<div class="border rounded p-3 bg-light text-muted small" style="margin-bottom: 15px;">
					<div class="text-dark mb-2">${__("Evaluation Priority Order:")}</div>
					<ol class="mb-0">
						<li class="mb-1"><b>${__("Employee + Service Item")}</b> ${__("(Specific Employee & Specific Service)")}</li>
						<li class="mb-1"><b>${__("Service Item Only")}</b> ${__("(Specific Service, Any Employee)")}</li>
						<li class="mb-1"><b>${__("Employee Only")}</b> ${__("(Specific Employee, Any Service)")}</li>
						<li class="mb-0"><b>${__("Global Fallback (Blanks)")}</b> ${__("(Any Employee, Any Service - ordered by Priority)")}</li>
					</ol>
				</div>
			`;

		frm.get_field("rule_hierarchy_info").$wrapper.html(html);
	},
});
