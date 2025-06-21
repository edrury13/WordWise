# Smart Correction Learning from Ignored Errors

## Overview

The WordWise smart auto-correction system now includes advanced learning capabilities that track and learn from errors that users choose to ignore. This creates a more personalized writing experience by reducing suggestions for patterns that users consistently ignore.

## How It Works

### 1. Tracking Ignored Patterns

When a user ignores a suggestion, the system:
- Records the exact text and error type
- Captures the surrounding context (50 characters before and after)
- Tracks how many times this pattern has been ignored
- Associates ignored patterns with the specific user

### 2. Confidence Score Adjustment

The system adjusts confidence scores based on ignore history:

```
Base Confidence: 70
- Previously ignored once: -20 points
- Ignored 3+ times: -35 points  
- Ignored 5+ times: -50 points
- Ignored in similar context: additional -15 points
```

Suggestions with confidence below 20 are automatically filtered out.

### 3. Pattern Recognition

The system uses multiple approaches to identify similar patterns:

#### Exact Pattern Matching
- Tracks exact text + error type combinations
- Example: "its" flagged as a grammar error

#### Context-Based Matching
- Compares surrounding text to identify similar contexts
- Uses 50% word overlap threshold for context similarity
- Helps identify domain-specific or stylistic choices

#### Similar Correction Detection
- Uses Levenshtein distance (≤2) for fuzzy matching
- Identifies root word similarities (first 4 characters)
- Groups related errors together

## Implementation Details

### Data Storage

Ignored patterns are stored in the `user_correction_patterns` table with:
- `accepted: false` for ignored suggestions
- Context information for pattern matching
- Timestamps for tracking pattern evolution

### Memory Management

The service maintains in-memory caches for performance:
- `ignoredPatterns`: Set of ignored pattern keys per user
- `ignoredContexts`: Array of context patterns with counts
- Syncs with database every 30 seconds or on-demand

### Smart Filtering

Suggestions go through multiple filtering stages:

1. **Pre-filtering**: Very low confidence suggestions (<20) are skipped
2. **Context Analysis**: Similar contexts reduce confidence
3. **Frequency Check**: Frequently ignored patterns are deprioritized
4. **Final Sorting**: Suggestions sorted by confidence (highest first)

## User Benefits

### 1. Reduced Noise
- Fewer repetitive suggestions for intentional choices
- Less interruption during writing flow
- Focus on genuinely helpful corrections

### 2. Personalized Experience
- System adapts to individual writing style
- Respects domain-specific terminology
- Learns from consistent preferences

### 3. Contextual Intelligence
- Understands when certain "errors" are acceptable
- Adapts to different document types
- Preserves stylistic choices

## Feedback Messages

The system provides clear feedback about why suggestions appear:

- **"Previously ignored N times"**: For patterns ignored 1-2 times
- **"You've ignored this suggestion N times - showing with low priority"**: For frequently ignored patterns (3+ times)
- **"Low priority suggestion"**: For suggestions with confidence 20-40

## API Methods

### Core Methods

```typescript
// Record when a user ignores a suggestion
recordUserChoice(suggestion, accepted: false, originalText, correctedText, documentContent)

// Check if a suggestion should be suppressed
shouldSuppressSuggestion(suggestion, documentContent): { suppress: boolean; reason?: string }

// Get statistics about ignored patterns
getIgnoreStats(userId): {
  totalIgnored: number
  mostIgnoredTypes: Array<{ type: string; count: number }>
  frequentlyIgnoredWords: Array<{ word: string; count: number }>
}

// Get writing insights including ignored patterns
getWritingInsights(userId): {
  commonMistakes: Array<{ text: string; count: number }>
  acceptanceRate: number
  improvementAreas: string[]
  ignoredPatterns: Array<{ text: string; type: string; count: number }>
}
```

## Configuration

### Thresholds

- **Suppression Threshold**: 5+ ignores = automatic suppression
- **Low Priority Threshold**: 3+ ignores = low priority display
- **Context Similarity**: 50% word overlap = similar context
- **Confidence Floor**: 20 = minimum confidence to show

### Customization

These thresholds can be adjusted based on:
- User feedback
- Document type (formal vs informal)
- Writing context (email vs academic)
- User preferences

## Best Practices

### For Users

1. **Be Consistent**: Ignore patterns you always want to keep
2. **Use Style Profiles**: Create profiles for different writing contexts
3. **Review Insights**: Check your ignored patterns periodically

### For Developers

1. **Monitor Performance**: Track cache hit rates
2. **Analyze Patterns**: Look for commonly ignored suggestions
3. **Adjust Thresholds**: Fine-tune based on user behavior
4. **Clean Old Data**: Remove patterns older than 6 months

## Future Enhancements

1. **Machine Learning Integration**: Use ML to predict ignore likelihood
2. **Cross-Document Learning**: Learn patterns across document types
3. **Team Sharing**: Share ignore patterns within teams
4. **Smart Suggestions**: Suggest adding patterns to style profiles
5. **Ignore Categories**: Group similar ignored patterns together 