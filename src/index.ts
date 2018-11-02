import GitClient = require("TFS/VersionControl/GitRestClient");
import AuthServices = require("VSS/Authentication/Services");
import Controls = require("VSS/Controls");
import Dialogs = require("VSS/Controls/Dialogs");
import Grids = require("VSS/Controls/Grids");
import Menus = require("VSS/Controls/Menus");
import Handlers = require("VSS/Events/Handlers");
import { GitRepository } from "TFS/VersionControl/Contracts";
import Contracts = require("VSS/WebApi/Contracts");

interface IPolicyConfiguration {
    id: number;
    createdBy: Contracts.IdentityRef;
    createdDate: string;
    isBlocking: boolean;
    isEnabled: boolean;
    isDeleted: boolean;
    revision: number;
    type: IPolicyTypeRef;
    _links: any;
    settings: IPolicySettings;
    repositories: GitRepository[]
}

interface IPolicySettings {
    minimumApproverCount: number,
    creatorVoteCounts: boolean,
    allowDownvotes: boolean,
    resetOnSourcePush: boolean,
    scope: IPolicyScope[]
}

interface IPolicyScope {
    refName: string,
    matchKind: string,
    repositoryId: string
}

interface IPolicyTypeRef {
    displayName: string;
    id: string;
    url: string
}

interface IPolicyConfigurationsListResponse {
    count: number;
    value: IPolicyConfiguration[];
}

interface IPolicyGridRowContextInfo {
    rowInfo: Grids.IGridRowInfo,
    item: IPolicyConfiguration
}

// Grids.IGridContextMenu doesn't define an arguments function, so I'm extending it here.
interface IPolicyGridContextMenu extends Grids.IGridContextMenu {
    arguments: (contextInfo: IPolicyGridRowContextInfo) => IPolicyConfiguration;
}

// Create a holder for the list of all repositories in this team project.
let repositories: GitRepository[];

// Create a holder for the list of all policies in this team project.
let policies = new Array<IPolicyConfiguration>();

// Create a holder for the policy grid.
let policyGrid: Grids.Grid;

const azureDevOpsRestApiUri = "https://docs.microsoft.com/en-us/rest/api/vsts/policy/configurations?view=vsts-rest-4.1";

let webcontext: WebContext = VSS.getWebContext();

const policyConfigurationsRestApiPrefix: string = webcontext.account.uri + webcontext.project.name + "/_apis/policy/configurations";
const policyListUri = policyConfigurationsRestApiPrefix + "?api-version=4.1";
const policyUpdateUri = policyConfigurationsRestApiPrefix + "/{configurationId}?api-version=4.1";

$("#project").text(webcontext.project.name);

let gitClient: GitClient.GitHttpClient4_1 = GitClient.getClient();
gitClient.getRepositories(webcontext.project.name).then(function (repos) {
    repositories = repos;
    createPolicyGrid();
    getPolicies();
});

function createPolicyGrid() : void {
    let policyGridOptions: Grids.IGridOptions = {
        height: "300px",
        width: "100%",
        source: policies,
        columns: getPolicyGridColumns(),
        openRowDetail: (index: number) => {
            // Double clicking row or hitting enter key when the row is selected will cause this function to be executed
            let policyConfiguration = policyGrid.getRowData(index);
            $("#decree-policy-details").text(JSON.stringify(policyConfiguration));
        },
        gutter: {
            contextMenu: true
        },
        contextMenu: policyContextMenu
    };
    
    policyGrid = Controls.create(Grids.Grid, $("#decree-policies-grid"), policyGridOptions);
}

function getPolicies() : void {
    VSS.getAccessToken().then(function (token: ISessionToken) {
        $.ajax({
            url: policyListUri,
            beforeSend: function(xhr) {                
                let authHeader = AuthServices.authTokenManager.getAuthorizationHeader(token);
                xhr.setRequestHeader("Authorization", authHeader);
            }
        }).done(function (response: IPolicyConfigurationsListResponse) {
            $('#decree-total-policies').html(response.count.toString());
            if (response && response.value && response.value.length) {
                policies = response.value;

                policies.forEach(function (policy: IPolicyConfiguration) {
                    policy.repositories = repositories.filter(function (repository: GitRepository) {
                        if (policy.settings.scope && policy.settings.scope.length) {
                            for (let i = 0; i < policy.settings.scope.length; i++) {
                                if (policy.settings.scope[i].repositoryId && repository.id === policy.settings.scope[i].repositoryId) {
                                    return true;
                                }
                            }                          
                        }
                        return false;
                    });
                });

                policyGrid.setDataSource(policies);
            }
            else {
                $("#decree-error").text(`No policies exist in the ${webcontext.project.name} project, or you don't have access to any policies.`);
                clearMessage();
            }
        }).fail(function (response) {            
            console.log(`There was an error requesting policies from ${policyListUri} for user ${webcontext.user.id}.`);
            let errorMessage: string = "There was an error requesting policies.";
            if (response.status == 401) {
                errorMessage += ` It could be the case that the Decree extension has not been granted access to the "Code" scope. It could also be the case that ${webcontext.user.name} does not have access to view policies in the ${webcontext.project.name} project. Contact your Project Administrator for permissions issues.`;
            }
            $("#decree-error").text(errorMessage);
            clearMessage();
        });
    });
}

// Define all of the columns of the policy grid.
function getPolicyGridColumns()  {
    return [
        {
            text: "Policy Type",
            index: "type",
            width: 225,
            getCellContents: function(rowInfo: Grids.IGridRowInfo, dataIndex: number, expandedState: number, level: number, column: Grids.IGridColumn, indentIndex: number, columnOrder: number) {
                let type: IPolicyTypeRef = this.getColumnValue(dataIndex, column.index);
                return $("<div class='grid-cell'/>")
                    .text(type.displayName)
                    .width(column.width || 225);
            }
        },
        {
            text: "Repo",
            index: "repositories",
            width: 150,
            canSortBy: false,
            getCellContents: function(rowInfo: Grids.IGridRowInfo, dataIndex: number, expandedState: number, level: number, column: Grids.IGridColumn, indentIndex: number, columnOrder: number) {
                let policyRepos: GitRepository[] = this.getColumnValue(dataIndex, column.index);

                let div: JQuery<HTMLElement> = $("<div class='grid-cell'/>").width(column.width || 150);    

                if (policyRepos && policyRepos.length) {
                    for (let i: number = 0; i < policyRepos.length; i++) {
                        let repoLink: JQuery<HTMLElement> = $("<a/>").text(policyRepos[i].name).prop("href", policyRepos[i].url).prop("title", policyRepos[i].name);

                        if (i > 0) {
                            div.append($("<span>, </span>"));
                        }

                        div.append(repoLink);
                    }
                }

                return div;                    
            }
        },
        {
            text: "Created By",
            index: "createdBy",
            width: 150,
            getCellContents: function (rowInfo: Grids.IGridRowInfo, dataIndex: number, expandedState: number, level: number, column: Grids.IGridColumn, indentIndex: number, columnOrder: number) {
                let createdBy: Contracts.IdentityRef = this.getColumnValue(dataIndex, column.index);
                return $("<div class='grid-cell'/>")
                    .text(createdBy.displayName)
                    .width(column.width || 150);
            }
        },
        {
            text: "Created",
            index: "createdDate",
            width: 150,
            getCellContents: function(rowInfo: Grids.IGridRowInfo, dataIndex: number, expandedState: number, level: number, column: Grids.IGridColumn, indentIndex: number, columnOrder: number) {
                let createdDate: string = this.getColumnValue(dataIndex, column.index);
                return $("<div class='grid-cell'/>")
                    .text(new Date(createdDate).toLocaleString())
                    .width(column.width || 150);
            }
        }
    ]
};

// Define the context menu items for each policy row.
function getContextMenuItems(): Menus.IMenuItemSpec[] {
    return [
        {
            id: "open",
            text: "Open for Edit",
            icon: "ms-ContextualMenu-icon bowtie-icon icon-121 bowtie-arrow-open"
        },
        //{ separator: true },
        {
            id: "makeGlobal",
            text: "Promote to Global Policy",
            icon: "ms-ContextualMenu-icon bowtie-icon icon-121 bowtie-arrow-up"
        },
        { separator: true },
        {
            id: "delete",
            text: "Delete Policy",
            icon: "ms-ContextualMenu-icon bowtie-icon icon-121 bowtie-trash"
        },
    ];
}

let policyContextMenu: IPolicyGridContextMenu = {
    items: getContextMenuItems(),
    executeAction: (args: Handlers.CommandEventArgs) : void => {
        // Get the item associated with the context menu
        let policyConfiguration: IPolicyConfiguration = args.get_commandArgument();
        switch (<string>args.get_commandName()) {
            case "open":
                $("#decree-policy-details").text(JSON.stringify(policyConfiguration));
                break;
            case "makeGlobal":
                showPromoteToGlobalPolicyConfirmationDialog(policyConfiguration, () => {
                    promoteToGlobalPolicy(policyConfiguration);
                });
                break;
            case "delete":
                showDeletePolicyConfirmationDialog(policyConfiguration, () => {
                    alert('You said yes.')
                });
                break;
        }
    },
    arguments: (contextInfo: IPolicyGridRowContextInfo) : IPolicyConfiguration => {
        return contextInfo.item;
    }
};

function showDeletePolicyConfirmationDialog(policyConfiguration: IPolicyConfiguration, yesCallback: () => void) : void {
    let dialog = Dialogs.show(Dialogs.ModalDialog, {
        title: "Delete Policy Confirmation",
        content: $("<p/>").addClass("confirmation-text").html(`Are you sure you want to delete this "<i>${policyConfiguration.type.displayName}</i>" policy?`),
        buttons: {
            "Delete": () => {
                yesCallback();
                dialog.close();
            },
            "Cancel": () => {
                dialog.close();
            }
        }
    });
}

function showPromoteToGlobalPolicyConfirmationDialog(policyConfiguration: IPolicyConfiguration, yesCallback: () => void) : void {
    let branches: string = "";

    if (policyConfiguration.settings && policyConfiguration.settings.scope && policyConfiguration.settings.scope.length) {
        for (let i: number = 0; i < policyConfiguration.settings.scope.length; i++) {
            if (policyConfiguration.settings.scope[i].refName) {
                if (branches !== "") {
                    branches += ", ";
                }
                branches += policyConfiguration.settings.scope[i].refName;
            }
        }
    }

    let repoNames: string = "";

    if (policyConfiguration.repositories && policyConfiguration.repositories.length) {
        for (let i: number = 0; i < policyConfiguration.repositories.length; i++) {
            if (repoNames !== "") {
                repoNames += " or ";
            }
            repoNames += policyConfiguration.repositories[i].name;
        }
    }

    let dialog = Dialogs.show(Dialogs.ModalDialog, {
        title: "Promote Policy Confirmation",
        content: $("<p/>").addClass("confirmation-text").html(`By promoting this <i>${policyConfiguration.type.displayName}</i> policy, it will be applied to all <i>${branches}</i> branches across every repository in the <i>${webcontext.project.name}</i> project. You will no longer be able to edit the policy by going to the <i>${repoNames}</i> branch policies. The Decree Policy Manager extension (this tool) or the <a href="${azureDevOpsRestApiUri}" target="_blank">Azure Devops Services REST API</a> will be required to edit or delete the policy. Are you sure you want to proceed?`),
        buttons: {
            "Promote": () => {
                yesCallback();
                dialog.close();
            },
            "Cancel": () => {
                dialog.close();
            }
        }
    });
}

function promoteToGlobalPolicy(policyConfiguration: IPolicyConfiguration) : void {
    // Empty the scope array.
    policyConfiguration.settings.scope = [];

    VSS.getAccessToken().then(function (token: ISessionToken) {
        $.ajax({
            url: policyUpdateUri.replace("{ConfigurationId}", policyConfiguration.id.toString()),
            method: "PUT",
            contentType: "application/json",
            data: JSON.stringify(policyConfiguration),
            beforeSend: function(xhr) {
                let authHeader = AuthServices.authTokenManager.getAuthorizationHeader(token);
                xhr.setRequestHeader("Authorization", authHeader);
            }
        }).done(function (response: IPolicyConfiguration) {
            $("#decree-success").text("Policy was successfully promoted.");
            clearMessage();
        }).fail(function (response) {
            let errorMessage = "There was an error promoting the policy.";            
            if (response.status == 401) {
                errorMessage += ` It could be the case that the Decree extension has not been granted access to the 'Code' scope. It could also be the case that ${webcontext.user.name} does not have access to update policies in the ${webcontext.project.name} project. Contact your Project Administrator for permissions issues.`;
            }
            $("#decree-error").text(errorMessage);
            clearMessage();
        });
    });
}

function clearMessage() {
    setTimeout(() => {
        $("#decree-success").text("");
        $("#decree-error").text("");
    }, 5000);
}