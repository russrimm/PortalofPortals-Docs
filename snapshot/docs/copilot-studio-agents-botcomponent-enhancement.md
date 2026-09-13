# Copilot Studio Agents - Bot Component Enhancement

## Overview
Enhanced the Copilot Studio Agents modal on the Power Platform Environments page to display comprehensive bot information including Configuration data, all useful bot metadata fields, and bot components with their YAML/JSON definitions, enabling administrators to understand what each agent does.

## Implementation Dates
- Initial Enhancement: November 19, 2025
- Modal Overlay & Configuration Fields: November 19, 2025

## Changes Made

### 1. Modal Overlay Improvements
**File**: `src/app/power-platform/environments/page.jsx`

**What Changed**: Updated all modal overlays to be fully opaque to prevent background artifacts from showing through.

**Modal Updates**:
- **Agents Modal** (line ~5153): Changed from `bg-black/50` to `bg-black/90`
- **Solutions Modal** (line ~3748): Changed from `bg-black/50` to `bg-black/90`
- **Resources/Inventory Modal** (line ~4571): Changed from `bg-opacity-50` to `bg-opacity-90`

**Benefits**: Background content is now completely covered, providing better visual focus and preventing UI artifacts.

### 2. Data Fetching Enhancement
**File**: `src/app/power-platform/environments/page.jsx` (lines ~2310-2318)

**What Changed**: Expanded the Agent button onClick handler to fetch comprehensive bot data including Configuration field and additional useful metadata.

**Query Details**:
- **Bots**: 
  ```
  entitySet=bots&$top=100
  &$select=botid,name,schemaname,publishedon,statecode,statuscode,language,authorizationstatus,configuration,authenticationmode,accesscontrolpolicy,supportedlanguages,runtimeprovider,template,iconbase64
  &$expand=ownerid($select=fullname,systemuserid),publishedby($select=fullname)
  ```
- **Bot Components**: 
  ```
  entitySet=botcomponents&$top=1000
  &$select=botcomponentid,name,componenttype,content,language,data,description,category,parentbotid,_parentbotid_value
  ```

**New Fields Retrieved**:
- `configuration` - Bot configuration JSON data
- `authenticationmode` - How bot authenticates (None, Integrated, Custom AAD, OAuth2)
- `accesscontrolpolicy` - Who can access (Any, Copilot readers, Group membership)
- `supportedlanguages` - Multi-select list of supported languages
- `runtimeprovider` - Runtime environment (Power Virtual Agents, Nuance Mix Shell)
- `template` - Template identifier and version
- `iconbase64` - Bot icon in base64
- `publishedby` - User who published the bot (expanded with fullname)
- `description` (botcomponent) - Component description text
- `category` (botcomponent) - Component category

**Logic Flow**:
1. Fetch bots and botcomponents simultaneously using `Promise.all`
2. Group components by `_parentbotid_value` (links to bot table)
3. Attach components array to each bot object
4. Sort bots alphabetically by name
5. Pass enriched data to modal state

### 3. Enhanced Modal Display
**File**: `src/app/power-platform/environments/page.jsx` (lines ~5225-5420)

**Expandable Row Sections**:

#### A. Basic Bot Info (3-Column Grid Layout)
Displays comprehensive bot metadata:
- **Schema Name** - Logical schema name
- **Bot ID** - Unique identifier (monospace, full GUID)
- **Status** - Current status with formatted value
- **Owner** - Full name with system user ID
- **Published By** - User who published the bot
- **Language** - Primary language with formatted name
- **Authorization** - Authorization status
- **Auth Mode** - Authentication mode (None, Integrated, Custom AAD, OAuth2)
- **Access Policy** - Access control policy (Any, Copilot readers, Group membership, Multi-tenant)
- **Runtime** - Runtime provider (Power Virtual Agents, Nuance Mix Shell)
- **Template** - Template identifier

#### B. Bot Configuration Section
Displayed when `b.configuration` field is present:

**Configuration Display Features**:
- Collapsible `<details>` element with gear icon header
- "View Configuration" summary button
- Auto-formats JSON with 2-space indentation
- Falls back to raw text for non-JSON content
- Styled with monospace font in gray background
- Horizontal scroll for wide content
- Max height of 96 units (24rem) with scroll

**Use Case**: View complete bot configuration including settings, variables, channels, and other configuration data that defines bot behavior.

#### C. Bot Components Section
Displayed only when `b.components.length > 0`:

**Component Card Features**:
- Component name as header
- Component type with OData formatted value (Topic, Skill, Bot variable, etc.)
- Component category
- Component language
- Component description (truncated to 150 chars if longer)
- Component ID (first 8 chars displayed)
- Expandable "View Definition" details section

**YAML/JSON Display**:
- Uses `<details>` element for collapsible content
- Displays `comp.content` or `comp.data` field
- Auto-formats JSON with 2-space indentation
- Falls back to raw text for non-JSON (YAML, etc.)
- Styled with monospace font in gray background
- Horizontal scroll for wide content
- Max height of 96 units (24rem) with scroll

#### D. No Components Message
Displayed when no components found for the agent.

## Data Structure

### Bot Object (Enhanced)
```javascript
{
  botid: "guid",
  name: "Agent Name",
  schemaname: "new_agentname",
  publishedon: "2025-11-19T...",
  statecode: 0,
  statuscode: 1,
  language: 1033,
  authorizationstatus: 1,
  configuration: "{ ... }",  // Bot configuration JSON
  authenticationmode: 2,      // 0=Unspecified, 1=None, 2=Integrated, 3=Custom AAD, 4=OAuth2
  accesscontrolpolicy: 0,     // 0=Any, 1=Copilot readers, 2=Group membership, 3=Multi-tenant
  supportedlanguages: "1033;1036;1031",  // Multi-select picklist
  runtimeprovider: 0,         // 0=Power Virtual Agents, 1=Nuance Mix Shell
  template: "template_v1",
  iconbase64: "iVBORw0KG...",
  ownerid: {
    fullname: "John Doe",
    systemuserid: "guid"
  },
  publishedby: {
    fullname: "Jane Smith"
  },
  components: [ /* array of botcomponent objects */ ]
}
```

### Bot Component Object
```javascript
{
  botcomponentid: "guid",
  name: "Component Name",
  componenttype: 0,
  "componenttype@OData.Community.Display.V1.FormattedValue": "Topic",
  language: "en-US",
  category: "Custom",
  description: "Description of what this component does",
  parentbotid: "guid",
  _parentbotid_value: "guid",
  content: "{ ... }" or "yaml content",
  data: "alternative content field in OBI format"
}
```

## UI/UX Features

### Visual Hierarchy
1. **Top Level**: Bot name, published date, state (table row)
2. **Expanded Level**: Bot metadata + components section
3. **Component Cards**: Each component in bordered card with details

### Interaction Model
- Click bot row to expand/collapse
- Click "View Definition" to expand YAML/JSON
- Nested collapsible sections for better information density

### Styling
- **Light Mode**: White cards with gray borders
- **Dark Mode**: Dark gray cards with gray borders
- **Monospace**: Used for IDs and code content
- **Icons**: Chevron for row expansion, layers icon for components section

## Component Type Values (Reference)
Based on Dataverse botcomponent entity:
- `0` = Topic
- `1` = Skill
- `2` = Bot variable
- `3` = Bot entity
- `4` = Dialog
- `5` = Trigger
- `6` = Language understanding
- `7` = Language generation
- `8` = Dialog schema
- `9` = Topic (V2)
- `10` = Bot translations (V2)
- `11` = Bot entity (V2)
- `12` = Bot variable (V2)
- `13` = Skill (V2)
- `14` = Bot File Attachment
- `15` = Custom GPT
- `16` = Knowledge Source
- `17` = External Trigger
- `18` = Copilot Settings
- `19` = Test Case

## Authentication Mode Values
- `0` = Unspecified
- `1` = None
- `2` = Integrated
- `3` = Custom Azure Active Directory
- `4` = Generic OAuth2

## Access Control Policy Values
- `0` = Any
- `1` = Copilot readers
- `2` = Group membership
- `3` = Any (multi-tenant)

## Runtime Provider Values
- `0` = Power Virtual Agents
- `1` = Nuance Mix Shell

## Benefits

### For Administrators
✓ **Complete visibility** into agent structure, configuration, and components
✓ **Configuration inspection** to understand bot settings, variables, and channels
✓ **YAML/JSON inspection** to understand agent logic and component definitions
✓ **Comprehensive metadata** including auth mode, access policy, runtime provider, and template
✓ **Quick identification** of component types, categories, and descriptions
✓ **No need to open Copilot Studio** for basic agent introspection and configuration review

### For Troubleshooting
✓ Verify component relationships (ParentBotId links between bot and botcomponent tables)
✓ Inspect topic definitions and conversation flows
✓ Review language settings and authorizations
✓ Audit agent configurations across environments
✓ Understand bot configuration structure and settings
✓ Identify authentication and access control issues
✓ Compare bot configurations between environments

### For Security & Compliance
✓ Verify access control policies (Any, Copilot readers, Group membership)
✓ Audit authentication modes (None, Integrated, Custom AAD, OAuth2)
✓ Review authorized security group IDs
✓ Identify bots with permissive access settings
✓ Track published by information for change management

## Performance Considerations

### Parallel Fetching
Using `Promise.all` ensures both queries execute simultaneously, reducing total load time.

### Query Limits
- Bots: 100 per query (typically sufficient)
- Bot Components: 1000 per query (should handle most scenarios)

### Client-Side Grouping
Components are grouped by parent bot ID in the browser, avoiding complex server-side joins.

## Testing Checklist

- [x] Modal overlays are fully opaque (bg-black/90) and cover all background content
- [ ] Modal opens when clicking Agents count badge
- [ ] Both bots and components load without errors
- [ ] Configuration field displays and formats JSON correctly
- [ ] All new metadata fields display (authenticationmode, accesscontrolpolicy, etc.)
- [ ] Published By name displays correctly
- [ ] Components correctly grouped under parent bots
- [ ] Component descriptions display (truncated if >150 chars)
- [ ] Component categories display when present
- [ ] Expandable rows show/hide on click
- [ ] Bot Configuration section displays and collapses correctly
- [ ] Component YAML/JSON displays correctly in collapsible details
- [ ] JSON auto-formats with proper indentation
- [ ] YAML displays as raw text (no parse errors)
- [ ] Max height scroll works for long Configuration and Definition content
- [ ] Empty components message shows when no components exist
- [ ] All metadata fields display correctly with OData formatted values
- [ ] Light and dark mode styling works properly
- [ ] Modal closes with Close button or Escape key
- [ ] No console errors or warnings
- [ ] Solutions modal background fully covered
- [ ] Resources/Inventory modal background fully covered

## Error Handling

### API Failures
- If botcomponents query fails, bots still display (with empty components array)
- Error message shows in modal with troubleshooting tip
- Suggests checking application user permissions

### Missing Data
- Components without `_parentbotid_value` are silently ignored
- Missing `content` and `data` fields hide the definition section
- Graceful fallbacks for all optional fields (language, type, etc.)

## Future Enhancements (Optional)

1. **Syntax Highlighting**: Add YAML/JSON syntax highlighting library
2. **Search/Filter**: Add search box to filter components by name or type
3. **Export**: Add button to export component definitions
4. **Pagination**: Handle environments with >100 bots
5. **Deep Links**: Add links to open specific components in Copilot Studio
6. **Component Icons**: Show different icons based on component type
7. **Diff View**: Compare component versions across environments

## Related Documentation
- [Power Platform API Features](./power-platform-api-features.md)
- [Dataverse Organization API](./dataverse-organization-api.md)
- [Power Platform Implementation Summary](./power-platform-implementation-summary.md)

## References
- **Dataverse botcomponents table**: [Microsoft Learn](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/botcomponent)
- **Copilot Studio architecture**: [Microsoft Learn](https://learn.microsoft.com/en-us/microsoft-copilot-studio/advanced-bot-framework-composer)
