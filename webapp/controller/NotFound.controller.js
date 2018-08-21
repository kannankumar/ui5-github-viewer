sap.ui.define([
	"kpk/github/viewer/controller/BaseController"
], function(BaseController) {
	"use strict";

	return BaseController.extend("kpk.github.viewer.controller.NotFound", {

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */
		onInit: function() {
			this.getRouter().getTarget("notFound").attachDisplay(this._onNotFoundDisplayed, this);
		},

		/* =========================================================== */
		/* internal methods                                     	   */
		/* =========================================================== */

		/**
		 * Switches the Flexible Column Layout to Single column to display Not found Page.
		 * @function
		 * @private
		 */
		_onNotFoundDisplayed: function() {
			this.getModel("appView").setProperty("/layout", "OneColumn");
		}
	});
});