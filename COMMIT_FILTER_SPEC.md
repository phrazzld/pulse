# Technical Specification: Commit Analysis Filtering and Grouping

## Overview

This specification outlines the implementation of enhanced filtering and grouping capabilities for commit analysis in the Pulse application. The goal is to enable users to filter commit activity by contributor and organization/account, as well as to group results in meaningful ways for better analysis.

## User Stories

1. As a user, I want to filter commit analysis to show only my own commits across all repositories and organizations
2. As a user, I want to filter commit analysis to include only specific organizations/accounts
3. As a user, I want to group commit results by contributor to see who did what
4. As a user, I want to group commit results by organization to understand activity distribution
5. As a user, I want to combine filters (e.g., my commits across selected organizations)

## Technical Requirements

### Data Model Extensions

1. **Contributor Model**
   - GitHub username
   - Display name (from commit)
   - Email (from commit)
   - Avatar URL (if available)

2. **Organization/Account Model**
   - Already exists via GitHub App installations
   - Need to track selected state for filtering

3. **Filter State Model**
   - Selected contributors (array of usernames)
   - Selected organizations (array of org IDs/names)
   - Group by option (contributor, organization, repository, chronological)

### API Changes

1. **Enhanced `/api/summary` Endpoint**
   - Add query parameters:
     - `contributors` (array): List of contributor usernames to include
     - `organizations` (array): List of organization IDs/names to include
     - `groupBy` (string): How to group results (contributor, organization, repository, chronological)
   - Response structure:
     - Maintain backward compatibility
     - Add grouping metadata based on groupBy parameter
     - Include filter information in response

2. **New `/api/contributors` Endpoint**
   - Purpose: Fetch list of all contributors across repositories
   - Parameters:
     - `organizations` (optional): Limit to specific organizations
   - Response:
     - Array of contributor objects with username, name, email, and avatar

### UI Implementation

1. **Filter Panel Component**
   - Collapsible panel above the "Generate Summary" button
   - Sections for each filter type
   - Apply/Reset buttons
   - Visual indicator for active filters

2. **Contributor Selection Component**
   - Multi-select dropdown with search
   - Option to select "Only Me" (authenticated user)
   - Option to select "All Contributors"
   - Checkbox for "Include anonymous commits" (no author)

3. **Organization Selection Component**
   - Multi-select dropdown based on available installations
   - Option to select "All Organizations"
   - Visual indicators for organization types (personal, org)

4. **Grouping Options Component**
   - Radio button or dropdown selection
   - Options:
     - Group by Contributor
     - Group by Organization
     - Group by Repository
     - Chronological (no grouping)

5. **Result Display Adaptations**
   - Different visualization based on grouping:
     - Contributor: Cards for each contributor with their activity
     - Organization: Cards for each organization with activity breakdown
     - Repository: Cards for each repository with activity details
     - Chronological: Timeline-based view (current)
   - Summary statistics relevant to the grouping
   - Visual indicators for applied filters

## Implementation Phases

### Phase 1: Core Filter Infrastructure

1. Create filter state management in dashboard
2. Update API endpoints to accept filter parameters
3. Implement backend filtering logic
4. Build basic UI for filter panel

### Phase 2: UI Components

1. Implement contributor selection component
2. Implement organization selection component
3. Implement grouping options component
4. Connect components to filter state

### Phase 3: Results Visualization

1. Implement different result views based on grouping
2. Update AI summary generation to respect filters
3. Add visual indicators for active filters
4. Optimize performance for large datasets

### Phase 4: Enhancement and Refinement

1. Add ability to save filter presets
2. Implement drag-and-drop for reorganizing results
3. Add export capabilities for filtered results
4. Enhance mobile responsiveness

## Technical Considerations

### State Management

- Use React's useState/useReducer for filter state
- Consider localStorage for persisting filter preferences
- Implement debouncing for filter changes to avoid excessive API calls

### Data Fetching Strategy

- Lazy load contributor data as repositories are accessed
- Cache contributor and repository data when possible
- Use pagination for large result sets

### Performance Optimization

- Implement virtualized lists for large datasets
- Use memoization for expensive computations
- Consider worker threads for filtering large datasets

### Error Handling

- Graceful degradation when filters return no results
- Clear error messages for invalid filter combinations
- Fallback options when specific groupings aren't available

## UI Design Guidelines

- Maintain the existing Cybernetic Command Interface aesthetic
- Use consistent color coding:
  - Neon green for controls and actions
  - Electric blue for filters and informational elements
  - Crimson for warnings and removals
- Ensure all filter components have keyboard accessibility
- Provide visual feedback for filter operations
- Use tooltips to explain filter options
- Include filter summary in results view

## API Endpoint Specifications

### GET /api/contributors

**Purpose**: Retrieve list of contributors across repositories

**Parameters**:
- `installation_id` (optional): Filter by specific installation
- `organizations` (optional): Array of organization names
- `repositories` (optional): Array of repository names

**Response**:
```json
{
  "contributors": [
    {
      "username": "username1",
      "displayName": "Display Name",
      "email": "email@example.com",
      "avatarUrl": "https://github.com/avatars/123"
    }
  ]
}
```

### GET /api/summary

**Updated Parameters**:
- `since` (date): Start date (existing)
- `until` (date): End date (existing)
- `installation_id` (optional): Current installation ID (existing)
- `contributors` (optional): Array of contributor usernames
- `organizations` (optional): Array of organization names
- `groupBy` (optional): How to group results (contributor, organization, repository, chronological)

**Response Extensions**:
```json
{
  // Existing fields...
  "filterInfo": {
    "contributors": ["username1", "username2"],
    "organizations": ["org1", "org2"],
    "groupBy": "contributor"
  },
  "groupedResults": [
    {
      "groupKey": "username1",
      "groupName": "Display Name",
      "groupAvatar": "https://github.com/avatars/123",
      "commitCount": 42,
      "repositories": ["repo1", "repo2"],
      "aiSummary": {
        // AI-generated summary for this group
      }
    }
  ]
}
```

## Next Steps

Upon approval of this specification, implementation will proceed in the defined phases, with regular checkpoints to ensure the solution meets user needs and performance requirements.