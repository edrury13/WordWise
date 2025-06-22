# WordWise Version Control Guide

## Overview

WordWise now includes a comprehensive version control system for documents, allowing users to:
- Create snapshots of documents at any point
- View complete version history
- Compare different versions side-by-side
- Restore previous versions
- Tag important versions with descriptive names

## Database Setup

To enable version control, run the following SQL script in your Supabase SQL editor:

```sql
-- Run the version control schema
-- Located at: database/document_versions.sql
```

**Important:** If you already have version control set up and are getting an error about the `is_automatic` column not found, run this migration:

```sql
-- Run the migration to add auto-save support
-- Located at: database/add_is_automatic_column.sql
```

This will create:
- `document_versions` table - Stores all document versions
- `version_comparisons` table - Caches comparison data for performance
- `document_version_tags` table - Stores named tags for versions
- Necessary indexes and RLS policies
- Triggers for automatic initial version creation

## Features

### 1. Automatic Version Creation
- When a document is created, an initial version is automatically saved
- This ensures every document has at least one version in its history

### 2. Auto-Save Versions
- Documents are automatically versioned every 5 minutes while editing
- Auto-save versions are marked with "Auto-save" label
- Only the 3 most recent auto-save versions are kept
- Older auto-save versions are automatically cleaned up
- User-created versions are never deleted

### 3. Manual Version Creation
- Click the "Create Version" button in the navigation bar
- Add an optional description of changes
- Creates a major version snapshot of the current document state

### 4. Version History Panel
- Click "Version History" to view all versions
- See version number, description, timestamp, and word count changes
- Auto-save versions are visually distinguished from manual versions
- Analytics summary shows:
  - Total versions
  - Major vs minor versions
  - Average time between versions
  - Average words per version

### 5. Version Comparison
- Select any two versions to compare
- View changes in split-screen or unified view
- Toggle between showing/hiding unchanged content
- Color-coded diff:
  - Green: Added content
  - Red: Removed content
  - White: Unchanged content

### 6. Version Restoration
- Restore any previous version with one click
- Creates a new version marking the restoration
- Original document is updated to match the restored version

### 7. Version Tagging
- Tag important versions (e.g., "Final Draft", "Submitted Version")
- Tags are unique per document
- Easily identify milestone versions

## UI Components

### Navigation Bar
- **Create Version** - Creates a new version snapshot
- **Version History** - Opens the version history panel

### Version History Panel
- Timeline view of all versions
- Quick actions for each version:
  - View version content
  - Restore version
  - Tag version
  - Compare with another version

### Version Comparison View
- Split or unified diff view
- Line-by-line comparison
- Statistics showing additions/deletions/modifications

## API Endpoints

### Local Development (Express)
```
GET    /api/documents/:id/versions              # Get version history
GET    /api/documents/:id/versions/:versionId   # Get specific version
POST   /api/documents/:id/versions              # Create new version
POST   /api/documents/:id/versions/:versionId/restore  # Restore version
GET    /api/documents/:id/versions/compare      # Compare versions
GET    /api/documents/:id/version-tags          # Get version tags
POST   /api/documents/:id/versions/:versionId/tag      # Tag a version
DELETE /api/documents/:id/version-tags/:tagId   # Remove tag
```

### Vercel Deployment (Serverless)
```
/api/document-versions?action=list&documentId=XXX
/api/document-versions?action=get&documentId=XXX&versionId=YYY
/api/document-versions?action=create&documentId=XXX
/api/document-versions?action=restore&documentId=XXX&versionId=YYY
/api/document-versions?action=compare&from=XXX&to=YYY
/api/document-versions?action=tags&documentId=XXX
/api/document-versions?action=tag&documentId=XXX&versionId=YYY
/api/document-versions?action=untag&documentId=XXX&tagId=ZZZ
```

## Redux State Management

The version control state is managed in the editor slice:

```typescript
versionControl: {
  showVersionHistory: boolean
  showVersionComparison: boolean
  versionComparisonIds: {
    from: string | null
    to: string | null
  }
  viewingVersionId: string | null
  isCreatingVersion: boolean
  lastVersionCreated: number | null
  autoVersionEnabled: boolean
  autoVersionInterval: number // minutes
  lastAutoVersion: number | null
  versionError: string | null
}
```

## Performance Considerations

1. **Diff Caching**: Version comparisons are cached in the database to avoid recalculating
2. **Lazy Loading**: Version content is loaded on demand
3. **Optimized Queries**: Indexes ensure fast version retrieval
4. **RLS Policies**: Row-level security ensures users only see their own versions

## Future Enhancements

1. **Branching**: Create parallel versions for experimentation
2. **Merging**: Combine changes from different versions
3. **Export/Import**: Export version history with documents
4. **Collaboration**: Share specific versions with others
5. **Delta Storage**: Store only changes between versions to save space
6. **Version Diffing**: More sophisticated diff algorithms for better change detection

## Best Practices

1. Create versions before major edits
2. Use descriptive commit messages
3. Tag important milestones
4. Regularly review and clean up old versions
5. Use version comparison before restoring

## Troubleshooting

### Versions not appearing
- Ensure the database schema is properly applied
- Check browser console for errors
- Verify RLS policies are correct

### Comparison not working
- Clear the version comparison cache
- Check that both versions exist
- Ensure proper permissions

### Performance issues
- Consider implementing pagination for long histories
- Clean up old comparison cache entries
- Monitor database query performance 