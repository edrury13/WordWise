# Advanced Style Profiles Guide

## Overview

Advanced Style Profiles in WordWise allow you to create, save, and apply different writing style configurations based on your document type, audience, or personal preferences. Think of them as "writing personalities" that instantly transform how the grammar checker evaluates your text.

## Features

### 1. Pre-built Style Profiles

WordWise comes with six pre-configured profiles optimized for different writing contexts:

- **📚 Academic Writing**: Formal tone, complex sentences, citations, no contractions
- **💼 Business Professional**: Clear, concise, action-oriented, professional tone
- **✍️ Creative Writing**: Flexible grammar, stylistic fragments, rich language
- **🔧 Technical Documentation**: Imperative mood, consistent terminology, step-by-step
- **📧 Email Communication**: Adaptive tone, clear CTAs, appropriate greetings
- **💬 Social Media**: Character limits, hashtags, engagement-focused

### 2. Profile-Aware Grammar Checking

When a profile is active:
- Grammar rules adjust to match the writing style
- AI suggestions consider the profile's requirements
- Certain "errors" may be ignored if appropriate for the style
- New suggestions appear based on profile-specific rules

### 3. Smart Profile Detection

WordWise can automatically detect and suggest the appropriate profile based on your document content.

## Using Style Profiles

### Selecting a Profile

1. In the editor sidebar, find the "✍️ Style Profile" section
2. Click on any profile to activate it
3. The active profile shows with a blue highlight
4. Your selection is remembered per document

### Profile Switching Shortcuts

- **Manual Selection**: Click any profile in the sidebar
- **Auto-detect**: Click the "Auto-detect" button to let AI suggest a profile
- **Quick Switch**: Use Ctrl+Shift+P to cycle through profiles
- **No Profile**: Select "No Profile" for default checking

### Understanding Profile Settings

Each profile adjusts multiple aspects of writing:

#### Tone Settings
- **Formality Level** (1-10 scale)
- **Emotional Tone** (neutral, positive, professional, etc.)
- **Voice Preference** (active, passive, balanced)

#### Grammar Rules
- **Fragment Tolerance**: Allow incomplete sentences
- **Contraction Usage**: Never, informal only, or always
- **Comma Splices**: Accepted or rejected
- **Oxford Comma**: Required or optional

#### Vocabulary Preferences
- **Complexity Level**: Simple, moderate, or sophisticated
- **Technical Terms**: Allowed or discouraged
- **Banned Words**: Profile-specific word blacklist
- **Regional Variants**: US, UK, AU, or CA English

#### Structure Rules
- **Sentence Length**: Min, max, and ideal word counts
- **Paragraph Length**: Optimal paragraph sizes
- **Transition Frequency**: How often to use connecting words
- **Repetition Tolerance**: How much word repetition is acceptable

## Profile-Specific Features

### Academic Profile
- Citation format checking (APA, MLA, Chicago)
- Academic phrase bank suggestions
- Plagiarism sensitivity warnings
- Formal vocabulary enforcement

### Business Profile
- Bullet point optimization
- Action verb emphasis
- SMART goals formatting
- Meeting minutes structure

### Creative Profile
- Dialogue formatting assistance
- Show vs. tell balance
- Metaphor density control
- Pacing variation analysis

### Technical Profile
- Code snippet formatting
- Step numbering validation
- Version-specific language
- Consistent terminology

### Email Profile
- Subject line analysis
- Greeting/closing suggestions
- Call-to-action clarity
- Length optimization

### Social Media Profile
- Character count tracking
- Hashtag suggestions
- Emoji usage guidance
- Engagement optimization

## How Profiles Affect Suggestions

### Example 1: Contractions

**Business Profile Active**:
- "don't" → "do not" ✓ (suggests formal version)

**Creative Profile Active**:
- "do not" → "don't" ✓ (suggests conversational tone)

### Example 2: Sentence Fragments

**Academic Profile Active**:
- "Because of the results." ❌ (flags as error)

**Creative Profile Active**:
- "Because of the results." ✓ (accepts for style)

### Example 3: Passive Voice

**Technical Profile Active**:
- "The button should be pressed" ✓ (appropriate for instructions)

**Business Profile Active**:
- "The button should be pressed" → "Press the button" (suggests active voice)

## Integration with AI Grammar Checking

When AI checking is enabled, the style profile:
1. Modifies the AI prompt to understand your writing context
2. Adjusts confidence scores based on profile rules
3. Provides profile-specific suggestions
4. Learns from your acceptance patterns per profile

## Best Practices

1. **Set Profile First**: Select your profile before starting to write
2. **Document Association**: Let WordWise remember profiles per document
3. **Custom Profiles**: Create custom profiles for specific clients or projects
4. **Regular Reviews**: Periodically review profile suggestions to refine settings
5. **Context Switching**: Use different profiles for different sections (manually switch)

## Troubleshooting

### Profile Not Affecting Suggestions
- Ensure AI grammar checking is enabled for full profile integration
- Check that the profile is actually active (blue highlight)
- Some rules only apply to new text typed after activation

### Auto-detect Not Working
- Needs at least 100 words of content
- Works best with clear document markers (e.g., "Dear" for emails)
- May default to "Business" if uncertain

### Suggestions Seem Wrong for Profile
- Profiles are guidelines, not absolute rules
- You can always ignore suggestions that don't fit
- Consider creating a custom profile for unique needs

## Profile Customization (Coming Soon)

Future updates will allow:
- Creating fully custom profiles
- Adjusting individual rule weights
- Importing/exporting profiles
- Team profile sharing
- Industry-specific templates

## Privacy & Data

- Profiles are stored in your account
- Document-profile associations are private
- No content is shared between users
- Profile usage helps improve suggestions (optional)

## Tips for Each Profile Type

### Academic Writing
- Enable before starting research papers
- Pay attention to citation format consistency
- Use formal vocabulary suggestions
- Watch for passive voice warnings

### Business Writing
- Great for emails, reports, and proposals
- Focus on clarity and brevity suggestions
- Use action verb recommendations
- Keep sentences concise

### Creative Writing
- Allows more stylistic freedom
- Good for fiction, poetry, and blogs
- Ignores some "technical" errors
- Focuses on flow and engagement

### Technical Writing
- Best for documentation and guides
- Emphasizes clarity and precision
- Validates step-by-step formats
- Ensures consistent terminology

## Keyboard Shortcuts

- **Ctrl+Shift+P**: Cycle through profiles
- **Ctrl+Alt+P**: Toggle profile panel
- **Ctrl+Shift+A**: Auto-detect profile

---

*Note: Style Profiles are continuously learning from your writing patterns. The more you use them, the better they become at understanding your unique style within each context.* 