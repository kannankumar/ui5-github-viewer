/*global history */
sap.ui.define(["sap/ui/base/Object"], function(Object) {
	"use strict";
	return Object.extend(
		"kpk.github.viewer.util.RestClient", {

			constructor: function(oDelegate, oModel) {
				this._delegate = oDelegate;
				if (oModel) {
					this.oModel = oModel;
				} else {
					this.oModel = this._delegate.getOwnerComponent().getModel();
				}
			},
			read: function(sPath) {
				return new Promise(function(resolve, reject) {
					$.ajax({
						type: 'GET',
						url: sPath
					}).done(function(results) {
							resolve(results);
						},
						function(oError) {
							reject(oError);
						});
				});
			}

		});
});