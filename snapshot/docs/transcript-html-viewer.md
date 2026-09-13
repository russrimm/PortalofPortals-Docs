# Conversation Transcript HTML Viewer

## Overview
Enhanced the conversation transcript viewer to handle structured message content, particularly when messages contain email data with large HTML body previews.

## Problem
Conversation transcripts sometimes contain messages where the `text` property is actually a JSON object with a `value` array. Each item in this array can contain:
- `subject` - The email subject line
- `bodyPreview` - Large HTML content (often 10KB+)
- `id` - A long identifier string

Displaying these large HTML strings directly in the transcript made the UI cluttered and difficult to read.

## Solution
Implemented intelligent parsing and display of structured message content:

1. **Structured Data Detection**: Parse the `text` field to detect if it contains JSON with a `value` array
2. **Smart Display**: Show subject lines prominently and provide a "View HTML" link for body content
3. **HTML Viewer Modal**: New modal that safely renders HTML content in an isolated iframe
4. **Raw Source Access**: Collapsible section to view/copy the raw HTML source

## Key Features

### Structured Item Display
- **Subject Line**: Displayed prominently as a bold title
- **Body Preview**: Shown as a clickable link with file size (e.g., "View HTML (12KB)")
- **ID Field**: Truncated to first 20 characters to save space
- **Visual Hierarchy**: Uses teal accent border to distinguish structured items

### HTML Viewer Modal
- **Safe Rendering**: HTML displayed in sandboxed iframe to prevent script execution
- **Security Notice**: Warning that external resources may not load
- **Copy Button**: Easy copy-to-clipboard functionality for the HTML content
- **Raw Source**: Expandable `<details>` section showing the HTML source code
- **Higher z-index**: Modal renders at z-[60] to appear above transcript modal (z-50)

### Backward Compatibility
- Plain text messages continue to work as before
- Non-JSON text content displays unchanged
- Graceful fallback if JSON parsing fails

## Implementation Details

### File Modified
- `src/app/power-platform/environments/page.jsx`

### New State
```javascript
const [htmlViewerModal, setHtmlViewerModal] = useState({ 
  open: false, 
  html: '', 
  title: '' 
})
```

### Data Structure
Messages now support two display modes:
```javascript
{
  from: 'user-identifier',
  timestamp: '2025-10-30T...',
  text: 'plain text',           // For simple messages
  structuredItems: [             // For structured content
    {
      subject: 'Email subject',
      bodyPreview: '<html>...</html>',
      id: 'long-identifier-string'
    }
  ]
}
```

### Parsing Logic
The code handles multiple encoding scenarios:
1. **Object Format**: If `activity.text` is already an object with a `value` array, use it directly
2. **JSON String with Prefix**: Strips "Use content from " prefix if present
3. **Unicode Escape Sequences**: Decodes `\u0022` and other Unicode escapes (e.g., `\u0022` → `"`)
4. **JSON Parsing**: Attempts to parse the decoded string and extract `value` array
5. **Plain Text Fallback**: If parsing fails or no `value` array found, display as regular text

This handles edge cases like:
- `{"value":[...]}` - Direct JSON object
- `"Use content from {\"value\":[...]}"` - Prefixed JSON string
- `"Use content from {\u0022value\u0022:[...]}"` - Unicode-escaped JSON (common in bot transcripts)

### Security Considerations
- HTML content rendered in sandboxed iframe with `sandbox="allow-same-origin"`
- Prevents script execution and form submission
- External resources may be blocked by browser security policies

## User Experience

### Before
```
From: user@example.com
{"value":[{"subject":"Meeting Notes","bodyPreview":"<html><head><style>...
[10KB of unformatted HTML]
```

### After
```
From: John Doe
┃ Meeting Notes
┃ Body: View HTML (12KB)
┃ ID: abc123def456...
```

## Usage

1. Navigate to Power Platform Environments page
2. Click "Transcripts" button for any environment
3. Structured messages automatically display with enhanced formatting
4. Click "View HTML" links to open the HTML viewer modal
5. Use "Copy HTML" to copy content to clipboard
6. Expand "View Raw HTML Source" to see formatted source code

## Future Enhancements
- Add syntax highlighting for HTML source view
- Support for downloading HTML as file
- Preview thumbnail generation for HTML content
- Search/filter within HTML content
