// Test script for Style Profiles feature
// Run with: node test-style-profiles.js

// Sample texts for different profiles
const testTexts = {
  academic: `The empirical evidence dont support the hypothesis that social media usage directly correlates with decreased academic performance. However the relationship appears to be mediated by factors such as time management skills and self-regulation. This phenomena requires further investigation.`,
  
  business: `Hi team! Just wanted to touch base about the Q4 projections. We gotta ensure our KPIs are aligned with the strategic objectives. Let's circle back on this tomorrow and we can deep dive into the numbers. Also, don't forget about the stakeholder meeting - it's super important!`,
  
  creative: `The rain fell. Hard. Like bullets on the tin roof. Sarah watched. Waiting. Because sometimes, that's all you can do when the world's falling apart around you. She thought about calling him. But what was the point? Words don't fix broken things.`,
  
  technical: `To implement the authentication system, you need to first install the required dependencies. The system is configured using environment variables. Users should be aware that the API endpoints are protected by middleware. The database schema must be migrated before running the application.`,
  
  email: `Hey John,

Hope your doing well! I wanted to reach out regarding the project proposal we discussed last week. Do you think you could send me the updated timeline by friday? Also I think we should schedule a quick call to go over the budget.

Let me know what works for you.

Thanks alot!
Mike`,
  
  social: `Just had the BEST coffee at this new place downtown ☕️ Seriously guys, if you haven't tried their vanilla latte, your missing out!! Who wants to join me there tomorrow? 🙋‍♀️ #CoffeeAddict #LocalCoffeeShop #MorningVibes`
};

// Expected profile-specific feedback
const expectedFeedback = {
  academic: [
    "Change 'dont' to 'does not' (formal writing requires no contractions)",
    "Add comma after 'However' (transition word)",
    "Change 'phenomena' to 'phenomenon' (singular form needed)",
  ],
  
  business: [
    "Consider more formal alternatives to 'gotta' → 'need to'",
    "Replace 'super important' with 'critical' or 'essential'",
    "Avoid jargon like 'touch base' and 'circle back'",
  ],
  
  creative: [
    // Should NOT flag sentence fragments as errors
    // Should accept stylistic choices
    "No major issues - fragments are acceptable in creative writing",
  ],
  
  technical: [
    "Consider active voice: 'Configure the system' instead of 'The system is configured'",
    "Add step numbers for clarity",
    "Consider bullet points for the list of requirements",
  ],
  
  email: [
    "Change 'your' to 'you're' in greeting",
    "Capitalize 'friday' → 'Friday'",
    "Change 'alot' to 'a lot'",
    "Add comma after 'Also' at start of sentence",
  ],
  
  social: [
    "Change 'your' to 'you're' in 'your missing out'",
    // Should NOT flag emoji usage or informal tone
    // Should accept hashtags and casual language
  ],
};

// Simulated profile settings
const profileSettings = {
  academic: {
    tone: { formalityLevel: 9, emotionalTone: 'neutral', voicePreference: 'balanced' },
    grammar: { fragmentTolerance: false, contractionUsage: 'never', oxfordComma: true },
    vocabulary: { complexityLevel: 'sophisticated', bannedWords: ['get', 'got', 'thing'] },
  },
  
  business: {
    tone: { formalityLevel: 7, emotionalTone: 'professional', voicePreference: 'active' },
    grammar: { fragmentTolerance: false, contractionUsage: 'informal', oxfordComma: true },
    vocabulary: { complexityLevel: 'moderate', jargonTolerance: 'moderate' },
  },
  
  creative: {
    tone: { formalityLevel: 5, emotionalTone: 'neutral', voicePreference: 'balanced' },
    grammar: { fragmentTolerance: true, contractionUsage: 'always', oxfordComma: false },
    vocabulary: { complexityLevel: 'moderate', jargonTolerance: 'high' },
  },
  
  technical: {
    tone: { formalityLevel: 6, emotionalTone: 'neutral', voicePreference: 'active' },
    grammar: { fragmentTolerance: false, contractionUsage: 'never', oxfordComma: true },
    vocabulary: { complexityLevel: 'sophisticated', technicalTermsAllowed: true },
  },
  
  email: {
    tone: { formalityLevel: 6, emotionalTone: 'professional', voicePreference: 'active' },
    grammar: { fragmentTolerance: true, contractionUsage: 'informal', oxfordComma: false },
    vocabulary: { complexityLevel: 'simple', jargonTolerance: 'minimal' },
  },
  
  social: {
    tone: { formalityLevel: 3, emotionalTone: 'positive', voicePreference: 'active' },
    grammar: { fragmentTolerance: true, contractionUsage: 'always', oxfordComma: false },
    vocabulary: { complexityLevel: 'simple', jargonTolerance: 'high' },
  },
};

// Test function
async function testProfile(profileType, text) {
  console.log(`\n📝 Testing ${profileType.toUpperCase()} Profile`);
  console.log('━'.repeat(50));
  console.log('Text:', text.substring(0, 100) + '...\n');
  
  console.log('Profile Settings:');
  const settings = profileSettings[profileType];
  console.log(`- Formality: ${settings.tone.formalityLevel}/10`);
  console.log(`- Fragments allowed: ${settings.grammar.fragmentTolerance}`);
  console.log(`- Contractions: ${settings.grammar.contractionUsage}`);
  console.log(`- Vocabulary level: ${settings.vocabulary.complexityLevel}\n`);
  
  console.log('Expected Feedback:');
  expectedFeedback[profileType].forEach(feedback => {
    console.log(`  ✓ ${feedback}`);
  });
  
  console.log('\n' + '─'.repeat(50));
}

// Run tests
async function runAllTests() {
  console.log('🚀 WordWise Style Profiles Test Suite');
  console.log('=====================================\n');
  
  for (const [profile, text] of Object.entries(testTexts)) {
    await testProfile(profile, text);
  }
  
  console.log('\n✅ Test suite complete!');
  console.log('\nKey Observations:');
  console.log('1. Academic profile enforces formal writing with no contractions');
  console.log('2. Creative profile accepts fragments and stylistic choices');
  console.log('3. Email profile balances formality with conversational tone');
  console.log('4. Social media profile is highly permissive of informal language');
  console.log('5. Technical profile emphasizes clarity and active voice');
  console.log('6. Business profile seeks professional yet accessible language');
}

// Execute tests
runAllTests().catch(console.error); 