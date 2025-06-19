# WordWise Grammar Engine

A comprehensive, centralized grammar checking system with standardized categories, advanced quality scoring, and extensive rule coverage.

## 🚀 Features

### Standardized Suggestion Categories
- **Core Grammar**: Subject-verb agreement, verb tense, pronoun agreement, etc.
- **Punctuation & Mechanics**: Comma usage, apostrophes, capitalization, etc.
- **Word Choice & Usage**: Commonly confused words, homophones, redundancy, etc.
- **Style & Clarity**: Sentence variety, tone consistency, audience appropriateness
- **Advanced Grammar**: Subjunctive mood, gerund-infinitive, complex structures

### Enhanced Quality Scoring
- **Multi-factor Assessment**: Accuracy (30%), Relevance (25%), Impact (25%), Confidence (20%)
- **Impact Analysis**: Tracks effects on correctness, clarity, readability, engagement, formality
- **Quality Thresholds**: High (80%+), Medium (60-79%), Low (<60%)
- **Configurable Filtering**: Set minimum quality thresholds

### Comprehensive Rule Coverage
- **60+ Grammar Rules** across all major categories
- **Advanced Pattern Matching** with context awareness
- **Intelligent Replacements** with multiple suggestions
- **Educational Examples** for each rule

## 📊 Quality Scoring System

### Quality Factors

Each suggestion is scored across multiple dimensions:

```typescript
interface QualityScore {
  overall: number           // 0-100 overall quality score
  accuracy: number         // How accurate the suggestion is
  relevance: number        // How relevant to the context
  impact: number           // How much it improves the text
  confidence: number       // How confident we are in the suggestion
  userFeedback?: number    // User feedback score if available
}
```

### Impact Assessment

```typescript
interface SuggestionImpact {
  readability: 'improves' | 'neutral' | 'degrades'
  clarity: 'improves' | 'neutral' | 'degrades'
  formality: 'increases' | 'neutral' | 'decreases'
  engagement: 'improves' | 'neutral' | 'degrades'
  correctness: 'fixes' | 'improves' | 'neutral'
}
```

## 🎯 Standardized Categories

### Core Grammar Categories
- `subject-verb-agreement` - Ensures proper subject-verb matching
- `verb-tense-consistency` - Maintains consistent verb tenses
- `pronoun-agreement` - Correct pronoun-antecedent agreement
- `article-usage` - Proper use of a, an, the
- `preposition-usage` - Correct preposition selection
- `adjective-adverb-confusion` - Distinguishes adjectives from adverbs
- `incomplete-sentence` - Identifies sentence fragments
- `run-on-sentence` - Detects overly long sentences
- `sentence-fragment` - Finds incomplete thoughts
- `comma-splice` - Identifies improper comma usage
- `dangling-modifier` - Catches misplaced modifiers
- `misplaced-modifier` - Identifies unclear modifications
- `parallel-structure` - Ensures consistent parallel construction
- `conditional-sentences` - Proper if-then structures
- `passive-voice-overuse` - Suggests active voice alternatives

### Punctuation & Mechanics
- `comma-usage` - Comprehensive comma rules
- `apostrophe-usage` - Possessives and contractions
- `quotation-marks` - Proper quote placement
- `semicolon-usage` - Correct semicolon application
- `capitalization` - Proper capitalization rules
- `hyphenation` - Compound word formation

### Word Choice & Usage
- `commonly-confused-words` - There/their/they're, your/you're, etc.
- `homophones` - Words that sound alike
- `word-choice` - Better word alternatives
- `redundancy` - Eliminates unnecessary repetition
- `wordiness` - Suggests concise alternatives
- `colloquialisms` - Identifies informal language
- `jargon-usage` - Technical term appropriateness
- `archaic-language` - Outdated word usage

### Style & Clarity
- `sentence-variety` - Encourages varied sentence structure
- `transition-words` - Improves flow between ideas
- `paragraph-structure` - Logical paragraph organization
- `tone-consistency` - Maintains consistent tone
- `formality-level` - Appropriate formality for context
- `audience-appropriateness` - Content suitable for intended audience

### Advanced Grammar
- `subjunctive-mood` - Hypothetical and conditional statements
- `gerund-infinitive` - Proper verb form selection
- `reported-speech` - Indirect speech patterns
- `complex-sentence-structure` - Advanced syntactic patterns

## 🎨 Suggestion Types

- **Grammar** - Core grammatical errors that affect correctness
- **Spelling** - Misspellings and typos
- **Style** - Style and readability improvements
- **Clarity** - Clarity and comprehension issues
- **Engagement** - Engagement and tone improvements
- **Delivery** - Presentation and formatting
- **Consistency** - Consistency issues across the text
- **Conciseness** - Wordiness and redundancy

## 🔧 Severity Levels

- **Critical** - Must fix (affects meaning or correctness)
- **High** - Should fix (important errors)
- **Medium** - Consider fixing (minor errors)
- **Low** - Optional fix (style preferences)
- **Suggestion** - Enhancement opportunities

## 🚀 Usage

### Basic Usage

```typescript
import { GrammarRuleEngine } from './grammar/engine'

const engine = new GrammarRuleEngine({
  enabledCategories: ['subject-verb-agreement', 'commonly-confused-words'],
  minConfidence: 70,
  qualityThreshold: 60,
  documentType: 'formal',
  userLevel: 'intermediate'
})

const result = await engine.checkText("I has many errors in this sentence.")
console.log(result.suggestions)
```

### Advanced Configuration

```typescript
const engine = new GrammarRuleEngine({
  enabledCategories: [
    'subject-verb-agreement',
    'commonly-confused-words',
    'redundancy',
    'comma-usage'
  ],
  minConfidence: 80,
  maxSuggestions: 25,
  qualityThreshold: 70,
  prioritizeByImpact: true,
  enableAdvancedRules: true,
  documentType: 'academic',
  userLevel: 'advanced'
})
```

### Quality Filtering

```typescript
// Only show high-quality suggestions
const result = await engine.checkText(text, {
  qualityThreshold: 80,
  prioritizeByImpact: true
})

// Filter by impact type
const criticalSuggestions = result.suggestions.filter(
  s => s.impact.correctness === 'fixes'
)
```

## 📈 Performance Features

- **Intelligent Caching** - Caches results for repeated text
- **Performance Monitoring** - Tracks execution times and statistics
- **Rule Prioritization** - Processes most important rules first
- **Context Awareness** - Considers surrounding text for better accuracy

## 🧪 Testing

The system includes a comprehensive test panel with:

- **Live Testing** - Test grammar rules in real-time
- **Category Overview** - Visual representation of all categories
- **Quality Analysis** - Detailed quality scoring breakdown
- **Performance Metrics** - Execution time and cache statistics

## 📚 Rule Examples

### Subject-Verb Agreement
```typescript
// ❌ Incorrect
"I was going to the store."
"They was happy yesterday."

// ✅ Correct
"I were going to the store." (subjunctive)
"They were happy yesterday."
```

### Commonly Confused Words
```typescript
// ❌ Incorrect
"There going to they're house over their."

// ✅ Correct
"They're going to their house over there."
```

### Redundancy
```typescript
// ❌ Redundant
"advance planning", "past history", "free gift"

// ✅ Concise
"planning", "history", "gift"
```

## 🔍 Rule Gap Coverage

We've addressed major rule gaps including:

1. **Homophones & Confused Words** - Comprehensive coverage of commonly mixed-up words
2. **Advanced Grammar Structures** - Complex sentence patterns and advanced concepts
3. **Context-Aware Rules** - Rules that consider surrounding text
4. **Style & Clarity** - Beyond basic grammar to improve overall writing quality
5. **Document Type Awareness** - Rules adapt to formal, casual, technical contexts
6. **User Level Adaptation** - Appropriate complexity for beginner to expert users

## 🎯 Quality Improvements

### Pattern Accuracy
- More specific regex patterns reduce false positives
- Negative lookbehind/lookahead for better precision
- Context-sensitive matching

### Replacement Quality
- Multiple replacement options when appropriate
- Intelligent suggestions based on context
- Educational explanations for each correction

### Confidence Scoring
- Multi-factor confidence calculation
- Historical accuracy tracking
- User feedback integration

## 🌟 Future Enhancements

- Machine learning integration for pattern improvement
- User feedback loop for quality refinement
- Multi-language support expansion
- Advanced semantic analysis
- Integration with writing style guides

## 📝 Contributing

When adding new rules:

1. Follow the standardized category system
2. Include quality factors and examples
3. Add comprehensive test cases
4. Document the rule's purpose and scope
5. Consider edge cases and false positives

## 🔗 Integration

The grammar engine integrates seamlessly with:
- WordWise text editor
- API endpoints for server-side checking
- Real-time suggestion display
- Performance monitoring systems
- User preference management 