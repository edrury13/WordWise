import { GrammarRule, QualityFactor, RuleContext } from './types'
import { 
  enhancedQualityFactors, 
  createSmartReplacement, 
  optimizedPatterns
} from './enhanced-patterns'

// Enhanced quality factor calculators with legacy support
const commonQualityFactors: Record<string, QualityFactor> = {
  ...enhancedQualityFactors,
  // Legacy factors for backward compatibility
  patternAccuracy: enhancedQualityFactors.contextualAccuracy,
  contextRelevance: enhancedQualityFactors.linguisticComplexity,
  commonError: enhancedQualityFactors.frequencyBasedAccuracy,
  replacementQuality: enhancedQualityFactors.negativeContextDetection
}

export const GRAMMAR_RULES: GrammarRule[] = [
  // ================================
  // ENHANCED RULES (Higher Priority)
  // ================================
  {
    id: 'subject-verb-was-were-enhanced',
    name: 'Enhanced Subject-Verb Agreement: was/were',
    description: 'Corrects incorrect use of "was" with plural subjects using enhanced pattern matching',
    pattern: optimizedPatterns.subjectVerbAgreement,
    message: "Subject-verb disagreement. Use 'were' instead of 'was' with plural subjects.",
    category: 'subject-verb-agreement',
    subcategory: 'past-tense-be',
    severity: 'high',
    type: 'grammar',
    version: '2.1.0',
    priority: 98,
    enabled: true,
    qualityFactors: [
      enhancedQualityFactors.contextualAccuracy,
      enhancedQualityFactors.linguisticComplexity,
      enhancedQualityFactors.frequencyBasedAccuracy,
      enhancedQualityFactors.negativeContextDetection
    ],
    tags: ['basic-grammar', 'common-error', 'be-verb', 'enhanced'],
    examples: [
      { incorrect: "You was there", correct: "You were there", explanation: "Always use 'were' with 'you'" },
      { incorrect: "They was happy", correct: "They were happy", explanation: "Use 'were' with plural subjects" },
      { incorrect: "The students was studying", correct: "The students were studying", explanation: "Plural nouns take 'were'" }
    ],
    replacement: (match: string, _groups?: string[]) => {
      const replacement = match.replace(/was/i, 'were')
      return createSmartReplacement.preserveCapitalization(match, replacement)
    }
  },

  {
    id: 'your-youre-enhanced',
    name: 'Enhanced Your/You\'re Detection',
    description: 'Improved detection of your/you\'re confusion with context analysis',
    pattern: optimizedPatterns.yourYoureDetection,
    message: "Check if you're using the correct form: 'your' (possession) or 'you're' (you are).",
    category: 'commonly-confused-words',
    subcategory: 'contractions',
    severity: 'medium',
    type: 'spelling',
    version: '2.1.0',
    priority: 88,
    enabled: true,
    qualityFactors: [
      enhancedQualityFactors.contextualAccuracy,
      enhancedQualityFactors.frequencyBasedAccuracy,
      enhancedQualityFactors.negativeContextDetection
    ],
    tags: ['contractions', 'common-error', 'possessives', 'enhanced'],
    examples: [
      { incorrect: "Your going home", correct: "You're going home", explanation: "Use 'you're' for 'you are'" },
      { incorrect: "I like you're car", correct: "I like your car", explanation: "Use 'your' for possession" }
    ],
    replacement: (match: string, _groups?: string[]) => {
      const _word = _groups?.[0]?.toLowerCase() || match.split(/\s+/)[0].toLowerCase()
      const followingWord = _groups?.[1] || match.split(/\s+/)[1]
      
      // Context-aware replacement
      const actionWords = ['going', 'coming', 'running', 'walking', 'playing', 'working', 'studying', 'happy', 'sad', 'ready', 'sure', 'right', 'wrong', 'good', 'bad', 'tired', 'busy', 'free', 'late', 'early', 'done', 'finished']
      
      if (actionWords.includes(followingWord.toLowerCase()) && _word === 'your') {
        return createSmartReplacement.preserveCapitalization(match, `you're ${followingWord}`)
      }
      
      return match // Return original if context is unclear
    }
  },

  {
    id: 'there-their-theyre-enhanced',
    name: 'Enhanced There/Their/They\'re Detection',
    description: 'Advanced context-aware detection of there/their/they\'re confusion',
    pattern: optimizedPatterns.thereTheirTheyre,
    message: "Check if you're using the correct form: 'there' (location), 'their' (possession), or 'they're' (they are).",
    category: 'commonly-confused-words',
    subcategory: 'homophones',
    severity: 'medium',
    type: 'spelling',
    version: '2.1.0',
    priority: 87,
    enabled: true,
    qualityFactors: [
      enhancedQualityFactors.contextualAccuracy,
      enhancedQualityFactors.linguisticComplexity,
      enhancedQualityFactors.frequencyBasedAccuracy
    ],
    tags: ['homophones', 'common-error', 'possessives', 'contractions', 'enhanced'],
    examples: [
      { incorrect: "There going home", correct: "They're going home", explanation: "Use 'they're' for 'they are'" },
      { incorrect: "I like they're house", correct: "I like their house", explanation: "Use 'their' for possession" },
      { incorrect: "Put it over their", correct: "Put it over there", explanation: "Use 'there' for location" }
    ],
    replacement: (match: string, _groups?: string[]) => {
      const actionWord = _groups?.[1] // Action/state words (they're context)
      const possessiveWord = _groups?.[2] // Possessive nouns (their context)
      
      if (actionWord) {
        // Context suggests contraction "they're"
        return createSmartReplacement.preserveCapitalization(match, `they're ${actionWord}`)
      } else if (possessiveWord) {
        // Context suggests possessive "their"
        return createSmartReplacement.preserveCapitalization(match, `their ${possessiveWord}`)
      }
      
      return match // Return original if context is unclear
    }
  },

  {
    id: 'incomplete-sentence-enhanced',
    name: 'Enhanced Incomplete Sentence Detection',
    description: 'Advanced detection of incomplete sentences with context validation',
    pattern: optimizedPatterns.incompleteSentence,
    message: "This appears to be an incomplete sentence. Consider adding a helping verb or completing the thought.",
    category: 'incomplete-sentence',
    subcategory: 'missing-auxiliary',
    severity: 'high',
    type: 'grammar',
    version: '2.1.0',
    priority: 90,
    enabled: true,
    qualityFactors: [
      enhancedQualityFactors.contextualAccuracy,
      enhancedQualityFactors.linguisticComplexity,
      {
        name: 'Sentence Completeness',
        weight: 0.3,
        calculator: (context: RuleContext, match: string) => {
          // Check if this is actually part of a larger sentence
          const fullText = context.text
          const matchIndex = fullText.indexOf(match)
          
          // Look for continuation after the match
          const afterMatch = fullText.substring(matchIndex + match.length).trim()
          if (afterMatch.length > 0 && !afterMatch.startsWith('.') && !afterMatch.startsWith('!') && !afterMatch.startsWith('?')) {
            return 30 // Likely part of a larger sentence
          }
          
          // Check for common incomplete patterns
          if (match.match(/^(the|a|an)\s+\w+\s+(running|walking|jumping)/i)) {
            return 95 // Very likely incomplete
          }
          
          return 75
        }
      }
    ],
    tags: ['sentence-structure', 'auxiliary-verbs', 'enhanced'],
    examples: [
      { incorrect: "The cat running", correct: "The cat is running", explanation: "Add auxiliary verb 'is'" },
      { incorrect: "A dog barking", correct: "A dog is barking", explanation: "Add auxiliary verb 'is'" }
    ],
    replacement: (match: string, _groups?: string[]) => {
      const parts = match.trim().split(/\s+/)
      if (parts.length >= 3) {
        const article = parts[0]
        const noun = parts[1]
        const verb = parts[2]
        
        // Determine appropriate auxiliary verb
        const auxiliary = article.toLowerCase() === 'the' && noun.endsWith('s') ? 'are' : 'is'
        
        const suggestion = `${article} ${noun} ${auxiliary} ${verb}`
        return createSmartReplacement.preserveCapitalization(match, suggestion)
      }
      
      return match
    }
  },

  // ================================
  // EXISTING RULES (Original Priority)
  // ================================
  {
    id: 'subject-verb-third-person-singular',
    name: 'Third Person Singular Verb Agreement',
    description: 'Ensures verbs agree with third person singular subjects (he/she/it)',
    pattern: /\b(he|she|it|He|She|It)\s+(run|walk|jump|swim|fly|sleep|eat|drink|play|work|study|read|write|talk|sing|dance|cook|drive|sit|stand|move|come|go|look|watch|listen|think|feel|get|make|take|give|see|know|say|tell|ask|help|learn|teach|buy|sell|build|clean|wash|fix|paint|open|close|start|stop|continue|begin|end|finish|try|want|need|love|like|hate|hope|believe|understand|remember|forget|choose|decide|plan|prepare|organize|manage|control|lead|follow|support|encourage|celebrate|enjoy|suffer|struggle|fight|win|lose|compete|practice|train|exercise|relax|rest|wake|dream)\b(?!\w)/gi,
    message: "Subject-verb disagreement. Add 's' or 'es' to the verb with third person singular subjects.",
    category: 'subject-verb-agreement',
    subcategory: 'third-person-singular',
    severity: 'high',
    type: 'grammar',
    version: '1.0.0',
    priority: 90,
    enabled: true,
    qualityFactors: [commonQualityFactors.patternAccuracy, commonQualityFactors.commonError],
    tags: ['basic-grammar', 'verb-inflection', 'common-error'],
    examples: [
      { incorrect: "He run fast", correct: "He runs fast", explanation: "Add 's' to verbs with he/she/it" },
      { incorrect: "She go to school", correct: "She goes to school", explanation: "Some verbs have irregular forms" }
    ],
    replacement: (match: string) => {
      const parts = match.split(/\s+/)
      const pronoun = parts[0]
      const verb = parts[1].toLowerCase()
      
      const irregularVerbs: Record<string, string> = {
        'go': 'goes',
        'do': 'does',
        'have': 'has',
        'say': 'says',
        'try': 'tries',
        'fly': 'flies',
        'cry': 'cries',
        'study': 'studies'
      }
      
      const correctedVerb = irregularVerbs[verb] || (verb.endsWith('s') || verb.endsWith('sh') || verb.endsWith('ch') || verb.endsWith('x') || verb.endsWith('z') ? verb + 'es' : verb + 's')
      
      return `${pronoun} ${correctedVerb}`
    }
  },

  {
    id: 'subject-verb-collective-nouns',
    name: 'Collective Noun Agreement',
    description: 'Handles subject-verb agreement with collective nouns',
    pattern: /\b(team|group|family|class|committee|staff|crew|band|audience|jury|crowd|government|company|organization)\s+(are|were|have)\b/gi,
    message: "Collective nouns are typically singular. Consider using 'is', 'was', or 'has'.",
    category: 'subject-verb-agreement',
    subcategory: 'collective-nouns',
    severity: 'medium',
    type: 'grammar',
    version: '1.0.0',
    priority: 75,
    enabled: true,
    qualityFactors: [commonQualityFactors.patternAccuracy, commonQualityFactors.contextRelevance],
    tags: ['collective-nouns', 'advanced-grammar'],
    examples: [
      { incorrect: "The team are playing", correct: "The team is playing", explanation: "Collective nouns are usually singular" }
    ],
    replacement: (match: string) => {
      const parts = match.split(/\s+/)
      const noun = parts[0]
      const verb = parts[1].toLowerCase()
      
      const replacement = verb === 'are' ? 'is' : verb === 'were' ? 'was' : 'has'
      return `${noun} ${replacement}`
    }
  },

  // ================================
  // COMMONLY CONFUSED WORDS
  // ================================
  {
    id: 'there-their-theyre-possessive',
    name: 'Their (Possessive) Misuse',
    description: 'Detects incorrect use of "there" or "they\'re" when "their" (possessive) is needed',
    pattern: /\b(there|they're)\s+(?:own\s+)?(?:house|car|home|room|office|job|work|family|children|kids|parents|mother|father|mom|dad|brother|sister|friend|friends|dog|cat|pet|pets|book|books|phone|computer|laptop|tablet|camera|clothes|shoes|bag|bags|money|wallet|keys|glasses|watch|jewelry|ring|necklace|bracelet|earrings|hair|face|eyes|nose|mouth|hands|fingers|arms|legs|feet|body|head|voice|smile|laugh|tears|dreams|hopes|fears|thoughts|feelings|emotions|memories|experiences|stories|secrets|problems|issues|concerns|worries|plans|goals|ideas|opinions|beliefs|values|principles|rights|responsibilities|duties|obligations|commitments|promises|decisions|choices|mistakes|errors|faults|successes|achievements|accomplishments|victories|failures|defeats|losses|wins|games|sports|hobbies|interests|skills|talents|abilities|strengths|weaknesses|health|fitness|diet|exercise|sleep|rest|relaxation|vacation|holiday|trip|journey|adventure|education|school|college|university|degree|diploma|certificate|license|permit|passport|visa|ticket|reservation|appointment|meeting|interview|presentation|speech|talk|lecture|class|course|lesson|workshop|seminar|conference|event|party|celebration|ceremony|wedding|birthday|anniversary|graduation|funeral|business|company|organization|team|group|club|association|society|community|neighborhood|city|town|village|country|nation|culture|tradition|custom|habit|routine|schedule|agenda|calendar|plan|strategy|approach|method|technique|process|system|structure|design|style|fashion|taste|preference|choice|decision|opinion|view|perspective|attitude|behavior|personality|character|nature|temperament|mood|spirit|soul|heart|mind|brain|intelligence|wisdom|knowledge|understanding|awareness|consciousness|memory|imagination|creativity|inspiration|motivation|ambition|determination|courage|confidence|faith|trust|hope|love|passion|desire|wish|want|need|requirement|demand|request|order|command|instruction|direction|guidance|advice|suggestion|recommendation|proposal|offer|deal|agreement|contract|arrangement|plan|project|task|assignment|homework|job|career|profession|occupation|position|role|title|rank|status|level|grade|score|result|outcome|consequence|effect|impact|influence|power|authority|control|leadership|management|supervision|responsibility|accountability|liability|ownership|possession|property|asset|investment|savings|income|salary|wage|pay|bonus|reward|prize|award|gift|present|donation|contribution|payment|fee|cost|price|value|worth|wealth|fortune|treasure|collection|set|series|group|bunch|pile|stack|heap|load|amount|quantity|number|count|total|sum|average|percentage|rate|ratio|proportion|fraction|part|piece|section|segment|portion|share|division|category|type|kind|sort|variety|range|selection|option|alternative|possibility|opportunity|chance|risk|danger|threat|hazard|problem|issue|challenge|difficulty|obstacle|barrier|limitation|restriction|constraint|boundary|border|edge|limit|end|beginning|start|middle|center|core|heart|soul|spirit|mind|brain|thought|idea|concept|notion|theory|hypothesis|assumption|belief|opinion|view|perspective|attitude|approach|position|stance|point|argument|reason|cause|factor|element|component|part|piece|section|segment|portion|share|percentage|fraction|ratio|proportion|rate|speed|pace|tempo|rhythm|beat|pulse|frequency|intensity|strength|power|force|pressure|stress|tension|strain|load|weight|mass|size|scale|scope|range|extent|degree|level|grade|rank|status|position|place|location|spot|site|area|region|zone|district|neighborhood|community|society|culture|civilization|nation|country|state|province|city|town|village|home|house|building|structure|facility|establishment|institution|organization|business|company|corporation|enterprise|firm|agency|office|store|shop|market|mall|center|complex|park|garden|forest|woods|trees|plants|flowers|grass|field|meadow|plain|valley|hill|mountain|peak|summit|cliff|rock|stone|sand|soil|earth|ground|land|territory|property|estate|farm|ranch|plantation|yard|garden|lawn|driveway|path|trail|road|street|avenue|boulevard|highway|freeway|bridge|tunnel|river|stream|creek|lake|pond|ocean|sea|beach|shore|coast|island|continent|world|planet|earth|moon|sun|star|galaxy|universe|space|time|moment|instant|second|minute|hour|day|week|month|year|decade|century|millennium|age|era|period|phase|stage|step|level|degree|grade|class|category|type|kind|sort|variety|species|breed|race|gender|sex|age|height|weight|size|color|shape|form|design|pattern|style|fashion|trend|mode|way|method|technique|approach|strategy|plan|scheme|system|structure|organization|arrangement|order|sequence|series|chain|line|row|column|list|menu|table|chart|graph|diagram|map|picture|image|photo|painting|drawing|sketch|illustration|figure|symbol|sign|mark|label|tag|title|name|word|term|phrase|sentence|paragraph|page|chapter|section|book|document|file|folder|record|report|account|story|tale|narrative|description|explanation|definition|meaning|sense|significance|importance|value|worth|price|cost|expense|fee|charge|rate|tax|bill|invoice|receipt|ticket|pass|card|license|permit|certificate|diploma|degree|award|prize|gift|present|reward|bonus|tip|payment|salary|wage|income|revenue|profit|loss|debt|loan|mortgage|rent|lease|contract|agreement|deal|bargain|offer|proposal|suggestion|recommendation|advice|guidance|help|assistance|support|service|favor|kindness|generosity|charity|donation|contribution|investment|sponsorship|funding|financing|backing|endorsement|approval|permission|consent|authorization|clearance|license|permit|certificate|credential|qualification|skill|ability|talent|gift|strength|power|capacity|capability|potential|opportunity|chance|possibility|option|choice|alternative|solution|answer|response|reply|reaction|feedback|comment|remark|observation|note|message|communication|information|data|facts|details|specifics|particulars|features|characteristics|qualities|attributes|properties|aspects|elements|components|parts|pieces|sections|segments|portions|shares|percentages|fractions|ratios|proportions|rates|speeds|paces|tempos|rhythms|beats|pulses|frequencies|intensities|strengths|powers|forces|pressures|stresses|tensions|strains|loads|weights|masses|sizes|scales|scopes|ranges|extents|degrees|levels|grades|ranks|statuses|positions|places|locations|spots|sites|areas|regions|zones|districts|neighborhoods|communities|societies|cultures|civilizations|nations|countries|states|provinces|cities|towns|villages|districts|sectors|quarters|blocks|streets|roads|paths|routes|ways|directions|courses|tracks|trails|lines|borders|boundaries|edges|limits|extremes|ends|conclusions|finishes|completions|achievements|accomplishments|successes|victories|wins|triumphs|conquests|defeats|losses|failures|mistakes|errors|faults|flaws|defects|problems|issues|troubles|difficulties|challenges|obstacles|barriers|impediments|hindrances|restrictions|limitations|constraints|boundaries|borders|edges|margins|frames|outlines|shapes|forms|figures|patterns|designs|styles|fashions|trends|movements|changes|developments|evolutions|progressions|advances|improvements|enhancements|upgrades|updates|modifications|adjustments|corrections|fixes|repairs|solutions|answers|responses|replies|reactions|feedbacks|comments|remarks|observations|notes|notices|warnings|alerts|alarms|signals|signs|symbols|marks|labels|tags|names|titles|headings|captions|descriptions|explanations|definitions|meanings|interpretations|translations|versions|editions|copies|duplicates|originals|sources|references|examples|instances|cases|situations|circumstances|conditions|states|statuses|positions|locations|places|spots|points|areas|zones|regions|districts|sectors|territories|lands|grounds|soils|earths|worlds|planets|universes|spaces|times|moments|instants|seconds|minutes|hours|days|weeks|months|years|decades|centuries|millenniums|ages|eras|periods|phases|stages|steps|levels|degrees|extents|scales|sizes|dimensions|measurements|lengths|widths|heights|depths|weights|masses|volumes|capacities|speeds|velocities|accelerations|forces|energies|powers|strengths|pressures|temperatures|heats|colds|warmths|coolnesses|lights|darknesses|brightnesses|shadows|colors|shades|tones|hues|textures|surfaces|materials|substances|elements|components|ingredients|factors|aspects|features|characteristics|qualities|properties|attributes|traits|details|parts|pieces|sections|segments|portions|shares|divisions|units|items|objects|things|stuff|matters|contents|informations|datas|facts|details|statistics|figures|numbers|amounts|quantities|measures|dimensions|specifications|requirements|standards|criteria|conditions|terms|rules|regulations|laws|policies|procedures|protocols|guidelines|instructions|directions|steps|stages|phases|processes|methods|techniques|strategies|approaches|ways|means|tools|instruments|equipment|devices|machines|systems|structures|buildings|facilities|installations|establishments|institutions|organizations|companies|businesses|enterprises|corporations|firms|agencies|departments|offices|branches|divisions|sections|units|teams|groups|clubs|associations|societies|communities|networks|connections|relationships|partnerships|alliances|collaborations|cooperations|agreements|contracts|deals|arrangements|plans|projects|programs|initiatives|campaigns|movements|causes|missions|purposes|objectives|goals|targets|aims|ambitions|dreams|visions|hopes|wishes|desires|wants|needs|requirements|demands|requests|orders|commands|instructions|directions|guidance|advice|suggestions|recommendations|proposals|offers)\b/gi,
    message: "Use 'their' to show possession or ownership.",
    category: 'commonly-confused-words',
    subcategory: 'homophones',
    severity: 'medium',
    type: 'spelling',
    version: '2.0.0',
    priority: 85,
    enabled: true,
    qualityFactors: [commonQualityFactors.patternAccuracy, commonQualityFactors.commonError],
    tags: ['homophones', 'common-error', 'possessives'],
    examples: [
      { incorrect: "I like there house", correct: "I like their house", explanation: "Use 'their' for possession" },
      { incorrect: "They're car is red", correct: "Their car is red", explanation: "Use 'their' to show ownership" }
    ],
    replacement: (match: string) => {
      const parts = match.split(/\s+/)
      const followingWord = parts.slice(1).join(' ')
      return `their ${followingWord}`
    }
  },

  {
    id: 'there-their-theyre-contraction',
    name: 'They\'re (Contraction) Misuse',
    description: 'Detects incorrect use of "there" or "their" when "they\'re" (they are) is needed',
    pattern: /\b(there|their)\s+(?:going|coming|running|walking|jumping|swimming|flying|sleeping|eating|drinking|playing|working|studying|reading|writing|talking|singing|dancing|cooking|driving|sitting|standing|lying|moving|looking|watching|listening|thinking|feeling|being|doing|having|getting|making|taking|giving|seeing|knowing|saying|telling|asking|helping|learning|teaching|buying|selling|building|cleaning|washing|fixing|painting|opening|closing|starting|stopping|continuing|beginning|ending|finishing|trying|wanting|needing|loving|liking|hating|hoping|believing|understanding|remembering|forgetting|choosing|deciding)\b/gi,
    message: "Use 'they're' as a contraction for 'they are'.",
    category: 'commonly-confused-words',
    subcategory: 'contractions',
    severity: 'medium',
    type: 'spelling',
    version: '2.0.0',
    priority: 85,
    enabled: true,
    qualityFactors: [commonQualityFactors.patternAccuracy, commonQualityFactors.commonError],
    tags: ['homophones', 'common-error', 'contractions'],
    examples: [
      { incorrect: "There going home", correct: "They're going home", explanation: "Use 'they're' for 'they are'" },
      { incorrect: "Their happy", correct: "They're happy", explanation: "Use 'they're' for 'they are'" }
    ],
    replacement: (match: string) => {
      const parts = match.split(/\s+/)
      const followingWord = parts.slice(1).join(' ')
      return `they're ${followingWord}`
    }
  },

  // ================================
  // ADJECTIVE/ADVERB CONFUSION
  // ================================
  {
    id: 'adjective-adverb-good-well',
    name: 'Good vs Well',
    description: 'Corrects confusion between "good" and "well"',
    pattern: /\b(runs?|walks?|works?|plays?|moves?|performs?|does?|speaks?|writes?|sings?|dances?|cooks?|drives?|sleeps?|eats?|drinks?|thinks?|feels?|looks?|sounds?|smells?|tastes?)\s+good\b/gi,
    message: "Use 'well' (adverb) to describe how an action is performed, not 'good' (adjective).",
    category: 'adjective-adverb-confusion',
    subcategory: 'good-well',
    severity: 'medium',
    type: 'grammar',
    version: '1.0.0',
    priority: 70,
    enabled: true,
    qualityFactors: [commonQualityFactors.patternAccuracy, commonQualityFactors.commonError],
    tags: ['adverbs', 'common-error', 'good-well'],
    examples: [
      { incorrect: "She runs good", correct: "She runs well", explanation: "Use 'well' to describe how actions are performed" },
      { incorrect: "He speaks good", correct: "He speaks well", explanation: "'Well' is the adverb form" }
    ],
    replacement: (match: string) => {
      return match.replace(/good/gi, 'well')
    }
  },

  {
    id: 'adjective-adverb-quick-quickly',
    name: 'Quick vs Quickly',
    description: 'Corrects adjective/adverb confusion with quick/quickly',
    pattern: /\b(runs?|walks?|moves?|works?|responds?|reacts?|changes?|develops?|grows?|learns?|adapts?|adjusts?)\s+quick\b/gi,
    message: "Use 'quickly' (adverb) to describe how an action is performed.",
    category: 'adjective-adverb-confusion',
    subcategory: 'ly-adverbs',
    severity: 'medium',
    type: 'grammar',
    version: '1.0.0',
    priority: 65,
    enabled: true,
    qualityFactors: [commonQualityFactors.patternAccuracy, commonQualityFactors.commonError],
    tags: ['adverbs', 'ly-ending'],
    examples: [
      { incorrect: "He runs quick", correct: "He runs quickly", explanation: "Add '-ly' to form the adverb" }
    ],
    replacement: (match: string) => {
      return match.replace(/quick/gi, 'quickly')
    }
  },

  // ================================
  // COMMA USAGE RULES
  // ================================
  {
    id: 'comma-before-and',
    name: 'Oxford Comma',
    description: 'Suggests adding Oxford comma in lists',
    pattern: /\b\w+,\s+\w+\s+and\s+\w+\b/gi,
    message: "Consider adding a comma before 'and' in this list (Oxford comma) for clarity.",
    category: 'comma-usage',
    subcategory: 'oxford-comma',
    severity: 'low',
    type: 'style',
    version: '1.0.0',
    priority: 40,
    enabled: true,
    qualityFactors: [commonQualityFactors.patternAccuracy, commonQualityFactors.contextRelevance],
    tags: ['punctuation', 'oxford-comma', 'style'],
    examples: [
      { incorrect: "red, blue and green", correct: "red, blue, and green", explanation: "Oxford comma improves clarity" }
    ],
    replacement: (match: string) => {
      return match.replace(/\s+and\s+/, ', and ')
    }
  },

  {
    id: 'comma-splice',
    name: 'Comma Splice',
    description: 'Detects comma splices (two independent clauses joined by comma)',
    pattern: /\b(I|you|he|she|it|we|they|this|that|these|those|the\s+\w+|a\s+\w+|an\s+\w+)\s+\w+[^,]*,\s+(I|you|he|she|it|we|they|this|that|these|those|the\s+\w+|a\s+\w+|an\s+\w+)\s+\w+/gi,
    message: "This might be a comma splice. Consider using a semicolon, period, or coordinating conjunction.",
    category: 'comma-splice',
    subcategory: 'independent-clauses',
    severity: 'medium',
    type: 'grammar',
    version: '1.0.0',
    priority: 60,
    enabled: true,
    qualityFactors: [commonQualityFactors.patternAccuracy, commonQualityFactors.contextRelevance],
    tags: ['punctuation', 'sentence-structure'],
    examples: [
      { incorrect: "I went to the store, she went home", correct: "I went to the store; she went home", explanation: "Use semicolon to join independent clauses" }
    ],
    replacement: (match: string) => {
      return match.replace(',', ';')
    }
  },

  // ================================
  // APOSTROPHE USAGE RULES
  // ================================
  {
    id: 'apostrophe-its-vs-its',
    name: 'Its vs It\'s',
    description: 'Corrects confusion between its and it\'s',
    pattern: /\b(its|it's)\s+(a|an|the|my|your|his|her|our|their|this|that|these|those|going|coming|running|walking|playing|working|studying|reading|writing|listening|watching|thinking|feeling|being|doing|having|getting|making|taking|giving|seeing|knowing|saying|telling|asking|helping|trying|wanting|needing|loving|liking|hating|hoping|believing|understanding|remembering|forgetting|choosing|deciding|time|turn|place|fault|problem|issue|responsibility|job|duty|role|purpose|meaning|value|worth|importance|significance|relevance|impact|effect|influence|power|strength|weakness|advantage|disadvantage|benefit|cost|price|expense|investment|return|profit|loss|gain|success|failure|achievement|accomplishment|goal|objective|target|aim|purpose|mission|vision|dream|hope|wish|desire|want|need|requirement|demand|request|suggestion|recommendation|advice|guidance|direction|instruction|command|order|rule|law|policy|procedure|process|method|technique|strategy|approach|way|manner|style|fashion|trend|pattern|habit|routine|schedule|plan|agenda|program|project|task|assignment|job|work|career|profession|occupation|business|company|organization|institution|agency|department|division|section|unit|team|group|committee|board|council|assembly|meeting|conference|workshop|seminar|class|course|lesson|lecture|presentation|speech|talk|discussion|conversation|interview|examination|test|quiz|assessment|evaluation|review|analysis|study|research|investigation|exploration|discovery|finding|result|outcome|conclusion|decision|choice|option|alternative|possibility|opportunity|chance|risk|threat|danger|hazard|problem|issue|challenge|difficulty|obstacle|barrier|limitation|restriction|constraint|boundary|border|edge|limit|end|beginning|start|middle|center|core|heart|soul|spirit|mind|brain|thought|idea|concept|notion|theory|hypothesis|assumption|belief|opinion|view|perspective|attitude|approach|position|stance|point|argument|reason|cause|factor|element|component|part|piece|section|segment|portion|share|percentage|fraction|ratio|proportion|rate|speed|pace|tempo|rhythm|beat|pulse|frequency|intensity|strength|power|force|pressure|stress|tension|strain|load|weight|mass|size|scale|scope|range|extent|degree|level|grade|rank|status|position|place|location|spot|site|area|region|zone|district|neighborhood|community|society|culture|civilization|nation|country|state|province|city|town|village|home|house|building|structure|facility|establishment|institution|organization|business|company|corporation|enterprise|firm|agency|office|store|shop|market|mall|center|complex|park|garden|forest|woods|trees|plants|flowers|grass|field|meadow|plain|valley|hill|mountain|peak|summit|cliff|rock|stone|sand|soil|earth|ground|land|territory|property|estate|farm|ranch|plantation|yard|garden|lawn|driveway|path|trail|road|street|avenue|boulevard|highway|freeway|bridge|tunnel|river|stream|creek|lake|pond|ocean|sea|beach|shore|coast|island|continent|world|planet|earth|moon|sun|star|galaxy|universe|space|time|moment|instant|second|minute|hour|day|week|month|year|decade|century|millennium|age|era|period|phase|stage|step|level|degree|grade|class|category|type|kind|sort|variety|species|breed|race|gender|sex|age|height|weight|size|color|shape|form|design|pattern|style|fashion|trend|mode|way|method|technique|approach|strategy|plan|scheme|system|structure|organization|arrangement|order|sequence|series|chain|line|row|column|list|menu|table|chart|graph|diagram|map|picture|image|photo|painting|drawing|sketch|illustration|figure|symbol|sign|mark|label|tag|title|name|word|term|phrase|sentence|paragraph|page|chapter|section|book|document|file|folder|record|report|account|story|tale|narrative|description|explanation|definition|meaning|sense|significance|importance|value|worth|price|cost|expense|fee|charge|rate|tax|bill|invoice|receipt|ticket|pass|card|license|permit|certificate|diploma|degree|award|prize|gift|present|reward|bonus|tip|payment|salary|wage|income|revenue|profit|loss|debt|loan|mortgage|rent|lease|contract|agreement|deal|bargain|offer|proposal|suggestion|recommendation|advice|guidance|help|assistance|support|service|favor|kindness|generosity|charity|donation|contribution|investment|sponsorship|funding|financing|backing|endorsement|approval|permission|consent|authorization|clearance|license|permit|certificate|credential|qualification|skill|ability|talent|gift|strength|power|capacity|capability|potential|opportunity|chance|possibility|option|choice|alternative|solution|answer|response|reply|reaction|feedback|comment|remark|observation|note|message|communication|information|data|facts|details|specifics|particulars|features|characteristics|qualities|attributes|properties|aspects|elements|components|parts|pieces|sections|segments|portions|shares|percentages|fractions|ratios|proportions|rates|speeds|paces|tempos|rhythms|beats|pulses|frequencies|intensities|strengths|powers|forces|pressures|stresses|tensions|strains|loads|weights|masses|sizes|scales|scopes|ranges|extents|degrees|levels|grades|ranks|statuses|positions|places|locations|spots|sites|areas|regions|zones|districts|neighborhoods|communities|societies|cultures|civilizations|nations|countries|states|provinces|cities|towns|villages|districts|sectors|quarters|blocks|streets|roads|paths|routes|ways|directions|courses|tracks|trails|lines|borders|boundaries|edges|limits|extremes|ends|conclusions|finishes|completions|achievements|accomplishments|successes|victories|wins|triumphs|conquests|defeats|losses|failures|mistakes|errors|faults|flaws|defects|problems|issues|troubles|difficulties|challenges|obstacles|barriers|impediments|hindrances|restrictions|limitations|constraints|boundaries|borders|edges|margins|frames|outlines|shapes|forms|figures|patterns|designs|styles|fashions|trends|movements|changes|developments|evolutions|progressions|advances|improvements|enhancements|upgrades|updates|modifications|adjustments|corrections|fixes|repairs|solutions|answers|responses|replies|reactions|feedbacks|comments|remarks|observations|notes|notices|warnings|alerts|alarms|signals|signs|symbols|marks|labels|tags|names|titles|headings|captions|descriptions|explanations|definitions|meanings|interpretations|translations|versions|editions|copies|duplicates|originals|sources|references|examples|instances|cases|situations|circumstances|conditions|states|statuses|positions|locations|places|spots|points|areas|zones|regions|districts|sectors|territories|lands|grounds|soils|earths|worlds|planets|universes|spaces|times|moments|instants|seconds|minutes|hours|days|weeks|months|years|decades|centuries|millenniums|ages|eras|periods|phases|stages|steps|levels|degrees|extents|scales|sizes|dimensions|measurements|lengths|widths|heights|depths|weights|masses|volumes|capacities|speeds|velocities|accelerations|forces|energies|powers|strengths|pressures|temperatures|heats|colds|warmths|coolnesses|lights|darknesses|brightnesses|shadows|colors|shades|tones|hues|textures|surfaces|materials|substances|elements|components|ingredients|factors|aspects|features|characteristics|qualities|properties|attributes|traits|details|parts|pieces|sections|segments|portions|shares|divisions|units|items|objects|things|stuff|matters|contents|informations|datas|facts|details|statistics|figures|numbers|amounts|quantities|measures|dimensions|specifications|requirements|standards|criteria|conditions|terms|rules|regulations|laws|policies|procedures|protocols|guidelines|instructions|directions|steps|stages|phases|processes|methods|techniques|strategies|approaches|ways|means|tools|instruments|equipment|devices|machines|systems|structures|buildings|facilities|installations|establishments|institutions|organizations|companies|businesses|enterprises|corporations|firms|agencies|departments|offices|branches|divisions|sections|units|teams|groups|clubs|associations|societies|communities|networks|connections|relationships|partnerships|alliances|collaborations|cooperations|agreements|contracts|deals|arrangements|plans|projects|programs|initiatives|campaigns|movements|causes|missions|purposes|objectives|goals|targets|aims|ambitions|dreams|visions|hopes|wishes|desires|wants|needs|requirements|demands|requests|orders|commands|instructions|directions|guidance|advice|suggestions|recommendations|proposals|offers)\b/gi,
    message: "Check if you need 'its' (possessive) or 'it's' (it is).",
    category: 'apostrophe-usage',
    subcategory: 'possessive-vs-contraction',
    severity: 'medium',
    type: 'spelling',
    version: '1.0.0',
    priority: 75,
    enabled: true,
    qualityFactors: [commonQualityFactors.patternAccuracy, commonQualityFactors.commonError],
    tags: ['apostrophes', 'possessives', 'contractions'],
    examples: [
      { incorrect: "Its going well", correct: "It's going well", explanation: "Use 'it's' for 'it is'" },
      { incorrect: "The dog wagged it's tail", correct: "The dog wagged its tail", explanation: "Use 'its' for possession (no apostrophe)" }
    ],
    replacement: (match: string) => {
      const parts = match.split(/\s+/)
      const word = parts[0].toLowerCase()
      const followingWord = parts[1]
      
      // If followed by a verb or adjective, likely should be "it's"
      const verbsAndAdjectives = ['going', 'coming', 'time', 'a', 'an', 'the', 'been', 'being']
      if (verbsAndAdjectives.includes(followingWord.toLowerCase()) && word === 'its') {
        return `it's ${followingWord}`
      }
      
      // If followed by a noun, likely should be "its"
      if (word === "it's" && !verbsAndAdjectives.includes(followingWord.toLowerCase())) {
        return `its ${followingWord}`
      }
      
      return match
    }
  },

  // ================================
  // REDUNDANCY AND WORDINESS
  // ================================
  {
    id: 'redundant-phrases',
    name: 'Redundant Phrases',
    description: 'Identifies common redundant phrases',
    pattern: /\b(advance planning|past history|future plans|end result|final outcome|close proximity|exact same|free gift|added bonus|unexpected surprise|brief summary|general consensus|personal opinion|true facts|absolutely essential|completely finished|totally destroyed|very unique|most unique|more perfect|most perfect|irregardless|could care less)\b/gi,
    message: "This phrase contains redundancy. Consider using a more concise alternative.",
    category: 'redundancy',
    subcategory: 'redundant-phrases',
    severity: 'low',
    type: 'conciseness',
    version: '1.0.0',
    priority: 35,
    enabled: true,
    qualityFactors: [commonQualityFactors.patternAccuracy, commonQualityFactors.contextRelevance],
    tags: ['redundancy', 'conciseness', 'wordiness'],
    examples: [
      { incorrect: "advance planning", correct: "planning", explanation: "Planning is inherently done in advance" },
      { incorrect: "past history", correct: "history", explanation: "History refers to the past" }
    ],
    replacement: (match: string) => {
      const redundantMap: Record<string, string> = {
        'advance planning': 'planning',
        'past history': 'history',
        'future plans': 'plans',
        'end result': 'result',
        'final outcome': 'outcome',
        'close proximity': 'proximity',
        'exact same': 'same',
        'free gift': 'gift',
        'added bonus': 'bonus',
        'unexpected surprise': 'surprise',
        'brief summary': 'summary',
        'general consensus': 'consensus',
        'personal opinion': 'opinion',
        'true facts': 'facts',
        'absolutely essential': 'essential',
        'completely finished': 'finished',
        'totally destroyed': 'destroyed',
        'very unique': 'unique',
        'most unique': 'unique',
        'more perfect': 'perfect',
        'most perfect': 'perfect',
        'irregardless': 'regardless',
        'could care less': "couldn't care less"
      }
      
      return redundantMap[match.toLowerCase()] || match
    }
  }
]

// Enhanced filtering and organization functions
export const getRulesByCategory = (category: string): GrammarRule[] => {
  return GRAMMAR_RULES.filter(rule => rule.category === category && rule.enabled)
}

export const getRulesByPriority = (minPriority: number = 0): GrammarRule[] => {
  return GRAMMAR_RULES
    .filter(rule => rule.priority >= minPriority && rule.enabled)
    .sort((a, b) => b.priority - a.priority)
}

export const getRulesByType = (type: string): GrammarRule[] => {
  return GRAMMAR_RULES.filter(rule => rule.type === type && rule.enabled)
}

export const getRulesByTag = (tag: string): GrammarRule[] => {
  return GRAMMAR_RULES.filter(rule => rule.tags?.includes(tag) && rule.enabled)
}

export const getRulesBySeverity = (severity: string): GrammarRule[] => {
  return GRAMMAR_RULES.filter(rule => rule.severity === severity && rule.enabled)
}

export const getActiveRules = (): GrammarRule[] => {
  return GRAMMAR_RULES.filter(rule => rule.enabled)
}

// Rule statistics and analysis
export const getRuleStatistics = () => {
  const total = GRAMMAR_RULES.length
  const enabled = GRAMMAR_RULES.filter(r => r.enabled).length
  
  const byCategory = GRAMMAR_RULES.reduce((acc, rule) => {
    acc[rule.category] = (acc[rule.category] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  const byType = GRAMMAR_RULES.reduce((acc, rule) => {
    acc[rule.type] = (acc[rule.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  const bySeverity = GRAMMAR_RULES.reduce((acc, rule) => {
    acc[rule.severity] = (acc[rule.severity] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  return {
    total,
    enabled,
    disabled: total - enabled,
    byCategory,
    byType,
    bySeverity,
    averagePriority: GRAMMAR_RULES.reduce((sum, rule) => sum + rule.priority, 0) / total
  }
} 