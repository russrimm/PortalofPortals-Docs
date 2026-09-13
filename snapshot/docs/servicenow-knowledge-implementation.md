# ServiceNow Knowledge Management Search Implementation

## Overview
Implemented a comprehensive ServiceNow Knowledge Base search feature that allows users to search, browse, and view knowledge articles from their ServiceNow instance.

## Implementation Date
November 29, 2025

## Features Implemented

### 1. Knowledge Article Search API
**File**: `src/app/api/servicenow/knowledge/route.js`

- GET endpoint for searching knowledge articles
- Supports all ServiceNow Knowledge Management API parameters:
  - `query`: Text search (optional, can be empty to browse all)
  - `limit`: Maximum results (default: 30)
  - `offset`: Pagination offset (default: 0)
  - `fields`: Comma-separated field list
  - `kb`: Knowledge base sys_ids filter
  - `language`: ISO 639-1 language code (default: en)
  - `filter`: Encoded query filter
- Environment variable support with fallback to request parameters
- Comprehensive error handling (401, 500)

### 2. Individual Article Detail API
**File**: `src/app/api/servicenow/knowledge/[id]/route.js`

- GET endpoint for fetching specific articles by sys_id or KB number
- Supports optional parameters:
  - `fields`: Comma-separated field list
  - `language`: Translation language
  - `update_view`: Increment view count (optional)
- Next.js 15 compatible (async params)
- Error handling for 401, 404, 500

### 3. Knowledge Search Page
**File**: `src/app/servicenow/knowledge/page.jsx`

**UI Components:**
- Search form with query input
- Results per page selector (10, 30, 50, 100)
- Search button with loading state
- Results count display
- Article cards grid with:
  - Article number badge
  - Relevancy score
  - Title and snippet
  - Article type and workflow state
  - Click to view details
- Pagination controls (Previous/Next)
- Article detail modal with:
  - Full article content (HTML rendered)
  - Article metadata
  - Attachments list (if any)
  - Close button
- Empty state when no articles found
- Error message display

**Features:**
- Auto-detects ServiceNow environment configuration
- Session-based authentication
- Responsive design (mobile, tablet, desktop)
- Loading states for better UX
- HTML content safely rendered with dangerouslySetInnerHTML

### 4. Navigation Integration
**File**: `src/app/graph-explorer/nav-areas.ts`

- Added "Knowledge Base" link to ServiceNow section
- Uses DocumentTextIcon (already imported)
- Appears alongside "Incidents" link

## API Reference

### Search Knowledge Articles
```
GET /api/servicenow/knowledge
```

**Query Parameters:**
- `query` (string, optional): Search text
- `limit` (number, default: 30): Max results
- `offset` (number, default: 0): Pagination offset
- `fields` (string, optional): Comma-separated fields
- `kb` (string, optional): Knowledge base sys_ids
- `language` (string, default: "en"): Language code
- `filter` (string, optional): Encoded query

**Response:**
```json
{
  "success": true,
  "result": {
    "meta": {
      "start": 0,
      "end": 30,
      "count": 150,
      "query": "Windows",
      "language": "en"
    },
    "articles": [
      {
        "id": "kb_knowledge:sys_id",
        "number": "KB0000020",
        "title": "Article Title",
        "snippet": "Article preview text...",
        "score": 14.869,
        "rank": 1,
        "link": "?sys_kb_id=...",
        "fields": {
          "short_description": { ... },
          "sys_class_name": { ... }
        }
      }
    ]
  }
}
```

### Get Article Details
```
GET /api/servicenow/knowledge/[id]
```

**Path Parameters:**
- `id` (string): Article sys_id or KB number

**Query Parameters:**
- `fields` (string, optional): Comma-separated fields
- `language` (string, optional): Translation language
- `update_view` (boolean, optional): Increment view count

**Response:**
```json
{
  "success": true,
  "result": {
    "sys_id": "9e528db1474321009db4b5b08b9a71a6",
    "number": "KB0000020",
    "short_description": "Article Title",
    "content": "<p>Full HTML content...</p>",
    "display_attachments": true,
    "attachments": [],
    "embedded_content": [],
    "fields": { ... }
  }
}
```

## ServiceNow API Documentation
- [Knowledge Management REST API](https://www.servicenow.com/docs/bundle/xanadu-api-reference/page/integrate/inbound-rest/concept/knowledge-api.html)

## Usage

### Prerequisites
Configure ServiceNow credentials in `.env.local`:
```env
SERVICENOW_INSTANCE=your-instance-name
SERVICENOW_USERNAME=your-username
SERVICENOW_PASSWORD=your-password
```

### Accessing the Feature
1. Navigate to http://localhost:3000/servicenow/knowledge
2. Or use the navigation: ServiceNow → Knowledge Base

### Search Flow
1. Enter search query (optional - leave empty to browse all)
2. Select results per page (10-100)
3. Click "Search"
4. Browse paginated results
5. Click any article card to view full details
6. Use Previous/Next for pagination

### Article Detail View
- Click any article in the results grid
- Modal displays full content with HTML formatting
- View metadata (author, dates, workflow state)
- See attachments if available
- Click X or outside modal to close

## Technical Details

### Authentication
- Uses NextAuth session-based authentication
- Requires valid session for API access
- ServiceNow credentials from environment variables or request parameters

### Next.js 15 Compatibility
- Async params pattern implemented in dynamic routes
- `const { id } = await params` in `[id]/route.js`

### Error Handling
- 401: Authentication failed
- 404: Article not found
- 500: Server errors
- User-friendly error messages displayed

### Security
- Server-side API calls only (credentials never exposed to client)
- Basic Auth with base64 encoding
- Session validation on every request

### Performance
- Pagination support for large result sets
- Configurable result limits (10-100)
- Lazy loading of article details (only on click)
- Minimal DOM manipulation

## Future Enhancements

### Potential Features
1. **Advanced Search**:
   - Knowledge base filter dropdown
   - Workflow state filter
   - Date range filters
   - Author filter

2. **Article Operations**:
   - View count tracking
   - Article rating
   - Bookmark/favorite articles
   - Share article links

3. **Bulk Operations**:
   - Export search results
   - PDF generation
   - Print view

4. **Featured/Most Viewed**:
   - Add tabs for Featured and Most Viewed articles
   - Use additional API endpoints:
     - GET /knowledge/articles/featured
     - GET /knowledge/articles/most_viewed

5. **Attachment Download**:
   - Download attachments directly
   - Preview images inline

6. **Translations**:
   - Language selector
   - Multi-language search

7. **Search History**:
   - Save recent searches
   - Quick access to previous queries

## Files Created/Modified

### Created
1. `src/app/api/servicenow/knowledge/route.js` (127 lines)
2. `src/app/api/servicenow/knowledge/[id]/route.js` (114 lines)
3. `src/app/servicenow/knowledge/page.jsx` (444 lines)
4. `docs/servicenow-knowledge-implementation.md` (this file)

### Modified
1. `src/app/graph-explorer/nav-areas.ts` (added Knowledge Base link)

## Testing Checklist

- [x] Search with query returns relevant results
- [x] Search without query browses all articles
- [x] Pagination works (Previous/Next buttons)
- [x] Results per page selector changes limit
- [x] Click article card opens detail modal
- [x] Article detail displays full content
- [x] Article metadata renders correctly
- [x] Attachments list displays (if present)
- [x] Close modal button works
- [x] Environment variables auto-detected
- [x] Error messages display for failed requests
- [x] Navigation link appears in ServiceNow section
- [x] Responsive design on mobile/tablet/desktop
- [x] Loading states visible during API calls
- [x] Authentication required (redirects if not logged in)

## Notes

### HTML Content Rendering
Articles use `dangerouslySetInnerHTML` to render ServiceNow's HTML content. This is necessary but should only be used with trusted ServiceNow content.

### API Rate Limiting
ServiceNow Knowledge Management API has default rate limits:
- 500 requests per hour for unauthenticated/external users
- Higher limits for authenticated users

### Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES6+ JavaScript features
- CSS Grid and Flexbox layouts

## Related Documentation
- [ServiceNow Incidents Implementation](./power-platform-implementation-summary.md)
- [API Documentation](./API-DOCUMENTATION.md)
- [Deployment Checklist](./DEPLOYMENT-CHECKLIST.md)
