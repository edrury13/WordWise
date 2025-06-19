# Centralized Grammar Rule Management System

This directory contains the centralized grammar rule management system for WordWise. This system consolidates all grammar checking logic into a single, maintainable, and extensible architecture.

## Architecture Overview

The system consists of three main components:

### 1. Types (`types.ts`)
- Defines interfaces for grammar rules, suggestions, and configuration
- Provides type safety across the entire grammar checking system
- Supports rule conditions, contexts, and metadata

### 2. Rules (`rules.ts`)
- Contains all grammar rules in a centralized location
- Each rule includes:
  - Unique ID and descriptive name
  - Regular expression pattern for matching
  - Message and explanation for users
  - Category and severity classification
  - Priority for conflict resolution
  - Replacement function for generating corrections
  - Enable/disable flag for rule management

### 3. Engine (`engine.ts`)
- Main `GrammarRuleEngine` class that processes text
- Handles rule execution, suggestion generation, and filtering
- Provides configuration options for different use cases
- Includes performance optimization and caching
- Supports rule prioritization and conflict resolution

## Key Features

### ✅ **Centralized Management**
- All grammar rules are defined in one location
- Consistent rule format and behavior
- Easy to add, modify, or disable rules

### ✅ **Rule Prioritization**
- Rules have priority scores (0-100)
- Higher priority rules take precedence
- Configurable conflict resolution

### ✅ **Confidence Scoring**
- Each suggestion includes a confidence score
- Based on rule priority, match length, and context
- Allows filtering of low-confidence suggestions

### ✅ **Category System**
- Rules organized by grammar categories:
  - `subject-verb-agreement`
  - `incomplete-sentence`
  - `verb-form`
  - `adjective-adverb`
  - `contractions`
  - `article-usage`
  - `pronoun-agreement`

### ✅ **Flexible Configuration**
- Enable/disable specific categories
- Set minimum confidence thresholds
- Limit maximum suggestions
- Language and document type support

### ✅ **Performance Optimized**
- Efficient rule processing
- Early termination for non-global patterns
- Execution time tracking
- Memory-efficient suggestion generation

## Usage Examples

### Basic Usage
```typescript
import { grammarEngine } from './grammar'

const result = await grammarEngine.checkText("He don't like pizza")
console.log(result.suggestions) // Grammar suggestions
console.log(result.stats) // Performance statistics
```

### Custom Configuration
```typescript
import { createGrammarEngine } from './grammar'

const customEngine = createGrammarEngine({
  enabledCategories: ['subject-verb-agreement', 'verb-form'],
  minConfidence: 80,
  maxSuggestions: 10,
  language: 'en-US'
})

const result = await customEngine.checkText(text)
```

### Rule Management
```typescript
// Disable a specific rule
grammarEngine.setRuleEnabled('adjective-adverb-confusion', false)

// Get rules by category
const verbRules = grammarEngine.getRulesByCategory('verb-form')

// Update engine configuration
grammarEngine.updateConfig({
  minConfidence: 85,
  maxSuggestions: 20
})
```

## Integration Points

### Frontend Integration
- Replaces scattered client-side grammar checking functions
- Integrates with existing `languageService.ts`
- Maintains compatibility with existing suggestion format
- Provides fallback when LanguageTool API fails

### Backend Integration (Planned)
- Can be integrated into backend routes for server-side checking
- Supports the same API as frontend for consistency
- Enables hybrid checking strategies

## Rule Development

### Adding New Rules
```typescript
{
  id: 'my-new-rule',
  name: 'My Grammar Rule',
  description: 'Detects and corrects specific grammar pattern',
  pattern: /regex-pattern/gi,
  message: 'User-friendly error message',
  category: 'appropriate-category',
  severity: 'high',
  type: 'grammar',
  version: '1.0.0',
  priority: 85,
  enabled: true,
  replacement: (match: string) => {
    // Generate corrected text
    return correctedVersion
  }
}
```

### Rule Guidelines
1. **Unique IDs**: Use descriptive, kebab-case IDs
2. **Clear Messages**: Write user-friendly explanations
3. **Appropriate Categories**: Use existing categories when possible
4. **Priority Levels**: 
   - 90-100: Critical grammar errors
   - 70-89: Important corrections
   - 50-69: Style improvements
   - <50: Minor suggestions
5. **Test Thoroughly**: Ensure patterns don't create false positives

## Benefits Over Previous System

### Before (Scattered Approach)
- Rules spread across multiple files
- Duplicated logic and patterns
- Inconsistent suggestion format
- Difficult to maintain and extend
- No centralized configuration
- Performance issues with redundant checks

### After (Centralized System)
- ✅ Single source of truth for all rules
- ✅ Consistent, extensible architecture  
- ✅ Unified suggestion format and scoring
- ✅ Easy maintenance and rule management
- ✅ Flexible configuration options
- ✅ Optimized performance with priority handling
- ✅ Version tracking and rule evolution
- ✅ Comprehensive testing capabilities

## Deployment Compatibility

### ✅ Vercel Ready
- Pure TypeScript/JavaScript with no external dependencies
- Works in serverless environments
- Optimized bundle size

### ✅ Local Development
- Hot reload support
- TypeScript compilation
- Easy debugging and testing

This centralized approach significantly improves the maintainability, consistency, and quality of grammar checking throughout the WordWise application. 