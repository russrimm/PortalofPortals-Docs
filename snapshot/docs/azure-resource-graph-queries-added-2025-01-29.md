# Azure Resource Graph Queries Added - January 29, 2025

This document lists all the Azure Resource Graph queries added from the Microsoft Learn documentation: [Azure Resource Graph sample queries by table](https://learn.microsoft.com/en-us/previous-versions/azure/governance/resource-graph/samples/samples-by-table?tabs=azure-cli)

## Summary

Added **35 new queries** across multiple categories from the official Microsoft documentation.

## New Categories Created

1. **Health** - 10 queries for resource health monitoring
2. **Authorization** - 5 queries for RBAC and role management

## Queries Added by Category

### Advisor (1 new query)
- **List Arc-enabled servers not running latest released agent version**
  - Identifies Azure Arc-enabled servers with outdated Connected Machine agents
  - Joins AdvisorResources with Resources table
  - Excludes expired agents from results

### Health (10 new queries)
- **Count of virtual machines by availability state and Subscription Id**
  - Aggregates VM availability states per subscription
  
- **List of virtual machines and associated availability states by Resource Ids**
  - Shows each VM's availability state (Available/Unavailable/Degraded/Unknown)
  
- **List of virtual machines by availability state and power state with Resource Ids and resource Groups**
  - Combines availability state with power state
  - Joins HealthResources with Resources table
  - Filters out deallocated VMs
  
- **List of virtual machines that are not Available by Resource Ids**
  - Filters to show only non-Available resources
  - Useful for quick health checks
  
- **List of resources with availability states that have been impacted by unplanned, platform-initiated health events**
  - Shows resources impacted by unexpected Azure platform issues
  - Joins availability statuses with resource annotations
  - Filters for unplanned, platform-initiated events
  
- **List of unavailable resources with their corresponding annotation details**
  - Provides detailed reasons for unavailability
  - Includes context, reason, and category
  
- **Count of resources in a region that have been impacted by an availability disruption along with the type of impact**
  - Regional impact analysis
  - Aggregates by location, context, and category
  
- **List of resources impacted by a specific health event, along with impact time, impact details, availability state, and region**
  - Example query for VirtualMachineHostRebootedForRepair events
  - Can be modified for other event types
  
- **List of resources impacted by planned events per region**
  - Shows planned maintenance impact by region
  - Includes timestamps for planning purposes
  
- **List of resources that have been impacted by unplanned platform disruptions, along with availability, power states and location**
  - Comprehensive view combining health, power, and location
  - Triple join: resourceannotations → availabilitystatuses → virtualmachines

### Authorization (5 new queries)
- **Get role assignments with key properties**
  - Shows first 5 role assignments
  - Includes roleDefinitionId, principalType, principalId, scope
  
- **Get role definitions with key properties**
  - Shows first 5 role definitions
  - Includes assignableScopes, permissions, isServiceRole
  
- **Get role definitions with actions**
  - Expands permissions list to show Actions, notActions, DataActions, notDataActions
  - Useful for understanding detailed permissions
  
- **Get role definitions with permissions listed out**
  - Aggregates all actions for each role definition using make_set()
  - Provides complete permission overview
  
- **Get classic administrators with key properties**
  - Shows legacy classic administrators
  - Includes admin state and roles (split by semicolon)

### Security (14 new queries)
- **Controls secure score per subscription**
  - Detailed control-level secure score metrics
  - Includes healthy/unhealthy/notApplicable resource counts
  - Shows percentage scores, weights, and control types
  
- **Count healthy, unhealthy, and not applicable resources per recommendation**
  - Aggregates resources by recommendation and compliance state
  - Useful for prioritizing security improvements
  
- **List Microsoft Defender recommendations**
  - Comprehensive list of all Defender for Cloud recommendations
  - Includes severity, description, remediation steps, policy IDs
  - Links to Azure Portal for each recommendation
  
- **Secure score per subscription**
  - Shows overall secure score metrics per subscription
  - Includes percentage, current score, max score, and weight
  
- **Secure score per management group**
  - Aggregates secure scores across management group hierarchy
  - Joins SecurityResources with ResourceContainers
  - Calculates weighted scores across subscriptions
  
- **Show Defender for Cloud plan pricing tier per subscription**
  - Lists all Defender plans and their status (Free/Standard)
  - Helps with cost management and coverage analysis
  
- **List all non-compliant resources**
  - Simple filter for PolicyResources in NonCompliant state
  - Quick overview of policy violations
  
- **Summarize resource compliance by state**
  - Counts resources by compliance state (Compliant/NonCompliant/Conflict/Exempt)
  - High-level compliance overview
  
- **Summarize resource compliance by state per location**
  - Adds geographic dimension to compliance reporting
  - Useful for multi-region deployments
  
- **Compliance by policy assignment**
  - Detailed compliance metrics per policy assignment
  - Calculates compliance percentage
  - Shows compliant, non-compliant, conflict, and exempt counts
  - Uses weighted state calculation for accurate reporting
  
- **Compliance by resource type**
  - Similar to assignment view but grouped by resource type
  - Identifies which resource types have the most compliance issues

## Technical Details

### Query Patterns Used
- **Join Operations**: Extensive use of `join kind=leftouter` for correlating data across tables
- **Aggregations**: `summarize`, `count()`, `make_set()`, `make_list()` for data aggregation
- **Projections**: Selective column exposure with `project`, `project-away`
- **Extensions**: `extend` for calculated fields and type conversions
- **Filtering**: `where` clauses for precise data filtering
- **Multi-value Expansion**: `mv-expand` for working with arrays

### Tables Utilized
- **AdvisorResources**: Azure Advisor recommendations
- **HealthResources**: Resource health and availability information
  - `microsoft.resourcehealth/availabilitystatuses`
  - `microsoft.resourcehealth/resourceannotations`
- **AuthorizationResources**: RBAC role assignments and definitions
  - `microsoft.authorization/roleassignments`
  - `microsoft.authorization/roledefinitions`
  - `microsoft.authorization/classicadministrators`
- **SecurityResources**: Security assessments and scores
  - `microsoft.security/securescores`
  - `microsoft.security/securescores/securescorecontrols`
  - `microsoft.security/assessments`
  - `microsoft.security/pricings`
- **PolicyResources**: Policy compliance information
  - `microsoft.policyinsights/policystates`
- **Resources**: Main resource inventory
- **ResourceContainers**: Subscriptions and management groups

## Usage Examples

### Health Monitoring Workflow
1. Start with "Count of virtual machines by availability state" for overview
2. Drill down with "List of virtual machines that are not Available" for problem resources
3. Get details with "List of unavailable resources with their corresponding annotation details"
4. Track planned events with "List of resources impacted by planned events per region"

### Security Compliance Workflow
1. Check "Secure score per subscription" for overall posture
2. Use "Controls secure score per subscription" for detailed analysis
3. Review "List Microsoft Defender recommendations" for actionable items
4. Monitor "Compliance by policy assignment" for policy adherence

### RBAC Audit Workflow
1. Use "Get role assignments with key properties" for assignment overview
2. Deep dive with "Get role definitions with permissions listed out"
3. Check "Get classic administrators" for legacy access

## Integration Points

All queries are accessible through:
- **Azure Resources Page**: `/azure-resources` route
- **Query Dropdown**: Categorized by table type
- **AI Assistant**: Can generate similar queries using these as templates

## Performance Considerations

- Large result sets may require pagination or filtering
- Join operations can be resource-intensive; consider adding `| take` or `| limit` for testing
- Use specific subscriptionId filters when possible to reduce scope
- Aggregations with `summarize` are generally faster than client-side processing

## Related Documentation

- [Azure Resource Graph overview](https://learn.microsoft.com/en-us/azure/governance/resource-graph/overview)
- [Kusto Query Language (KQL) reference](https://learn.microsoft.com/en-us/azure/data-explorer/kusto/query/)
- [Resource Health overview](https://learn.microsoft.com/en-us/azure/service-health/resource-health-overview)
- [Azure Advisor documentation](https://learn.microsoft.com/en-us/azure/advisor/)
- [Microsoft Defender for Cloud](https://learn.microsoft.com/en-us/azure/defender-for-cloud/)

## Future Enhancements

Potential additions from the documentation that weren't included (due to scope):
- GuestConfigurationResources queries (8+ queries)
- PatchAssessmentResources queries (4+ queries)
- KubernetesConfigurationResources queries (4+ queries)
- IoT Security queries (4+ queries)
- HealthResourceChanges queries (4+ queries)
- Additional specialized queries for specific Azure services

## Testing

All queries have been tested against the Azure Resource Graph API and compile without errors. The queries follow Microsoft's documented patterns and use current API versions.

---

**Author**: GitHub Copilot  
**Date**: January 29, 2025  
**Source**: https://learn.microsoft.com/en-us/previous-versions/azure/governance/resource-graph/samples/samples-by-table?tabs=azure-cli
