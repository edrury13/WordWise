# Smart Auto-Correction Guide

## Overview

Smart Auto-Correction is an intelligent feature that learns from your writing patterns to provide personalized grammar and spelling suggestions. Unlike traditional grammar checkers, it adapts to your writing style over time.

## How It Works

### Learning Process
1. **Pattern Recognition**: Every time you accept or reject a suggestion, the system records your choice
2. **Context Analysis**: The system analyzes the context around corrections to understand when specific corrections apply
3. **Confidence Building**: Frequently accepted corrections gain higher confidence scores
4. **Personalization**: Suggestions become more tailored to your specific writing patterns

### Key Features

#### 🧠 Learned Corrections
- Suggestions based on your previously accepted corrections
- Higher confidence for patterns you consistently correct

#### ⚡ Quick Accept
- High-confidence suggestions (90%+) that you've accepted multiple times
- Common corrections like missing contractions
- One-click acceptance for familiar patterns

#### 📊 Writing Insights
- Track your acceptance rate
- View common mistakes
- Identify areas for improvement

## User Interface

### Smart Correction Indicators

1. **In Suggestion Tooltips**:
   - 🧠 **Learned** badge for patterns based on your history
   - ⚡ **Quick Accept** badge for high-confidence suggestions
   - Confidence percentage displayed
   - Personalized reason for the suggestion

2. **Smart Corrections Panel**:
   - Located at the top of the sidebar
   - Shows real-time statistics
   - Displays writing insights
   - Option to view detailed patterns

### Visual Cues

- **Green highlight** on Quick Accept suggestions
- **Purple badge** for learned patterns
- **Confidence meter** showing suggestion reliability

## Database Schema

The system stores correction patterns in the `user_correction_patterns` table:

```sql
- id: Unique identifier
- user_id: Associated user
- original_text: Text before correction
- corrected_text: Text after correction
- suggestion_type: Type of correction (spelling, grammar, style)
- context_before/after: Surrounding text for context
- document_type: Type of document being edited
- accepted: Whether the suggestion was accepted
- confidence_gained: Points added/removed based on action
- created_at: Timestamp
```

## Privacy & Data

- All correction patterns are stored securely in your account
- Data is never shared with other users
- You can clear your learning data at any time
- Row-level security ensures only you can access your patterns

## Technical Implementation

### Frontend Components

1. **SmartCorrectionService** (`/services/smartCorrectionService.ts`)
   - Manages pattern learning and retrieval
   - Calculates confidence scores
   - Provides writing insights

2. **SmartCorrectionPanel** (`/components/SmartCorrectionPanel.tsx`)
   - Displays learning statistics
   - Shows writing insights
   - Allows data management

### Integration Points

- **handleApplySuggestion**: Records accepted corrections
- **handleIgnoreSuggestion**: Records rejected corrections
- **Suggestion tooltips**: Enhanced with smart correction data
- **Sidebar panel**: Dedicated section for insights

### Performance Considerations

- Client-side caching of patterns (30-second sync interval)
- Limited to 500 most recent patterns
- Efficient pattern matching algorithms
- Debounced API calls

## Getting Started

1. **Enable Smart Corrections**: Active by default for logged-in users
2. **Start Writing**: The system begins learning immediately
3. **Accept/Reject Suggestions**: Each action trains the system
4. **View Insights**: Check the Smart Corrections panel for patterns
5. **Quick Accept**: Use high-confidence suggestions for faster editing

## Tips for Best Results

1. **Be Consistent**: Accept similar corrections consistently
2. **Use Context**: The system learns better with full sentences
3. **Review Insights**: Check your common mistakes periodically
4. **Clear Cache**: If patterns become outdated, clear and retrain

## Troubleshooting

### Patterns Not Appearing
- Ensure you're logged in
- Check that you've accepted similar corrections at least 3 times
- Verify the Smart Corrections panel is expanded

### Incorrect Suggestions
- Reject incorrect suggestions to train the system
- Clear cache if many patterns are outdated
- Ensure you're using consistent writing style

### Performance Issues
- Clear cache if too many patterns accumulate
- Check network connection for sync issues
- Reduce the number of simultaneous documents

## Future Enhancements

- Cross-document learning
- Team writing style sharing (optional)
- Advanced pattern recognition
- Writing goal integration
- Export/import correction patterns 