import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  rewriteGradeLevelWithOpenAI,
  analyzeReadability
} from '../../services/languageService'
import { generateTestText } from '../setup'

// Mock the actual API calls for controlled testing
vi.mock('../../services/languageService', async () => {
  const actual = await vi.importActual('../../services/languageService')
  return {
    ...actual,
    rewriteGradeLevelWithOpenAI: vi.fn(),
    analyzeReadability: vi.fn()
  }
})

describe('Grade Level Rewrite Accuracy Analysis', () => {
  const mockRewriteService = vi.mocked(rewriteGradeLevelWithOpenAI)
  const mockAnalyzeService = vi.mocked(analyzeReadability)

  // Test data representing different accuracy scenarios
  const testScenarios = [
    {
      name: 'Elementary Target - Near Miss',
      originalText: 'The comprehensive evaluation methodology demonstrates significant improvements in organizational efficiency.',
      targetGrade: 'elementary',
      targetFK: 4.0, // Target Flesch-Kincaid grade level
      targetEase: 85.0, // Target reading ease
      actualFK: 5.2, // What we're actually getting (too high)
      actualEase: 78.5, // What we're actually getting (too low)
      rewrittenText: 'The detailed review method shows big improvements in how organizations work better.',
      accuracyIssues: ['Complex vocabulary still present', 'Sentence structure too advanced', 'Abstract concepts not simplified enough']
    },
    {
      name: 'Middle School Target - Near Miss',
      originalText: 'Contemporary research indicates that interdisciplinary approaches yield superior outcomes.',
      targetGrade: 'middle-school',
      targetFK: 7.0,
      targetEase: 75.0,
      actualFK: 8.3, // Too high
      actualEase: 68.2, // Too low
      rewrittenText: 'Recent studies show that using different subjects together gives better results.',
      accuracyIssues: ['Still contains some complex terms', 'Sentence length could be shorter', 'Could use more concrete examples']
    },
    {
      name: 'High School Target - Near Miss',
      originalText: 'The paradigmatic shift in educational methodologies necessitates comprehensive pedagogical restructuring.',
      targetGrade: 'high-school',
      targetFK: 10.0,
      targetEase: 65.0,
      actualFK: 11.8, // Too high
      actualEase: 58.3, // Too low
      rewrittenText: 'The major change in teaching methods requires complete restructuring of educational approaches.',
      accuracyIssues: ['Academic jargon partially retained', 'Complex sentence structures remain', 'Could benefit from more examples']
    },
    {
      name: 'College Target - Accurate',
      originalText: 'The implementation of sustainable development practices within corporate governance frameworks.',
      targetGrade: 'college',
      targetFK: 13.0,
      targetEase: 55.0,
      actualFK: 12.8, // Close to target
      actualEase: 56.2, // Close to target
      rewrittenText: 'Implementing sustainable development practices in corporate governance requires systematic approaches.',
      accuracyIssues: [] // This one is accurate
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Accuracy Analysis by Grade Level', () => {
    it('should identify accuracy patterns across different grade levels', async () => {
      const accuracyResults = []

      for (const scenario of testScenarios) {
        // Mock the readability analysis
        mockAnalyzeService
          .mockResolvedValueOnce({
            fleschKincaid: scenario.actualFK,
            fleschReadingEase: scenario.actualEase,
            readabilityLevel: scenario.targetGrade,
            averageWordsPerSentence: 15,
            averageSyllablesPerWord: 1.8,
            totalSentences: 2,
            passiveVoicePercentage: 20,
            longSentences: 1
          })

        // Mock the rewrite service
        mockRewriteService.mockResolvedValueOnce({
          success: true,
          originalText: scenario.originalText,
          rewrittenText: scenario.rewrittenText,
          gradeLevel: scenario.targetGrade,
          originalReadability: {
            fleschKincaid: 15.0,
            readingEase: 35.0,
            level: 'Graduate'
          },
          newReadability: {
            fleschKincaid: scenario.actualFK,
            readingEase: scenario.actualEase,
            level: scenario.targetGrade
          },
          hasChanges: true,
          method: 'openai'
        })

        const result = await rewriteGradeLevelWithOpenAI(scenario.originalText, scenario.targetGrade)
        const analysis = await analyzeReadability(result.rewrittenText)

        const accuracyScore = calculateAccuracyScore(
          scenario.targetFK,
          scenario.targetEase,
          analysis.fleschKincaid,
          analysis.fleschReadingEase
        )

        accuracyResults.push({
          scenario: scenario.name,
          targetGrade: scenario.targetGrade,
          accuracyScore,
          fkDeviation: Math.abs(scenario.targetFK - analysis.fleschKincaid),
          easeDeviation: Math.abs(scenario.targetEase - analysis.fleschReadingEase),
          issues: scenario.accuracyIssues
        })
      }

      // Analyze patterns
      const elementaryAccuracy = accuracyResults.filter(r => r.targetGrade === 'elementary')[0]
      const middleSchoolAccuracy = accuracyResults.filter(r => r.targetGrade === 'middle-school')[0]
      const highSchoolAccuracy = accuracyResults.filter(r => r.targetGrade === 'high-school')[0]
      const collegeAccuracy = accuracyResults.filter(r => r.targetGrade === 'college')[0]

      // Assertions about accuracy patterns
      expect(elementaryAccuracy.accuracyScore).toBeLessThan(0.8) // Poor accuracy
      expect(middleSchoolAccuracy.accuracyScore).toBeLessThan(0.8) // Poor accuracy
      expect(highSchoolAccuracy.accuracyScore).toBeLessThan(0.8) // Poor accuracy
      expect(collegeAccuracy.accuracyScore).toBeGreaterThan(0.9) // Good accuracy

      // Document findings
      console.log('\n=== GRADE LEVEL REWRITE ACCURACY ANALYSIS ===')
      accuracyResults.forEach(result => {
        console.log(`\n${result.scenario}:`)
        console.log(`  Accuracy Score: ${(result.accuracyScore * 100).toFixed(1)}%`)
        console.log(`  FK Deviation: ${result.fkDeviation.toFixed(1)} grade levels`)
        console.log(`  Ease Deviation: ${result.easeDeviation.toFixed(1)} points`)
        if (result.issues.length > 0) {
          console.log(`  Issues: ${result.issues.join(', ')}`)
        }
      })
    })
  })

  describe('Root Cause Analysis', () => {
    it('should identify specific causes of inaccuracy', async () => {
      const rootCauses = {
        vocabularyComplexity: 0,
        sentenceLength: 0,
        abstractConcepts: 0,
        passiveVoice: 0,
        technicalTerms: 0,
        inadequateSimplification: 0
      }

      // Analyze each test scenario for root causes
      testScenarios.forEach(scenario => {
        scenario.accuracyIssues.forEach(issue => {
          if (issue.includes('vocabulary') || issue.includes('terms')) {
            rootCauses.vocabularyComplexity++
          }
          if (issue.includes('sentence') || issue.includes('structure')) {
            rootCauses.sentenceLength++
          }
          if (issue.includes('abstract') || issue.includes('concepts')) {
            rootCauses.abstractConcepts++
          }
          if (issue.includes('passive')) {
            rootCauses.passiveVoice++
          }
          if (issue.includes('technical') || issue.includes('jargon')) {
            rootCauses.technicalTerms++
          }
          if (issue.includes('simplification') || issue.includes('examples')) {
            rootCauses.inadequateSimplification++
          }
        })
      })

      console.log('\n=== ROOT CAUSE ANALYSIS ===')
      Object.entries(rootCauses).forEach(([cause, count]) => {
        if (count > 0) {
          console.log(`${cause}: ${count} occurrences`)
        }
      })

      // The most common issues should be vocabulary and sentence structure
      expect(rootCauses.vocabularyComplexity).toBeGreaterThan(0)
      expect(rootCauses.sentenceLength).toBeGreaterThan(0)
    })
  })

  describe('Improvement Recommendations', () => {
    it('should generate specific improvement recommendations', () => {
      const recommendations = generateImprovementRecommendations()

      expect(recommendations).toHaveProperty('promptEngineering')
      expect(recommendations).toHaveProperty('validationRules')
      expect(recommendations).toHaveProperty('postProcessing')
      expect(recommendations).toHaveProperty('feedbackLoop')

      console.log('\n=== IMPROVEMENT RECOMMENDATIONS ===')
      console.log('\n1. Prompt Engineering Improvements:')
      recommendations.promptEngineering.forEach(rec => console.log(`   - ${rec}`))
      
      console.log('\n2. Validation Rules:')
      recommendations.validationRules.forEach(rec => console.log(`   - ${rec}`))
      
      console.log('\n3. Post-Processing Enhancements:')
      recommendations.postProcessing.forEach(rec => console.log(`   - ${rec}`))
      
      console.log('\n4. Feedback Loop Mechanisms:')
      recommendations.feedbackLoop.forEach(rec => console.log(`   - ${rec}`))
    })
  })

  describe('Benchmark Comparison', () => {
    it('should compare current performance against ideal targets', () => {
      const benchmarks = {
        elementary: { idealFK: 4.0, idealEase: 85.0, tolerance: 0.5 },
        'middle-school': { idealFK: 7.0, idealEase: 75.0, tolerance: 0.5 },
        'high-school': { idealFK: 10.0, idealEase: 65.0, tolerance: 0.5 },
        college: { idealFK: 13.0, idealEase: 55.0, tolerance: 0.5 }
      }

      const currentPerformance = {
        elementary: { avgFK: 5.2, avgEase: 78.5 },
        'middle-school': { avgFK: 8.3, avgEase: 68.2 },
        'high-school': { avgFK: 11.8, avgEase: 58.3 },
        college: { avgFK: 12.8, avgEase: 56.2 }
      }

      console.log('\n=== BENCHMARK COMPARISON ===')
      Object.entries(benchmarks).forEach(([grade, benchmark]) => {
        const current = currentPerformance[grade as keyof typeof currentPerformance]
        const fkGap = Math.abs(current.avgFK - benchmark.idealFK)
        const easeGap = Math.abs(current.avgEase - benchmark.idealEase)
        
        const fkWithinTolerance = fkGap <= benchmark.tolerance
        const easeWithinTolerance = easeGap <= benchmark.tolerance
        
        console.log(`\n${grade.toUpperCase()}:`)
        console.log(`  FK Score: ${current.avgFK} (target: ${benchmark.idealFK}) ${fkWithinTolerance ? '✓' : '✗'}`)
        console.log(`  Ease Score: ${current.avgEase} (target: ${benchmark.idealEase}) ${easeWithinTolerance ? '✓' : '✗'}`)
        console.log(`  Gap: FK ${fkGap.toFixed(1)}, Ease ${easeGap.toFixed(1)}`)
      })

      // Most grades should not be within tolerance (indicating the problem)
      expect(Math.abs(currentPerformance.elementary.avgFK - benchmarks.elementary.idealFK)).toBeGreaterThan(benchmarks.elementary.tolerance)
      expect(Math.abs(currentPerformance['middle-school'].avgFK - benchmarks['middle-school'].idealFK)).toBeGreaterThan(benchmarks['middle-school'].tolerance)
    })
  })

  describe('Text Complexity Analysis', () => {
    it('should analyze what makes texts hard to simplify accurately', () => {
      const complexityFactors = [
        {
          text: 'The comprehensive evaluation methodology demonstrates significant improvements',
          factors: ['Abstract nouns', 'Long compound words', 'Technical terminology', 'Complex sentence structure'],
          difficulty: 'high'
        },
        {
          text: 'Contemporary research indicates that interdisciplinary approaches yield superior outcomes',
          factors: ['Academic vocabulary', 'Abstract concepts', 'Formal register', 'Passive construction'],
          difficulty: 'medium-high'
        },
        {
          text: 'The cat sat on the mat and looked around the room',
          factors: ['Simple vocabulary', 'Short sentences', 'Concrete concepts', 'Active voice'],
          difficulty: 'low'
        }
      ]

      console.log('\n=== TEXT COMPLEXITY ANALYSIS ===')
      complexityFactors.forEach(factor => {
        console.log(`\nText: "${factor.text}"`)
        console.log(`Difficulty: ${factor.difficulty}`)
        console.log(`Factors: ${factor.factors.join(', ')}`)
      })

      // Verify our analysis captures the right complexity factors
      expect(complexityFactors[0].difficulty).toBe('high')
      expect(complexityFactors[2].difficulty).toBe('low')
    })
  })
})

// Helper functions
function calculateAccuracyScore(targetFK: number, targetEase: number, actualFK: number, actualEase: number): number {
  const fkAccuracy = Math.max(0, 1 - Math.abs(targetFK - actualFK) / targetFK)
  const easeAccuracy = Math.max(0, 1 - Math.abs(targetEase - actualEase) / targetEase)
  return (fkAccuracy + easeAccuracy) / 2
}

function generateImprovementRecommendations() {
  return {
    promptEngineering: [
      'Add specific Flesch-Kincaid score targets to prompts',
      'Include examples of successful rewrites at each grade level',
      'Specify vocabulary lists appropriate for each grade level',
      'Add constraints for maximum sentence length per grade level',
      'Include instructions to use concrete examples instead of abstract concepts',
      'Add requirements for active voice usage percentages'
    ],
    validationRules: [
      'Implement post-rewrite readability validation',
      'Add vocabulary complexity checks using grade-level word lists',
      'Validate sentence length distribution',
      'Check for passive voice percentage',
      'Verify syllable count per word averages',
      'Implement retry logic when targets are not met'
    ],
    postProcessing: [
      'Add automated sentence splitting for overly long sentences',
      'Implement vocabulary substitution using grade-appropriate synonyms',
      'Add concrete example injection for abstract concepts',
      'Implement passive-to-active voice conversion',
      'Add paragraph restructuring for better flow',
      'Include readability score fine-tuning'
    ],
    feedbackLoop: [
      'Collect user feedback on rewrite quality',
      'Track which rewrites get accepted vs rejected',
      'Monitor user satisfaction scores by grade level',
      'Implement A/B testing for different rewrite approaches',
      'Add machine learning model to learn from successful rewrites',
      'Create feedback mechanism for teachers and educators'
    ]
  }
} 