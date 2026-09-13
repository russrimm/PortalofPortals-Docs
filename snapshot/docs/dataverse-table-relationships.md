# Dataverse Table Relationships Viewer

## Overview

The relationships viewer provides a comprehensive view of all relationships for any Dataverse table, similar to the Power Platform admin center. This feature allows users to explore how tables are connected through one-to-many, many-to-one, and many-to-many relationships.

## Features

### Relationship Types

The viewer displays three types of relationships:

1. **Many-to-one relationships**: Where the current table references another table (lookup fields)
2. **One-to-many relationships**: Where other tables reference the current table
3. **Many-to-many relationships**: Where tables are connected through an intersect table

### Displayed Information

For each relationship, the following information is shown:

- **Display Name**: Human-readable name of the relationship (schema name with spaces)
- **Name**: The schema name of the relationship
- **Related Table**: The logical name of the related entity
  - For many-to-one: Shows the referenced (parent) table
  - For one-to-many: Shows the referencing (child) table
  - For many-to-many: Shows the other entity in the relationship
- **Relationship Type**: Many-to-one, One-to-many, or Many-to-many
- **Managed**: Whether the relationship is part of a managed solution
- **Customizable**: Whether the relationship can be customized

## Usage

### Accessing Relationships

1. Navigate to Power Platform > Environments
2. Select an environment
3. Click "View Tables" for that environment
4. In the tables list, click the **"Relationships"** link in the Actions column for any table

### Viewing Relationships

The relationships modal has three tabs:

- **Many-to-one tab**: Shows all lookup fields on the current table
- **One-to-many tab**: Shows all tables that reference the current table
- **Many-to-many tab**: Shows all N:N relationships involving the current table

Each tab displays a count of relationships in its label (e.g., "Many-to-one (15)").

### Understanding Relationship Direction

**Example**: For the "Flow Log" table

**Many-to-one relationships** (current table → referenced table):
- Flow Log has a lookup to Flow Machine (`flowmachine`)
- Flow Log has a lookup to Process (`workflow`)
- Flow Log has a lookup to User (`createdby`, `modifiedby`)

**One-to-many relationships** (referencing table → current table):
- Other tables that have lookups pointing to Flow Log

**Many-to-many relationships**:
- Direct N:N relationships between Flow Log and other entities

## Implementation Details

### API Endpoint

**Route**: `/api/power-platform/dataverse/table-relationships`

**Method**: GET

**Query Parameters**:
- `instanceUrl`: The Dataverse environment URL
- `logicalName`: The logical name of the table

**Authentication**: Uses On-Behalf-Of (OBO) flow to obtain Dataverse-scoped delegated token

### Metadata Query

The endpoint queries the `EntityDefinitions` entity with the following expansion:

```odata
$expand=OneToManyRelationships($select=SchemaName,ReferencedEntity,ReferencedAttribute,ReferencingEntity,ReferencingAttribute,IsManaged,IsCustomizable),
ManyToOneRelationships($select=SchemaName,ReferencedEntity,ReferencedAttribute,ReferencingEntity,ReferencingAttribute,IsManaged,IsCustomizable),
ManyToManyRelationships($select=SchemaName,Entity1LogicalName,Entity2LogicalName,IntersectEntityName,IsManaged,IsCustomizable)
```

### Components

**RelationshipsModal** (`src/app/power-platform/environments/components/RelationshipsModal.tsx`):
- Fetches relationship metadata from the API
- Displays relationships in a tabbed interface
- Shows loading states and error handling
- Responsive table layout with sticky header

**TablesModal** (`src/app/power-platform/environments/components/TablesModal.tsx`):
- Enhanced with "Relationships" action button in the Actions column
- Opens RelationshipsModal when clicked
- Passes required context (instanceUrl, logicalName, displayName)

### Data Transformation

The API transforms the raw Dataverse metadata into a consistent format:

```typescript
interface Relationship {
  schemaName: string              // e.g., "lk_flowlog_createdby"
  displayName: string             // e.g., "lk flowlog createdby"
  referencedEntity?: string       // For 1:N and N:1
  referencedAttribute?: string    // For 1:N and N:1
  referencingEntity?: string      // For 1:N and N:1
  referencingAttribute?: string   // For 1:N and N:1
  entity1?: string                // For N:N
  entity2?: string                // For N:N
  intersectEntity?: string        // For N:N
  relationshipType: string        // "One-to-many", "Many-to-one", "Many-to-many"
  isManaged: boolean
  isCustomizable: boolean
}
```

## Technical Notes

### Relationship Attributes

**For One-to-Many and Many-to-One**:
- `ReferencedEntity`: The parent table (the "one" side)
- `ReferencedAttribute`: The primary key of the parent table
- `ReferencingEntity`: The child table (the "many" side)
- `ReferencingAttribute`: The lookup field on the child table

**For Many-to-Many**:
- `Entity1LogicalName`: First entity in the relationship
- `Entity2LogicalName`: Second entity in the relationship
- `IntersectEntityName`: The hidden intersect table that stores the relationships

### Display Logic

The "Related Table" column shows:
- For **many-to-one**: `referencedEntity` (the table being looked up)
- For **one-to-many**: `referencingEntity` (the table with the lookup)
- For **many-to-many**: The other entity (whichever is not the current table)

### Performance Considerations

- Relationship metadata is fetched on-demand when the modal opens
- No caching is implemented (fresh data on every open)
- Query is scoped to a single table for optimal performance
- Expansion includes only necessary fields to minimize payload size

## Use Cases

1. **Understanding data model**: Explore how tables are interconnected
2. **Troubleshooting lookups**: Identify which fields create relationships
3. **Solution planning**: Determine relationship dependencies before customization
4. **Documentation**: Generate relationship diagrams or documentation
5. **Migration planning**: Understand relationship impacts before table changes

## Future Enhancements

Potential improvements:
- Display relationship attributes (ReferencedAttribute, ReferencingAttribute) in expandable rows
- Show cascade behavior (delete, assign, share, etc.)
- Filter relationships by managed/unmanaged status
- Export relationships to CSV or JSON
- Search/filter within relationships
- Direct navigation to related table's relationships
- Visual relationship diagram (ERD-style)

## See Also

- [Dataverse Web API EntityDefinitions](https://learn.microsoft.com/power-apps/developer/data-platform/webapi/reference/entitymetadata)
- [Table relationships overview](https://learn.microsoft.com/power-apps/maker/data-platform/create-edit-entity-relationships)
- [Elastic Tables Parent-Child Relationships](./elastic-tables-cosmos-db-setup.md)
