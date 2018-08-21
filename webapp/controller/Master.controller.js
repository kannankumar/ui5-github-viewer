/*global history */
sap.ui.define([
	"kpk/github/viewer/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/Sorter",
	"sap/ui/model/FilterOperator",
	"sap/ui/Device",
	"kpk/github/viewer/model/formatter",
	"kpk/github/viewer/util/RestClient"
], function(BaseController, JSONModel, Filter, Sorter, FilterOperator, Device, formatter, RestClient) {
	"use strict";

	return BaseController.extend("kpk.github.viewer.controller.Master", {

		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		/**
		 * Called when the master list controller is instantiated. 
		 * It sets up the event handling for the master/detail communication and other lifecycle tasks.
		 * @public
		 */
		onInit: function() {
			// Control state model
			var oList = this.byId("list"),
				oViewModel = this._createViewModel(),
				// Put down master list's original value for busy indicator delay,
				// so it can be restored later on. Busy handling on the master list is
				// taken care of by the master list itself.
				iOriginalBusyDelay = oList.getBusyIndicatorDelay();
				
			//Make the API call to fetch the User- Repo list				
			this.restClient = new RestClient(this);
			this._loadUserRepositories();

			this._oList = oList;
			// keeps the search state
			this._oListFilterState = {
				aSearch: []
			};

			this.setModel(oViewModel, "masterView");
			// Make sure, busy indication is showing immediately so there is no
			// break after the busy indication for loading the view's meta data is
			// ended (see promise 'oWhenMetadataIsLoaded' in AppController)
			oList.attachEventOnce("updateFinished", function() {
				// Restore original busy indicator delay for the list
				oViewModel.setProperty("/delay", iOriginalBusyDelay);
			});

			this.getView().addEventDelegate({
				onBeforeFirstShow: function() {
					this.getOwnerComponent().oListSelector.setBoundMasterList(oList);
				}.bind(this)
			});

			this.getRouter().getRoute("master").attachPatternMatched(this._onMasterMatched, this);
			this.getRouter().attachBypassed(this.onBypassed, this);
		},

		
		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/**
		 * After list data is available, this handler method updates the
		 * master list counter
		 * @param {sap.ui.base.Event} oEvent the update finished event
		 * @public
		 */
		onUpdateFinished: function(oEvent) {
			// update the master list object counter after new data is loaded
			this._updateListItemCount(oEvent.getParameter("total"));
		},
		
		/**
		 * Event handler for the Github User search field.
		 * Loads the Repositories for the searched UserName.
		 * @param {sap.ui.base.Event} oEvent the search event
		 * @public
		 */
		onSearchUserName: function(oEvent) {
			this._loadUserRepositories(oEvent.getParameter("query"));
		},
		
		/**
		 * Event handler for the Repository search field. Applies current
		 * filter value and triggers a new search. If the search field's
		 * 'refresh' button has been pressed, no new search is triggered
		 * and the list binding is refresh instead.
		 * @param {sap.ui.base.Event} oEvent the search event
		 * @public
		 */
		onSearchRepository: function(oEvent) {
			if (oEvent.getParameters().refreshButtonPressed) {
				// Search field's 'refresh' button has been pressed.
				// This is visible if you select any master list item.
				// In this case no new search is triggered, we only
				// refresh the list binding.
				this.onRefresh();
				return;
			}

			var sQuery = oEvent.getParameter("query");

			if (sQuery) {
				this._oListFilterState.aSearch = [new Filter("full_name", FilterOperator.Contains, sQuery)];
			} else {
				this._oListFilterState.aSearch = [];
			}
			this._applyRepoSearch();

		},

		/**
		 * Event handler for refresh event. Keeps filter, sort
		 * and group settings and refreshes the list binding.
		 * @public
		 */
		onRefresh: function() {
			this._oList.getBinding("items").refresh();
		},

		/**
		 * Event handler to open the ViewSettingsDialog for the sorting Repositories
		 * @public
		 */
		onOpenViewSettings: function() {
			if (!this._oViewSettingsDialog) {
				this._oViewSettingsDialog = sap.ui.xmlfragment("kpk.github.viewer.view.ViewSettingsDialog", this);
				this.getView().addDependent(this._oViewSettingsDialog);
				// forward compact/cozy style into Dialog
				this._oViewSettingsDialog.addStyleClass(this.getOwnerComponent().getContentDensityClass());
			}
			var sDialogTab = "sort";
			this._oViewSettingsDialog.open(sDialogTab);
		},

		/**
		 * Event handler called when ViewSettingsDialog has been confirmed, i.e.
		 * has been closed with 'OK'. In the case, the currently chosen sorters
		 * are applied to the master list
		 * @param {sap.ui.base.Event} oEvent the confirm event
		 * @public
		 */
		onConfirmViewSettingsDialog: function(oEvent) {
			this._applyRepoSort(oEvent);
		},
		
		/**
		 * Event handler for the list selection event
		 * @param {sap.ui.base.Event} oEvent the list selectionChange event
		 * @public
		 */
		onSelectionChange: function(oEvent) {
			// get the list item, either from the listItem parameter or from the event's source itself (will depend on the device-dependent mode).
			this._showDetail(oEvent.getParameter("listItem") || oEvent.getSource());
		},

		/**
		 * Event handler for the bypassed event, which is fired when no routing pattern matched.
		 * If there was an object selected in the master list, that selection is removed.
		 * @public
		 */
		onBypassed: function() {
			this._oList.removeSelections(true);
		},

		/**
		 * Event handler for navigating back.
		 * We navigate back in the browser historz
		 * @public
		 */
		onNavBack: function() {
			history.go(-1);
		},

		/* =========================================================== */
		/* internal methods     		                               */
		/* =========================================================== */
		
		/**
		 * Create an initial model for the view to bind properties
		 * @private
		 */
		_createViewModel: function() {
			return new JSONModel({
				isFilterBarVisible: false,
				filterBarLabel: "",
				delay: 0,
				title: this.getResourceBundle().getText("masterListHeaderCount", [0]),
				noDataText: this.getResourceBundle().getText("masterListNoDataText"),
				sortBy: "Name",
				groupBy: "None"
			});
		},

		/**
		 * Set to single column layout when URL macthes the "master" pattern
		 * @private
		 */
		_onMasterMatched: function() {
			//Set the layout property of the FCL control to 'OneColumn'
			this.getModel("appView").setProperty("/layout", "OneColumn");
		},
		
		/**
		 * Make the API call to fetch Repositories for the selected User
		 * If no User is specified (i.e. first load), "sap" is taken as default username
		 * @param {string} userName Searched username, default='sap'
		 * @private
		 */
		_loadUserRepositories: function(userName) {
			if (!userName) {
				userName = "sap";
				this.getView().byId("userSearchField").setValue(userName);
			}
			var sPath = "/github/users/" + userName + "/repos";
			this.restClient.read(sPath).then(function(oResults) {
				var model = new JSONModel(oResults);
				this.setModel(model);
			}.bind(this));
		},
		
		/**
		 * Sets the item count on the master list header
		 * @param {integer} iTotalItems the total number of items in the list
		 * @private
		 */
		_updateListItemCount: function(iTotalItems) {
			var sTitle;
			// only update the counter if the length is final
			if (this._oList.getBinding("items").isLengthFinal()) {
				sTitle = this.getResourceBundle().getText("repositoriesCount", [iTotalItems]);
				this.getModel("masterView").setProperty("/title", sTitle);
			}
		},
		
		/**
		 * Shows the selected item on the detail page
		 * On phones a additional history entry is created
		 * @param {sap.m.ColumnListItem} oItem selected Item
		 * @private
		 */
		_showDetail: function(oItem) {
			var bReplace = !Device.system.phone;
			// set the layout property of FCL control to show two columns
			this.getModel("appView").setProperty("/layout", "TwoColumnsMidExpanded");
			this.getRouter().navTo("repository", {
				userName: oItem.getBindingContext().getProperty("owner/login"),
				repoName: oItem.getBindingContext().getProperty("name")
			}, bReplace);
		},
		
		/**
		 * Apply the chosen sorter to the master repository list
		 * @param {sap.ui.base.Event} oEvent the confirm event
		 * @private
		 */
		_applyRepoSort: function(oEvent) {
			var mParams = oEvent.getParameters(),
				sPath,
				bDescending,
				aSorters = [];
			
			// apply sorter to binding
			sPath = mParams.sortItem.getKey();
			bDescending = mParams.sortDescending;
			aSorters.push(new Sorter(sPath, bDescending));

			this._oList.getBinding("items").sort(aSorters);
		},
		
		/**
		 * Internal helper method to apply both filter and search state together on the list binding
		 * @private
		 */
		_applyRepoSearch: function() {
			var aFilters = this._oListFilterState.aSearch,
				oViewModel = this.getModel("masterView");
			this._oList.getBinding("items").filter(aFilters, "Application");
			// changes the noDataText of the list in case there are no filter results
			if (aFilters.length !== 0) {
				oViewModel.setProperty("/noDataText", this.getResourceBundle().getText("masterListNoDataWithFilterOrSearchText"));
			} else if (this._oListFilterState.aSearch.length > 0) {
				// only reset the no data text to default when no new search was triggered
				oViewModel.setProperty("/noDataText", this.getResourceBundle().getText("masterListNoDataText"));
			}
		}

	});

});
