# ServiceNow Incident Adaptive Card for Copilot Studio

This guide explains how to use the ServiceNow Incident Adaptive Card in your Copilot Studio chat.

## Overview

The Adaptive Card displays key ServiceNow incident information in a clean, professional format that works seamlessly in Microsoft Teams, Copilot Studio, and other Adaptive Card hosts.

## Schema Location

The Adaptive Card JSON schema is located at:
```
docs/servicenow-incident-adaptive-card.json
```

## Supported Hosts

This card uses **Adaptive Card schema version 1.5**, which is compatible with:
- ✅ **Copilot Studio** (all versions)
- ✅ **Microsoft Teams** (version 1.5 and earlier)
- ✅ **Bot Framework Web Chat**
- ✅ **Dynamics 365 Omnichannel**

## How to Use in Copilot Studio

### Step 1: Add an Adaptive Card Node

1. In Copilot Studio, open your topic
2. Select **Add node** (+) → **Send a message** or **Ask with adaptive card**
3. In the message node, select **Add** → **Adaptive Card**
4. Select **Edit adaptive card** to open the designer

### Step 2: Paste the JSON Schema

1. Open `docs/servicenow-incident-adaptive-card.json`
2. Copy the entire JSON content
3. In the Copilot Studio **Card payload editor**, paste the JSON
4. Select **Save**

### Step 3: Bind Your Data

The card uses templating variables (denoted by `${variable_name}`). You need to map these to your data source.

## Variable Mapping

The card expects the following variables:

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `${number}` | Incident number | "INC0010001" |
| `${short_description}` | Brief incident summary | "Cannot access email" |
| `${description}` | Detailed incident description | "User reports unable to access Outlook..." |
| `${state_display}` | Current state (human-readable) | "In Progress" |
| `${priority_display}` | Priority level (human-readable) | "2 - High" |
| `${urgency_display}` | Urgency level (human-readable) | "2 - Medium" |
| `${impact_display}` | Impact level (human-readable) | "2 - Medium" |
| `${category}` | Incident category | "Software" |
| `${assigned_to_display}` | Assigned technician name | "John Smith" |
| `${assignment_group_display}` | Assigned team/group | "Service Desk" |
| `${opened_at}` | Date/time opened (ISO 8601) | "2025-11-30T10:30:00Z" |
| `${caller_id_display}` | Person who reported the incident | "Jane Doe" |
| `${cmdb_ci_display}` | Configuration item name | "LAPTOP-123" |
| `${company_display}` | Company name | "Contoso Ltd" |
| `${sys_id}` | ServiceNow system ID | "abc123xyz" |
| `${instance_url}` | ServiceNow instance URL | "https://dev12345.service-now.com" |

## Sample Data

Here's a complete example of data to populate the card:

```json
{
  "number": "INC0010234",
  "short_description": "Unable to access shared drive",
  "description": "User reports that they cannot access the Finance shared drive. Error message states 'Access Denied'. User confirmed they have been accessing this drive successfully until this morning.",
  "state_display": "In Progress",
  "priority_display": "2 - High",
  "urgency_display": "2 - Medium",
  "impact_display": "2 - Medium",
  "category": "Network",
  "assigned_to_display": "David Wilson",
  "assignment_group_display": "Network Support",
  "opened_at": "2025-11-30T08:15:00Z",
  "caller_id_display": "Sarah Johnson",
  "cmdb_ci_display": "FileServer-FS01",
  "company_display": "Contoso Corporation",
  "sys_id": "a1b2c3d4e5f6g7h8i9j0",
  "instance_url": "https://dev12345.service-now.com"
}
```

## Connecting to Your ServiceNow API

### In Copilot Studio Flow

1. **Create a Power Automate Flow** that calls your ServiceNow API
2. **Parse the JSON response** to extract incident data
3. **Map the fields** to the variables expected by the Adaptive Card
4. **Return the data** to Copilot Studio

### Example Power Automate HTTP Action

```
Action: HTTP
Method: GET
URI: https://your-instance.service-now.com/api/now/table/incident/{sys_id}
Headers:
  Accept: application/json
  Authorization: Basic {base64_encoded_credentials}
Query Parameters:
  sysparm_display_value: all
  sysparm_fields: number,short_description,description,state,priority,urgency,impact,category,assigned_to,assignment_group,opened_at,caller_id,cmdb_ci,company,sys_id
```

### Using Portal of Portals API

If you're using this app's built-in ServiceNow integration:

```javascript
// In Copilot Studio, call your API endpoint
const incidentData = await fetch('/api/servicenow/incidents?sys_id=' + sysId);

// The response already includes properly formatted display values
// that match the Adaptive Card variable names
```

## Customization Options

### Changing Colors

To change the header accent color, modify the `color` property:
```json
{
  "type": "TextBlock",
  "text": "ServiceNow Incident",
  "color": "Accent"  // Options: Default, Dark, Light, Accent, Good, Warning, Attention
}
```

### Priority/State Color Coding

You can add conditional formatting based on priority:

```json
{
  "title": "Priority:",
  "value": "${priority_display}",
  "color": "${if(priority == '1', 'Attention', if(priority == '2', 'Warning', 'Good'))}"
}
```

### Adding More Fields

To add additional fields, add entries to the `FactSet`:

```json
{
  "type": "FactSet",
  "facts": [
    // ... existing facts ...
    {
      "title": "Business Service:",
      "value": "${business_service_display}"
    },
    {
      "title": "Contact Type:",
      "value": "${contact_type}"
    }
  ]
}
```

### Custom Actions

To add custom buttons, add to the `actions` array:

```json
{
  "type": "Action.Submit",
  "title": "Assign to Me",
  "data": {
    "action": "assign_to_me",
    "sys_id": "${sys_id}"
  }
}
```

## Testing the Card

### In Adaptive Card Designer

1. Visit https://adaptivecards.io/designer/
2. Paste the JSON schema
3. In the **Sample Data Editor**, paste your test data
4. Toggle **Preview Mode** to see the rendered card

### In Copilot Studio Test Chat

1. After adding the card to your topic
2. Use the **Test your copilot** pane
3. Trigger the topic and verify the card displays correctly

## Troubleshooting

### Card Not Displaying

- **Check schema version**: Ensure version is 1.5 or earlier for Teams/Omnichannel
- **Validate JSON**: Use a JSON validator to ensure proper syntax
- **Verify data binding**: Check that all `${variables}` are being populated

### Missing Data

- **Check variable names**: Ensure exact case-sensitive match
- **Verify API response**: Confirm your ServiceNow API returns expected fields
- **Use sysparm_display_value**: Set to `all` or `true` to get human-readable values

### Images Not Loading

- **Icon URL**: Update the ServiceNow logo URL if needed
- **HTTPS required**: All image URLs must use HTTPS protocol
- **Public URLs**: Images must be publicly accessible or use data URIs

## Advanced Features

### Templating with Conditional Visibility

Hide fields when data is not available:

```json
{
  "type": "TextBlock",
  "text": "**Subcategory:** ${subcategory}",
  "isVisible": "${if(subcategory, true, false)}"
}
```

### Refresh Actions (Teams Only)

Enable automatic card refresh in Teams:

```json
{
  "type": "AdaptiveCard",
  "version": "1.4",
  "refresh": {
    "action": {
      "type": "Action.Execute",
      "title": "Refresh",
      "verb": "refreshIncident"
    },
    "userIds": []
  }
}
```

## Best Practices

1. **Use display values**: Always fetch `sysparm_display_value=all` for human-readable text
2. **Keep it concise**: Show 5-10 key fields; use "View in ServiceNow" for full details
3. **Test across hosts**: Preview in Teams, Bot Framework, and Copilot Studio
4. **Handle nulls**: Use conditional visibility for optional fields
5. **Responsive design**: Avoid fixed widths; use `stretch` and `auto`
6. **Accessibility**: Include alt text for images and clear labels

## Schema Version Notes

- **Version 1.6**: Full feature support in Bot Framework Web Chat (excludes `Action.Execute`)
- **Version 1.5**: Recommended for Teams and Omnichannel compatibility
- **Version 1.4**: Use if you need Universal Actions in Teams
- **Version 1.0-1.3**: Legacy support, limited features

## Support and Resources

- **Adaptive Cards Documentation**: https://adaptivecards.io
- **Copilot Studio Cards Guide**: https://learn.microsoft.com/microsoft-copilot-studio/adaptive-cards-overview
- **Schema Explorer**: https://adaptivecards.io/explorer/
- **Sample Cards**: https://adaptivecards.io/samples/

## Additional Examples

See also:
- `docs/servicenow-incident-adaptive-card-minimal.json` - Simplified version with fewer fields
- `docs/servicenow-incident-adaptive-card-teams.json` - Teams-optimized with Universal Actions
- `docs/servicenow-incident-adaptive-card-whatsapp.json` - WhatsApp-compatible version

---

**Need help?** Check the [Copilot Studio documentation](https://learn.microsoft.com/microsoft-copilot-studio/) or open an issue in this repository.
