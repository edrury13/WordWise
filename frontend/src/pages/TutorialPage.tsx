import React from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, ArrowRight, Check } from 'lucide-react'
import Navigation from '../components/Navigation'

const TutorialPage: React.FC = () => {
  const navigate = useNavigate()

  const tutorialSteps = [
    {
      title: 'Creating Documents',
      description: 'Learn how to create and manage your documents',
      icon: '📄',
    },
    {
      title: 'Grammar Checking',
      description: 'Understand how real-time grammar checking works',
      icon: '✏️',
    },
    {
      title: 'Style Profiles',
      description: 'Switch between different writing styles',
      icon: '🎨',
    },
    {
      title: 'Smart Corrections',
      description: 'See how AI learns from your writing patterns',
      icon: '🤖',
    },
    {
      title: 'Writing Insights',
      description: 'Track your progress and improvement',
      icon: '📊',
    },
  ]

  return (
    <div className="min-h-screen bg-cream dark:bg-gray-900">
      <Navigation />
      
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <BookOpen className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Welcome to WordWise Tutorial
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Let's walk through the key features that will help you write better.
          </p>
        </div>

        <div className="space-y-6 mb-12">
          {tutorialSteps.map((step, index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border-l-4 border-primary-600"
            >
              <div className="flex items-start gap-4">
                <div className="text-3xl">{step.icon}</div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {step.description}
                  </p>
                </div>
                <Check className="h-5 w-5 text-green-500" />
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Ready to start writing? Create your first document now.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn btn-primary btn-lg flex items-center justify-center mx-auto"
          >
            Go to Dashboard
            <ArrowRight className="ml-2 h-5 w-5" />
          </button>
        </div>
      </main>
    </div>
  )
}

export default TutorialPage 