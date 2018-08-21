/*global location */
sap.ui.define([
	"kpk/github/viewer/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"kpk/github/viewer/model/formatter",
	"kpk/github/viewer/util/RestClient"
], function(BaseController, JSONModel, formatter, RestClient) {
	"use strict";

	return BaseController.extend("kpk.github.viewer.controller.Detail", {

		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		onInit: function() {
			// Model used to manipulate control states. The chosen values make sure,
			// detail page is busy indication immediately so there is no break in
			// between the busy indication for loading the view's meta data
			var oViewModel = new JSONModel({
				busy: false,
				delay: 0,
				contributorTableTitle: this.getResourceBundle().getText("detailContributorsSectionHeading")
			});
			this.restClient = new RestClient(this);
			this.getRouter().getRoute("repository").attachPatternMatched(this._onObjectMatched, this);

			this.setModel(oViewModel, "detailView");

		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/**
		 * Updates the item count within the Contributor table's header
		 * @param {sap.ui.base.Event} oEvent an event containing the total number of items in the Table
		 * @private
		 */
		onContributorsTableUpdateFinished: function(oEvent) {
			var sTitle,
				iTotalItems = oEvent.getParameter("total"),
				oViewModel = this.getModel("detailView");

			// only update the counter if the length is final
			if (this.byId("contributorsTable").getBinding("items").isLengthFinal()) {
				if (iTotalItems) {
					sTitle = this.getResourceBundle().getText("detailContributorsSectionHeadingCount", [iTotalItems]);
				} else {
					//Display 'Contributors' instead of 'Contributors (0)'
					sTitle = this.getResourceBundle().getText("detailContributorsSectionHeading");
				}
				oViewModel.setProperty("/contributorTableTitle", sTitle);
			}
		},

		/**
		 * Set the full screen mode of detail View to false and navigate to master page
		 * @function
		 * @private
		 */
		onCloseDetailPress: function() {
			this.getModel("appView").setProperty("/actionButtonsInfo/midColumn/fullScreen", false);
			// No item should be selected on master after detail page is closed
			this.getOwnerComponent().oListSelector.clearMasterListSelection();
			this.getRouter().navTo("master");
		},

		/**
		 * Toggle the detail view between full and non full screen mode.
		 * @function
		 * @private
		 */
		toggleFullScreen: function() {
			var bFullScreen = this.getModel("appView").getProperty("/actionButtonsInfo/midColumn/fullScreen");
			this.getModel("appView").setProperty("/actionButtonsInfo/midColumn/fullScreen", !bFullScreen);
			if (!bFullScreen) {
				// store current layout and go full screen
				this.getModel("appView").setProperty("/previousLayout", this.getModel("appView").getProperty("/layout"));
				this.getModel("appView").setProperty("/layout", "MidColumnFullScreen");
			} else {
				// reset to previous layout
				this.getModel("appView").setProperty("/layout", this.getModel("appView").getProperty("/previousLayout"));
			}
		},

		/* =========================================================== */
		/* internal methods                                     	   */
		/* =========================================================== */

		/**
		 * Binds the view to the repository path and loads the contributors
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'repository'
		 * @private
		 */
		_onObjectMatched: function(oEvent) {
			var sUserName = oEvent.getParameter("arguments").userName;
			var sRepoName = oEvent.getParameter("arguments").repoName;
			this.getModel("appView").setProperty("/layout", "TwoColumnsMidExpanded");
			this._setDetailModels(sUserName, sRepoName);
		},

		/**
		 * Make the API calls using REST Client to fetch the following details:
		 *  - Repository Details 
		 *  - Contributors 
		 * @function
		 * @param {string} User Name passed from the Master View
		 * @param {string} Repository Name passed from the Master View
		 * @private
		 */
		_setDetailModels: function(sUserName, sRepoName) {
			//API call for Repository details
			var sRepositoryPath = "/github/repos/" + sUserName + "/" + sRepoName;
			var repositoryModel = new JSONModel();
			this.restClient.read(sRepositoryPath).then(function(oResults) {
				repositoryModel.setData(oResults);
				this.setModel(repositoryModel, "repositoryData");
			}.bind(this));

			//API call for Contributors  details
			var sContributorPath = "/github/repos/" + sUserName + "/" + sRepoName + "/contributors";
			var contributorModel = new JSONModel();
			this.restClient.read(sContributorPath).then(function(oResults) {
				contributorModel.setProperty("/contributors", oResults);
				this.setModel(contributorModel, "contributorData");
			}.bind(this));
		},

		/**
		 * Binds the view to the object path. Makes sure that detail view displays
		 * a busy indicator while data for the corresponding element binding is loaded.
		 * @function
		 * @param {string} sObjectPath path to the object to be bound to the view.
		 * @private
		 */
		_bindView: function(sObjectPath) {
			// Set busy indicator during view binding
			var oViewModel = this.getModel("detailView");

			// If the view was not bound yet its not busy, only if the binding requests data it is set to busy again
			oViewModel.setProperty("/busy", false);

			this.getView().bindElement({
				path: sObjectPath,
				events: {
					change: this._onBindingChange.bind(this),
					dataRequested: function() {
						oViewModel.setProperty("/busy", true);
					},
					dataReceived: function() {
						oViewModel.setProperty("/busy", false);
					}
				}
			});
		},

		/**
		 * Updates the Master List whenever binsing changes (user makes a search for another Github User) 
		 * Makes sure that detail view displays the selected Item from the list
		 * @function
		 * @private
		 */
		_onBindingChange: function() {
			var oView = this.getView(),
				oElementBinding = oView.getElementBinding();

			// No data for the binding
			if (!oElementBinding.getBoundContext()) {
				this.getRouter().getTargets().display("detailObjectNotFound");
				// if object could not be found, the selection in the master list
				// does not make sense anymore.
				this.getOwnerComponent().oListSelector.clearMasterListSelection();
				return;
			}

			var sPath = oElementBinding.getPath();
			this.getOwnerComponent().oListSelector.selectAListItem(sPath);
		}

	});

});