import React from 'react'
import { Link } from 'react-router-dom'
import GrammarDemo from '../components/GrammarDemo'

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
            WordWise
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
            Intelligent writing assistant with real-time grammar checking, style suggestions, 
            and readability analysis. Write better, faster, and with confidence.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="btn btn-primary px-8 py-3 text-lg"
            >
              Get Started Free
            </Link>
            <Link
              to="/login"
              className="btn btn-secondary px-8 py-3 text-lg"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Interactive Demo Section */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Try It Now - No Sign Up Required
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Experience WordWise's powerful grammar checking in action
            </p>
          </div>
          <div className="max-w-4xl mx-auto">
            <GrammarDemo />
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
            <div className="text-3xl mb-4">✍️</div>
            <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
              Real-time Grammar Check
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Advanced AI-powered grammar and spell checking as you type, 
              with contextual suggestions for improvement.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
            <div className="text-3xl mb-4">📊</div>
            <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
              Readability Analysis
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Get insights into your writing with Flesch-Kincaid scoring, 
              sentence complexity analysis, and style recommendations.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
            <div className="text-3xl mb-4">☁️</div>
            <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
              Cloud Sync
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Your documents are automatically saved and synced across 
              all your devices with secure cloud storage.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
            <div className="text-3xl mb-4">🎯</div>
            <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
              Style Suggestions
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Improve clarity, engagement, and tone with intelligent 
              style recommendations tailored to your writing.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
            <div className="text-3xl mb-4">🌙</div>
            <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
              Dark Mode Support
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Write comfortably in any lighting condition with beautiful 
              dark and light themes.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
            <div className="text-3xl mb-4">🔒</div>
            <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
              Secure & Private
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Your documents are encrypted and private. We never share 
              your content with third parties.
            </p>
          </div>
        </div>

        <div className="text-center bg-white dark:bg-gray-800 rounded-lg p-8 shadow-sm">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Ready to Improve Your Writing?
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-6 max-w-2xl mx-auto">
            Join thousands of writers, students, and professionals who use WordWise 
            to write with confidence and clarity.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="btn btn-primary px-8 py-3 text-lg"
            >
              Start Writing for Free
            </Link>
            <Link
              to="/login"
              className="btn btn-ghost px-8 py-3 text-lg"
            >
              Already have an account?
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LandingPage 