# AI-Powered Grammar Checking Implementation Guide

## Overview

This guide explains how to integrate and use AI-powered grammar checking in WordWise to significantly improve the quality of writing suggestions.

## Features

### 1. **AI-Enhanced Grammar Checking**
- Uses OpenAI's GPT-4 for context-aware grammar analysis
- Provides more nuanced suggestions than rule-based systems
- Understands context, tone, and writing style
- Offers confidence scores for each suggestion

### 2. **Hybrid Approach**
- Combines traditional rule-based checking with AI
- Falls back to rule-based when AI is unavailable
- Merges suggestions from multiple sources intelligently

### 3. **Advanced Suggestion Types**
- **Grammar**: Traditional grammar errors
- **Spelling**: Spelling mistakes and typos
- **Style**: Writing style improvements
- **Clarity**: Making text clearer and easier to understand
- **Conciseness**: Removing wordiness
- **Tone**: Maintaining consistent tone throughout

## Setup Instructions

### 1. **Environment Variables**

Add to your `.env` files:

```bash
# In /api/.env or Vercel environment
OPENAI_API_KEY=your-openai-api-key-here
```

### 2. **Install Dependencies**

```bash
# In the /api directory
npm install openai@^4.28.0
```

### 3. **Deploy the New API Endpoint**

The new AI grammar checking endpoint is located at:
- `/api/language/ai-grammar-check.js`

This will be automatically deployed with your Vercel deployment.

## Usage in the Application

### 1. **Automatic AI Checking**

The editor now automatically uses AI checking when enabled:

```typescript
// AI checking is enabled by default
// The editor will automatically use checkTextWithAI instead of checkText
```

### 2. **Toggle AI Features**

Users can toggle AI checking on/off:
- Through the AI Assistant panel in the sidebar
- Via keyboard shortcut (Ctrl+Shift+A)
- Programmatically: `dispatch(toggleAICheck())`

### 3. **AI Suggestion Display**

AI suggestions are displayed with:
- 🤖 Robot icon to indicate AI source
- Confidence percentage
- Severity indicators (🔴 High, 🟡 Medium, 🔵 Low)
- Detailed explanations

## API Usage

### Direct API Call

```javascript
const response = await fetch('/api/language/ai-grammar-check', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    text: "Your text to check",
    documentType: 'general', // or 'academic', 'business', 'creative', 'technical', 'email'
    checkType: 'comprehensive', // or 'grammar-only', 'style-only'
    context: "Optional context about the document"
  })
})
```

### Using the Service

```typescript
import { checkGrammarWithAI } from './services/aiGrammarService'

const result = await checkGrammarWithAI({
  text: "Your text here",
  documentType: 'academic',
  checkType: 'comprehensive'
})
```

## Advanced Features

### 1. **Document Type Awareness**

The AI adjusts its checking based on document type:
- **General**: Standard grammar and style
- **Academic**: Formal tone, citation awareness
- **Business**: Professional language, clarity focus
- **Creative**: More flexible with style
- **Technical**: Technical term awareness
- **Email**: Conciseness and clarity

### 2. **Check Types**

- **Comprehensive**: All types of issues
- **Grammar-only**: Focus on grammar and spelling
- **Style-only**: Focus on style and clarity

### 3. **Caching**

- Results are cached for 5 minutes to reduce API calls
- Cache is cleared when toggling AI on/off
- Manual cache clear: `clearAICache()`

## Performance Optimization

### 1. **Rate Limiting**
- Minimum 2 seconds between AI calls
- Automatic queueing of rapid requests
- Graceful fallback to traditional checking

### 2. **Text Length Limits**
- Maximum 10,000 characters per AI check
- Automatic text splitting for longer documents (planned)

### 3. **Debouncing**
- 300ms debounce for typing
- Immediate checking after applying suggestions

## Cost Management

### 1. **API Usage**
- Each check uses approximately 500-2000 tokens
- GPT-4 pricing applies
- Consider implementing usage quotas per user

### 2. **Optimization Tips**
- Enable AI only for premium users
- Increase debounce time for cost reduction
- Use 'grammar-only' mode for basic checks

## Future Enhancements

### 1. **Planned Features**
- [ ] Support for more AI models (Claude, PaLM)
- [ ] Multilingual support
- [ ] Custom writing style profiles
- [ ] Plagiarism detection
- [ ] Fact-checking integration
- [ ] Voice and readability analysis

### 2. **Integration Ideas**
- Connect with Grammarly API for comparison
- Add citation formatting assistance
- Implement technical writing templates
- Create industry-specific checking profiles

## Troubleshooting

### Common Issues

1. **"AI service configuration error"**
   - Check OPENAI_API_KEY is set correctly
   - Verify API key has proper permissions

2. **"Rate limit exceeded"**
   - Too many requests to OpenAI
   - Implement user-based rate limiting
   - Consider upgrading OpenAI plan

3. **Slow responses**
   - Normal for AI checking (2-5 seconds)
   - Consider showing progress indicator
   - Use caching effectively

## Security Considerations

1. **API Key Security**
   - Never expose API keys in frontend
   - Use environment variables
   - Implement request validation

2. **Data Privacy**
   - Text is sent to OpenAI for processing
   - Consider data retention policies
   - Implement user consent for AI features

3. **Rate Limiting**
   - Implement per-user rate limits
   - Monitor for abuse
   - Use Redis for distributed rate limiting

## Monitoring and Analytics

### Metrics to Track

1. **Usage Metrics**
   - AI checks per user
   - Average response time
   - Cache hit rate
   - Error rate

2. **Quality Metrics**
   - Suggestion acceptance rate
   - User satisfaction scores
   - False positive rate
   - Confidence score accuracy

3. **Cost Metrics**
   - Tokens used per check
   - Cost per user
   - ROI on AI features

## Support

For issues or questions:
1. Check the error logs in Vercel
2. Review OpenAI API status
3. Contact support with request IDs

## License

This implementation uses OpenAI's API. Ensure compliance with:
- OpenAI's usage policies
- Data processing agreements
- User privacy requirements 