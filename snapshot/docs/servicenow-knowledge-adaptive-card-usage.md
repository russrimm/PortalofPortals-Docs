# ServiceNow Knowledge Article Adaptive Card for Copilot Studio

This document explains how to use the ServiceNow Knowledge Article Adaptive Card in Microsoft Copilot Studio.

## Overview

The `servicenow-knowledge-adaptive-card.json` provides a rich, interactive card template for displaying ServiceNow knowledge base articles in Copilot Studio conversations. The card follows Microsoft's Adaptive Card best practices and is optimized for Copilot Studio (version 1.5 schema).

## Card Features

### Visual Elements
- **ServiceNow Branding**: Displays the ServiceNow logo for instant recognition
- **Article Number Badge**: Prominently shows the knowledge article number (e.g., KB0010001)
- **Title and Description**: Clear display of article title and short description
- **Content Preview**: Shows a snippet of the article content (up to 5 lines)

### Information Display
The card uses a `FactSet` to display key article metadata:
- Article Number
- Workflow State (e.g., Published, Draft, Retired)
- Knowledge Base name
- Category
- Author
- Created Date (formatted)
- Last Updated Date (formatted)
- View Count

### Interactive Actions
Three action buttons are provided:
1. **View Full Article** (Primary/Positive style): Opens the article in the ServiceNow knowledge portal
2. **Open in ServiceNow**: Opens the article record in ServiceNow for editing
3. **Request Changes**: Submit button that can trigger a feedback workflow

## Required Data Fields

The card template uses the following data binding variables:

### Core Fields (Required)
- `${sys_id}` - Unique identifier for the knowledge article
- `${number}` - Article number (e.g., "KB0010001")
- `${title}` - Article title (from short_description field)
- `${short_description}` - Brief description of the article
- `${instance_url}` - Your ServiceNow instance URL (e.g., "https://yourinstance.service-now.com")

### Metadata Fields (Optional but Recommended)
- `${workflow_state}` - Current workflow state (Published, Draft, etc.)
- `${kb_knowledge_base}` - Name of the knowledge base
- `${kb_category}` - Article category
- `${author}` - Article author name
- `${sys_created_on}` - Creation timestamp (ISO format)
- `${sys_updated_on}` - Last update timestamp (ISO format)
- `${sys_view_count}` - Number of views
- `${snippet}` - Text preview/excerpt from article content
- `${relevance_percentage}` - Search relevance score (0-100)

## Sample Data Payload

Here's an example of how to populate the card with data in Copilot Studio:

```json
{
  "sys_id": "abcd1234567890efghijklmnopqrstuv",
  "number": "KB0010001",
  "title": "How to Reset Your Password",
  "short_description": "Step-by-step guide for resetting your account password through the self-service portal",
  "workflow_state": "Published",
  "kb_knowledge_base": "IT Service Management",
  "kb_category": "Account Management",
  "author": "John Smith",
  "sys_created_on": "2024-01-15T10:30:00Z",
  "sys_updated_on": "2024-11-20T14:45:00Z",
  "sys_view_count": "1247",
  "snippet": "If you've forgotten your password, you can easily reset it using the self-service portal. Follow these steps: 1. Navigate to the login page. 2. Click on 'Forgot Password' link below the login form. 3. Enter your username or email address. 4. Check your email for a password reset link...",
  "relevance_percentage": "95",
  "instance_url": "https://dev226313.service-now.com"
}
```

## Integration with ServiceNow API

### Using the Knowledge Management API

When fetching data from ServiceNow's Knowledge Management API (`/api/now/knowledge/search`), you'll receive results in this format:

```javascript
{
  "result": {
    "articles": [
      {
        "id": "kb_knowledge:abcd1234567890efghijklmnopqrstuv",
        "sys_id": "abcd1234567890efghijklmnopqrstuv",
        "number": "KB0010001",
        "title": "How to Reset Your Password",
        "snippet": "Step-by-step guide for resetting...",
        "score": 0.95,
        "fields": {
          "workflow_state": { "display_value": "Published" },
          "short_description": "Step-by-step guide...",
          "author": { "display_value": "John Smith" }
        }
      }
    ]
  }
}
```

### Data Transformation for Adaptive Card

Transform the API response to match the card's data binding format:

```javascript
function transformKnowledgeArticleForCard(article, instanceUrl) {
  return {
    sys_id: article.sys_id,
    number: article.number,
    title: article.title || article.fields?.short_description,
    short_description: article.fields?.short_description || article.title,
    workflow_state: article.fields?.workflow_state?.display_value || "Unknown",
    kb_knowledge_base: article.fields?.kb_knowledge_base?.display_value || "N/A",
    kb_category: article.fields?.kb_category?.display_value || "Uncategorized",
    author: article.fields?.author?.display_value || "Unknown",
    sys_created_on: article.fields?.sys_created_on || "",
    sys_updated_on: article.fields?.sys_updated_on || "",
    sys_view_count: article.fields?.sys_view_count || "0",
    snippet: article.snippet || article.fields?.text?.substring(0, 300),
    relevance_percentage: article.score ? Math.round(article.score * 100) : null,
    instance_url: instanceUrl
  };
}
```

## Using in Copilot Studio

### Step 1: Create a Message Node with Adaptive Card

1. In your Copilot Studio topic, add a **Message** node
2. Select **Add** → **Adaptive Card**
3. Open the **Adaptive Card designer**
4. Switch to the **Card payload editor** tab
5. Paste the contents of `servicenow-knowledge-adaptive-card.json`

### Step 2: Bind Data to the Card

You have two options for binding data:

#### Option A: Static Data (Testing)
Use the JSON editor to replace `${variable}` placeholders with actual values for testing.

#### Option B: Dynamic Data (Production)
1. Create a Power Automate flow or use a connector to fetch knowledge articles from ServiceNow
2. Store the returned data in Copilot Studio variables
3. Use Power Fx to bind the variables to the card:

```powerfx
{
  sys_id: Topic.ArticleId,
  number: Topic.ArticleNumber,
  title: Topic.ArticleTitle,
  short_description: Topic.ArticleDescription,
  workflow_state: Topic.ArticleState,
  kb_knowledge_base: Topic.KnowledgeBase,
  kb_category: Topic.Category,
  author: Topic.Author,
  sys_created_on: Topic.CreatedDate,
  sys_updated_on: Topic.UpdatedDate,
  sys_view_count: Topic.ViewCount,
  snippet: Topic.ArticleSnippet,
  relevance_percentage: Topic.RelevanceScore,
  instance_url: "https://yourinstance.service-now.com"
}
```

### Step 3: Handle Card Actions

Configure responses for the Submit action (Request Changes):

1. After the Adaptive Card node, add a **Condition** node
2. Check if `Topic.LastSubmitAction.action = "feedback"`
3. If true, trigger your feedback collection flow
4. Store the article_id and article_number from the submit data

## Best Practices

### Performance
- **Limit snippet length**: Keep content previews under 500 characters to avoid card overflow
- **Cache instance URL**: Store your ServiceNow instance URL as an environment variable
- **Lazy load full content**: Only fetch full article text when the user clicks "View Full Article"

### User Experience
- **Show relevance scores**: Display the relevance percentage for search results to help users find the best match
- **Use conditional visibility**: Hide fields that don't have values using `isVisible` conditions
- **Provide context**: Include the knowledge base name to help users understand the article's scope

### Accessibility
- **Alt text for images**: The card includes alt text for the ServiceNow logo
- **Readable text**: Uses standard sizes and weights for optimal readability
- **High contrast**: Works in both light and dark modes

### Responsive Design
- **Single column layout**: The card uses a single-column layout for optimal display on all screen sizes
- **Text wrapping**: All text blocks have `wrap: true` to handle narrow viewports
- **Flexible widths**: No fixed widths are used except for small icons

## Troubleshooting

### Card Doesn't Display
- Verify you're using Adaptive Cards schema version 1.5 or earlier
- Check that all required fields (sys_id, number, title, instance_url) have values
- Test the JSON in the [Adaptive Cards Designer](https://adaptivecards.io/designer/)

### Variables Not Populating
- Ensure variable names in Copilot Studio match the `${variable}` names in the card
- Use Power Fx syntax correctly when binding data
- Check that the data types match (text, numbers, dates)

### Dates Not Formatting
- Dates must be in ISO 8601 format (e.g., "2024-11-20T14:45:00Z")
- The `{{DATE()}}` function requires proper date strings
- Use Power Fx `Text()` function to convert dates if needed

### Actions Not Working
- For OpenUrl actions: Verify the instance_url is a complete URL with https://
- For Submit actions: Ensure you have a condition node to handle the submitted data
- Check that sys_id values are valid ServiceNow record identifiers

## Customization Options

### Modify Colors
To change the accent color from blue, update the header container:
```json
{
  "type": "Container",
  "style": "emphasis"  // or "good", "attention", "warning"
}
```

### Add More Fields
To display additional ServiceNow fields, add them to the FactSet:
```json
{
  "title": "Your Field Label:",
  "value": "${your_field_name}"
}
```

### Change Action Buttons
Modify the `actions` array to add, remove, or reorder buttons:
```json
{
  "type": "Action.OpenUrl",
  "title": "Your Button Text",
  "url": "${your_url}",
  "style": "positive"  // or "destructive" or omit for default
}
```

## Related Resources

- [Adaptive Cards Official Site](https://adaptivecards.io/)
- [Adaptive Cards Schema Explorer](https://adaptivecards.io/explorer/)
- [Copilot Studio Adaptive Cards Documentation](https://learn.microsoft.com/en-us/microsoft-copilot-studio/adaptive-cards-overview)
- [ServiceNow Knowledge Management API](https://docs.servicenow.com/bundle/xanadu-api-reference/page/integrate/inbound-rest/concept/c_KnowledgeAPI.html)
- [ServiceNow Table API Documentation](https://docs.servicenow.com/bundle/xanadu-api-reference/page/integrate/inbound-rest/concept/c_TableAPI.html)

## Support

For issues specific to:
- **Adaptive Card rendering**: Check Microsoft Copilot Studio documentation
- **ServiceNow data**: Verify your ServiceNow instance permissions and API access
- **This implementation**: Review the sample data format and transformation functions above
