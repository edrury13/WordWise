import React from 'react'
import { Link } from 'react-router-dom'
import GrammarDemo from '../components/GrammarDemo'

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-cream dark:from-gray-900 dark:to-gray-800">
      {/* Academic Header */}
      <header className="bg-white border-b-4 border-navy shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-navy rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xl academic-serif">W</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold academic-serif text-navy">WordWise</h1>
                <p className="text-sm text-academic-gray academic-sans">Advanced Academic Writing Assistant</p>
              </div>
            </div>
            <nav className="hidden md:flex space-x-6">
              <Link to="/login" className="text-navy hover:text-burgundy transition-colors academic-sans font-medium">Sign In</Link>
              <Link to="/register" className="btn btn-primary px-6 py-2">Get Started</Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-16">
        {/* Hero Section - Academic Style */}
        <div className="text-center mb-20">
          <h1 className="text-6xl font-bold academic-serif text-navy mb-6 leading-tight">
            WordWise
          </h1>
          <h2 className="text-2xl academic-serif text-burgundy mb-8 font-semibold">
            Advanced Academic Writing Assistant
          </h2>
          <p className="text-xl text-academic-gray mb-12 max-w-4xl mx-auto academic-sans leading-relaxed">
            Enhance scholarly communication with AI-powered grammar analysis, style refinement, 
            and readability assessment. Designed for researchers, academics, and professional writers 
            who demand precision in their written work.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link
              to="/register"
              className="btn btn-primary px-10 py-4 text-lg academic-sans font-semibold"
            >
              Begin Research Writing
            </Link>
            <Link
              to="/login"
              className="btn btn-secondary px-10 py-4 text-lg academic-sans font-semibold"
            >
              Access Your Library
            </Link>
          </div>
        </div>

        {/* Interactive Demo Section - Academic Style */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold academic-serif text-navy mb-6">
              Try Our Academic Writing Analysis Tool
            </h2>
            <p className="text-lg text-academic-gray academic-sans max-w-3xl mx-auto">
              Experience WordWise's research-grade grammar analysis and scholarly writing enhancement 
              without creating an account. Test with your own academic text.
            </p>
          </div>
          <div className="max-w-5xl mx-auto bg-white rounded-lg shadow-lg border border-gray-200 p-8">
            <GrammarDemo />
          </div>
        </div>

        {/* Research-Backed Benefits Section */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold academic-serif text-navy mb-4">
              Research-Backed Writing Enhancement
            </h2>
            <p className="text-lg text-academic-gray academic-sans max-w-3xl mx-auto">
              Our tools are grounded in linguistic research and academic writing best practices
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-lg shadow-md border-l-4 border-navy hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-navy rounded-lg flex items-center justify-center mb-4">
                <span className="text-white text-xl">📝</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 academic-serif text-navy">
                Advanced Grammar Analysis
              </h3>
              <p className="text-academic-gray academic-sans leading-relaxed">
                Sophisticated linguistic analysis powered by computational linguistics research, 
                identifying complex grammatical structures and academic writing conventions.
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-md border-l-4 border-burgundy hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-burgundy rounded-lg flex items-center justify-center mb-4">
                <span className="text-white text-xl">📊</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 academic-serif text-navy">
                Scholarly Readability Metrics
              </h3>
              <p className="text-academic-gray academic-sans leading-relaxed">
                Comprehensive readability assessment using Flesch-Kincaid analysis, 
                sentence complexity evaluation, and academic discourse patterns.
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-md border-l-4 border-gold hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-gold rounded-lg flex items-center justify-center mb-4">
                <span className="text-white text-xl">🎓</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 academic-serif text-navy">
                Academic Tone Detection
              </h3>
              <p className="text-academic-gray academic-sans leading-relaxed">
                Intelligent analysis of academic register, formality levels, 
                and disciplinary writing conventions for scholarly communication.
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-md border-l-4 border-navy hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-navy rounded-lg flex items-center justify-center mb-4">
                <span className="text-white text-xl">📚</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 academic-serif text-navy">
                Research Document Library
              </h3>
              <p className="text-academic-gray academic-sans leading-relaxed">
                Secure cloud storage with version control, collaborative features, 
                and institutional-grade data protection for your research documents.
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-md border-l-4 border-burgundy hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-burgundy rounded-lg flex items-center justify-center mb-4">
                <span className="text-white text-xl">🔬</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 academic-serif text-navy">
                Style Guide Compliance
              </h3>
              <p className="text-academic-gray academic-sans leading-relaxed">
                Automated checking for major academic style guides including APA, MLA, 
                Chicago, and institutional formatting requirements.
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-md border-l-4 border-gold hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-gold rounded-lg flex items-center justify-center mb-4">
                <span className="text-white text-xl">🔒</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 academic-serif text-navy">
                Research Data Security
              </h3>
              <p className="text-academic-gray academic-sans leading-relaxed">
                Enterprise-level encryption and privacy protection designed for 
                sensitive academic research and institutional compliance requirements.
              </p>
            </div>
          </div>
        </div>

        {/* Call to Action - Academic Style */}
        <div className="text-center bg-white rounded-lg p-12 shadow-lg border-t-4 border-navy">
          <h2 className="text-4xl font-bold academic-serif text-navy mb-6">
            Advance Your Academic Writing
          </h2>
          <p className="text-xl text-academic-gray academic-sans mb-8 max-w-3xl mx-auto leading-relaxed">
            Join researchers, faculty, and graduate students from leading institutions 
            who trust WordWise for precision in their scholarly communication and research documentation.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link
              to="/register"
              className="btn btn-primary px-12 py-4 text-lg academic-sans font-semibold"
            >
              Begin Your Research Journey
            </Link>
            <Link
              to="/login"
              className="btn btn-secondary px-12 py-4 text-lg academic-sans font-semibold"
            >
              Return to Your Library
            </Link>
          </div>
          
          {/* Academic Footer */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-sm text-academic-gray academic-sans">
              Trusted by academic institutions • Research-grade security • Scholarly writing standards
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LandingPage 