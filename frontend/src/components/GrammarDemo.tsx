import React, { useState } from 'react'
import GrammarTextEditor from './GrammarTextEditor'

const GrammarDemo: React.FC = () => {
  const [showDemo, setShowDemo] = useState(false)

  const demoText = `This is a example of text with several grammar and spelling errors. The quick brown fox jumps over the lazy dog, but it did not jumped correctly. There is also a missspelled word in this sentence. The writting could be more clear and more concise too.

Some sentences are way too long and should be broken down into smaller parts because they are difficult to read and understand when they go on and on without proper punctuation or structure which makes the text hard to follow.

Passive voice is used by many writers. The document was written by me. These sentences could be improved by using active voice instead.`

  if (!showDemo) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-lg p-6 border border-blue-200 dark:border-gray-600">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            🎯 Try WordWise Grammar Checking
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            See how our AI-powered grammar checker works with this interactive demo
          </p>
          <button
            onClick={() => setShowDemo(true)}
            className="btn btn-primary"
          >
            Start Demo
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
              🎯 Grammar Checking Demo
            </h3>
            <p className="text-blue-700 dark:text-blue-300 text-sm">
              The text below contains intentional errors. Try editing it to see real-time suggestions!
            </p>
          </div>
          <button
            onClick={() => setShowDemo(false)}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
          >
            ✕ Close Demo
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h4 className="font-medium text-gray-900 dark:text-white">Interactive Editor</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Edit the text below and see live grammar suggestions appear
          </p>
        </div>
        
        <div className="p-6">
          <GrammarTextEditor />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
            🔍 What WordWise Detects
          </h4>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex items-center space-x-2">
              <span className="w-3 h-3 bg-red-500 rounded-full flex-shrink-0"></span>
              <span><strong>Grammar errors:</strong> Subject-verb agreement, tense consistency</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="w-3 h-3 bg-orange-500 rounded-full flex-shrink-0"></span>
              <span><strong>Spelling mistakes:</strong> Typos and misspelled words</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0"></span>
              <span><strong>Style improvements:</strong> Passive voice, clarity, word choice</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></span>
              <span><strong>Readability:</strong> Sentence length, complexity analysis</span>
            </li>
          </ul>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
            ✨ Key Features
          </h4>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li>• <strong>Real-time checking:</strong> Suggestions appear as you type</li>
            <li>• <strong>Click to fix:</strong> Apply suggestions with one click</li>
            <li>• <strong>Context-aware:</strong> Understands meaning for better suggestions</li>
            <li>• <strong>Multiple languages:</strong> Support for various languages</li>
            <li>• <strong>Readability analysis:</strong> Flesch-Kincaid grade level scoring</li>
            <li>• <strong>Writing statistics:</strong> Word count, sentence analysis</li>
          </ul>
        </div>
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
          💡 Demo Tips
        </h4>
        <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
          <li>• Clear the editor and paste your own text to test</li>
          <li>• Click on highlighted errors to see suggestions</li>
          <li>• Notice how suggestions appear after you stop typing</li>
          <li>• Try intentionally making errors to see the checker in action</li>
        </ul>
      </div>
    </div>
  )
}

export default GrammarDemo 