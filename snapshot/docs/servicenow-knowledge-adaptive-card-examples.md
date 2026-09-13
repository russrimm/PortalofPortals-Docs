# ServiceNow Knowledge Article Adaptive Card - Quick Examples

## Example 1: Simple Static Card (For Testing)

Copy this into Copilot Studio's Adaptive Card payload editor with hardcoded values:

```json
{
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "type": "AdaptiveCard",
  "version": "1.5",
  "body": [
    {
      "type": "Container",
      "items": [
        {
          "type": "ColumnSet",
          "columns": [
            {
              "type": "Column",
              "width": "auto",
              "items": [
                {
                  "type": "Image",
                  "url": "https://www.servicenow.com/content/dam/servicenow-assets/images/meganav/servicenow-header-logo.svg",
                  "size": "Small",
                  "width": "40px"
                }
              ]
            },
            {
              "type": "Column",
              "width": "stretch",
              "items": [
                {
                  "type": "TextBlock",
                  "text": "Knowledge Article",
                  "weight": "Bolder",
                  "size": "Medium",
                  "color": "Accent"
                },
                {
                  "type": "TextBlock",
                  "text": "KB0010001",
                  "size": "Large",
                  "weight": "Bolder",
                  "spacing": "None"
                }
              ],
              "verticalContentAlignment": "Center"
            }
          ]
        }
      ],
      "style": "emphasis"
    },
    {
      "type": "Container",
      "spacing": "Medium",
      "items": [
        {
          "type": "TextBlock",
          "text": "How to Reset Your Password",
          "size": "Large",
          "weight": "Bolder",
          "wrap": true
        },
        {
          "type": "TextBlock",
          "text": "Step-by-step guide for resetting your account password through the self-service portal",
          "wrap": true,
          "isSubtle": true,
          "spacing": "Small",
          "size": "Medium"
        }
      ]
    },
    {
      "type": "FactSet",
      "spacing": "Medium",
      "separator": true,
      "facts": [
        {
          "title": "Workflow State:",
          "value": "Published"
        },
        {
          "title": "Knowledge Base:",
          "value": "IT Service Management"
        },
        {
          "title": "Category:",
          "value": "Account Management"
        },
        {
          "title": "Author:",
          "value": "John Smith"
        },
        {
          "title": "Views:",
          "value": "1,247"
        }
      ]
    },
    {
      "type": "Container",
      "spacing": "Medium",
      "separator": true,
      "items": [
        {
          "type": "TextBlock",
          "text": "If you've forgotten your password, you can easily reset it using the self-service portal. This guide will walk you through the simple steps to regain access to your account securely.",
          "wrap": true,
          "spacing": "Small",
          "maxLines": 5,
          "isSubtle": true
        }
      ]
    }
  ],
  "actions": [
    {
      "type": "Action.OpenUrl",
      "title": "View Full Article",
      "url": "https://dev226313.service-now.com/kb_view.do?sys_kb_id=abcd1234567890",
      "style": "positive"
    }
  ]
}
```

## Example 2: Power Automate Flow Integration

### Flow Overview
1. Trigger: When Copilot Studio requests knowledge search
2. Action: HTTP request to ServiceNow Knowledge API
3. Action: Parse JSON response
4. Action: Transform data for Adaptive Card
5. Return: Formatted card data to Copilot Studio

### Power Automate HTTP Action Configuration

**URL:**
```
https://yourinstance.service-now.com/api/now/knowledge/search
```

**Method:** GET

**Headers:**
```json
{
  "Accept": "application/json",
  "Content-Type": "application/json"
}

```

**Authentication:** Basic (use ServiceNow credentials)

**Query Parameters:**
```
text=@{triggerBody()?['searchQuery']}
limit=5
offset=0
fields=short_description,text,workflow_state,author,kb_knowledge_base,kb_category,sys_created_on,sys_updated_on,sys_view_count
```

### Parse JSON Schema

Use this schema to parse the ServiceNow response:

```json
{
  "type": "object",
  "properties": {
    "result": {
      "type": "object",
      "properties": {
        "articles": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": { "type": "string" },
              "sys_id": { "type": "string" },
              "number": { "type": "string" },
              "title": { "type": "string" },
              "snippet": { "type": "string" },
              "score": { "type": "number" },
              "fields": {
                "type": "object",
                "properties": {
                  "workflow_state": {
                    "type": "object",
                    "properties": {
                      "display_value": { "type": "string" }
                    }
                  },
                  "short_description": { "type": "string" },
                  "author": {
                    "type": "object",
                    "properties": {
                      "display_value": { "type": "string" }
                    }
                  },
                  "kb_knowledge_base": {
                    "type": "object",
                    "properties": {
                      "display_value": { "type": "string" }
                    }
                  },
                  "kb_category": {
                    "type": "object",
                    "properties": {
                      "display_value": { "type": "string" }
                    }
                  },
                  "sys_created_on": { "type": "string" },
                  "sys_updated_on": { "type": "string" },
                  "sys_view_count": { "type": "string" }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

### Data Transformation Compose Action

Use a Compose action to transform each article:

```
{
  "sys_id": @{items('Apply_to_each')?['sys_id']},
  "number": @{items('Apply_to_each')?['number']},
  "title": @{items('Apply_to_each')?['title']},
  "short_description": @{items('Apply_to_each')?['fields']?['short_description']},
  "workflow_state": @{items('Apply_to_each')?['fields']?['workflow_state']?['display_value']},
  "kb_knowledge_base": @{items('Apply_to_each')?['fields']?['kb_knowledge_base']?['display_value']},
  "kb_category": @{items('Apply_to_each')?['fields']?['kb_category']?['display_value']},
  "author": @{items('Apply_to_each')?['fields']?['author']?['display_value']},
  "sys_created_on": @{items('Apply_to_each')?['fields']?['sys_created_on']},
  "sys_updated_on": @{items('Apply_to_each')?['fields']?['sys_updated_on']},
  "sys_view_count": @{items('Apply_to_each')?['fields']?['sys_view_count']},
  "snippet": @{items('Apply_to_each')?['snippet']},
  "relevance_percentage": @{mul(items('Apply_to_each')?['score'], 100)},
  "instance_url": "https://yourinstance.service-now.com"
}
```

## Example 3: Direct API Integration (Node.js/JavaScript)

```javascript
// Fetch knowledge article from ServiceNow
async function getKnowledgeArticle(articleId, instanceUrl, username, password) {
  const auth = Buffer.from(`${username}:${password}`).toString('base64');
  
  const response = await fetch(
    `${instanceUrl}/api/now/table/kb_knowledge/${articleId}` +
    `?sysparm_fields=sys_id,number,short_description,text,workflow_state,` +
    `author,kb_knowledge_base,kb_category,sys_created_on,sys_updated_on,sys_view_count` +
    `&sysparm_display_value=true`,
    {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    }
  );
  
  const data = await response.json();
  return transformForAdaptiveCard(data.result, instanceUrl);
}

// Transform ServiceNow data for Adaptive Card
function transformForAdaptiveCard(article, instanceUrl) {
  return {
    sys_id: article.sys_id,
    number: article.number,
    title: article.short_description,
    short_description: article.short_description,
    workflow_state: article.workflow_state || 'Unknown',
    kb_knowledge_base: article.kb_knowledge_base || 'N/A',
    kb_category: article.kb_category || 'Uncategorized',
    author: article.author || 'Unknown',
    sys_created_on: article.sys_created_on,
    sys_updated_on: article.sys_updated_on,
    sys_view_count: article.sys_view_count || '0',
    snippet: article.text ? article.text.substring(0, 300) + '...' : 'No content available',
    relevance_percentage: null,
    instance_url: instanceUrl
  };
}

// Usage
const cardData = await getKnowledgeArticle(
  'abcd1234567890',
  'https://dev226313.service-now.com',
  'username',
  'password'
);

// Send to Copilot Studio
console.log(JSON.stringify(cardData, null, 2));
```

## Example 4: Python Integration

```python
import requests
import base64
from typing import Dict, Optional

class ServiceNowKnowledgeAdapter:
    def __init__(self, instance_url: str, username: str, password: str):
        self.instance_url = instance_url.rstrip('/')
        self.auth = base64.b64encode(f"{username}:{password}".encode()).decode()
        
    def get_article(self, article_id: str) -> Dict:
        """Fetch a knowledge article from ServiceNow"""
        url = f"{self.instance_url}/api/now/table/kb_knowledge/{article_id}"
        params = {
            'sysparm_fields': 'sys_id,number,short_description,text,workflow_state,' +
                            'author,kb_knowledge_base,kb_category,sys_created_on,' +
                            'sys_updated_on,sys_view_count',
            'sysparm_display_value': 'true'
        }
        headers = {
            'Authorization': f'Basic {self.auth}',
            'Accept': 'application/json'
        }
        
        response = requests.get(url, params=params, headers=headers)
        response.raise_for_status()
        
        data = response.json()
        return self.transform_for_adaptive_card(data['result'])
    
    def search_articles(self, query: str, limit: int = 5) -> list:
        """Search knowledge articles"""
        url = f"{self.instance_url}/api/now/knowledge/search"
        params = {
            'text': query,
            'limit': limit,
            'fields': 'short_description,text,workflow_state,author,' +
                     'kb_knowledge_base,kb_category,sys_created_on,' +
                     'sys_updated_on,sys_view_count'
        }
        headers = {
            'Authorization': f'Basic {self.auth}',
            'Accept': 'application/json'
        }
        
        response = requests.get(url, params=params, headers=headers)
        response.raise_for_status()
        
        data = response.json()
        articles = data.get('result', {}).get('articles', [])
        
        return [self.transform_search_result(article) for article in articles]
    
    def transform_for_adaptive_card(self, article: Dict) -> Dict:
        """Transform Table API response for Adaptive Card"""
        return {
            'sys_id': article.get('sys_id', ''),
            'number': article.get('number', ''),
            'title': article.get('short_description', 'Untitled'),
            'short_description': article.get('short_description', ''),
            'workflow_state': article.get('workflow_state', 'Unknown'),
            'kb_knowledge_base': article.get('kb_knowledge_base', 'N/A'),
            'kb_category': article.get('kb_category', 'Uncategorized'),
            'author': article.get('author', 'Unknown'),
            'sys_created_on': article.get('sys_created_on', ''),
            'sys_updated_on': article.get('sys_updated_on', ''),
            'sys_view_count': article.get('sys_view_count', '0'),
            'snippet': self._create_snippet(article.get('text', '')),
            'relevance_percentage': None,
            'instance_url': self.instance_url
        }
    
    def transform_search_result(self, article: Dict) -> Dict:
        """Transform Knowledge API search result for Adaptive Card"""
        fields = article.get('fields', {})
        
        return {
            'sys_id': article.get('sys_id', ''),
            'number': article.get('number', ''),
            'title': article.get('title', 'Untitled'),
            'short_description': fields.get('short_description', ''),
            'workflow_state': self._get_display_value(fields.get('workflow_state')),
            'kb_knowledge_base': self._get_display_value(fields.get('kb_knowledge_base')),
            'kb_category': self._get_display_value(fields.get('kb_category')),
            'author': self._get_display_value(fields.get('author')),
            'sys_created_on': fields.get('sys_created_on', ''),
            'sys_updated_on': fields.get('sys_updated_on', ''),
            'sys_view_count': fields.get('sys_view_count', '0'),
            'snippet': article.get('snippet', ''),
            'relevance_percentage': int(article.get('score', 0) * 100) if article.get('score') else None,
            'instance_url': self.instance_url
        }
    
    @staticmethod
    def _get_display_value(field: Optional[Dict]) -> str:
        """Extract display_value from ServiceNow field object"""
        if isinstance(field, dict):
            return field.get('display_value', 'Unknown')
        return str(field) if field else 'Unknown'
    
    @staticmethod
    def _create_snippet(text: str, max_length: int = 300) -> str:
        """Create a snippet from article text"""
        if not text:
            return 'No content available'
        
        if len(text) <= max_length:
            return text
        
        return text[:max_length] + '...'


# Usage Example
if __name__ == '__main__':
    adapter = ServiceNowKnowledgeAdapter(
        instance_url='https://dev226313.service-now.com',
        username='your_username',
        password='your_password'
    )
    
    # Search for articles
    results = adapter.search_articles('password reset')
    
    # Print first result formatted for Adaptive Card
    if results:
        import json
        print(json.dumps(results[0], indent=2))
```

## Example 5: Copilot Studio Power Fx Formula

In Copilot Studio, use this Power Fx formula to bind variables to the Adaptive Card:

```powerfx
{
  sys_id: Topic.KBArticle.sys_id,
  number: Topic.KBArticle.number,
  title: Topic.KBArticle.title,
  short_description: Topic.KBArticle.short_description,
  workflow_state: Topic.KBArticle.workflow_state,
  kb_knowledge_base: Topic.KBArticle.kb_knowledge_base,
  kb_category: Topic.KBArticle.kb_category,
  author: Topic.KBArticle.author,
  sys_created_on: Text(Topic.KBArticle.sys_created_on, DateTimeFormat.ShortDateTime),
  sys_updated_on: Text(Topic.KBArticle.sys_updated_on, DateTimeFormat.ShortDateTime),
  sys_view_count: Text(Topic.KBArticle.sys_view_count),
  snippet: If(
    Len(Topic.KBArticle.text) > 300,
    Left(Topic.KBArticle.text, 300) & "...",
    Topic.KBArticle.text
  ),
  relevance_percentage: If(
    !IsBlank(Topic.KBArticle.score),
    Text(Round(Topic.KBArticle.score * 100, 0)),
    ""
  ),
  instance_url: "https://yourinstance.service-now.com"
}
```

## Testing the Card

### Option 1: Adaptive Cards Designer
1. Go to https://adaptivecards.io/designer/
2. Paste the card JSON from `servicenow-knowledge-adaptive-card.json`
3. In the "Sample Data Editor" on the right, paste your test data
4. Preview the rendered card

### Option 2: Copilot Studio Test Chat
1. In Copilot Studio, open your topic
2. Add the Adaptive Card node
3. Use the test chat panel on the right
4. Trigger the topic and verify the card displays correctly

### Option 3: Teams App Test Tool
1. Use the Teams App Test Tool for testing in the Teams environment
2. Deploy your bot to Teams
3. Send a message that triggers the knowledge article card
4. Verify rendering in Teams light and dark mode

## Common Issues and Solutions

### Issue: Dates showing as raw ISO strings
**Solution:** Ensure dates are properly formatted in ServiceNow response:
```javascript
sys_created_on: new Date(article.sys_created_on).toISOString()
```

### Issue: Empty or null fields showing "Unknown"
**Solution:** Use conditional visibility in the card:
```json
{
  "type": "TextBlock",
  "text": "${author}",
  "isVisible": "${if(author != 'Unknown', true, false)}"
}
```

### Issue: Snippet contains HTML tags
**Solution:** Strip HTML before sending to card:
```javascript
snippet: article.text.replace(/<[^>]*>/g, '').substring(0, 300)
```

### Issue: Action buttons don't work
**Solution:** Verify URLs are complete and properly encoded:
```javascript
const articleUrl = `${instanceUrl}/kb_view.do?sys_kb_id=${encodeURIComponent(sysId)}`;
```
