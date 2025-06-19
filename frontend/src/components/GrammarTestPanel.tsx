import React, { useState, useEffect } from 'react'
import { 
  testLanguageAPI, 
  checkGrammarAndSpelling, 
  getCacheStats, 
  clearAllCaches, 
  clearCacheByType,
  getPerformanceMetrics,
  resetPerformanceMetrics,
  performHealthCheck
} from '../services/languageService'

const GrammarTestPanel: React.FC = () => {
  const [testResult, setTestResult] = useState<any>(null)
  const [customText, setCustomText] = useState('')
  const [customResult, setCustomResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [cacheStats, setCacheStats] = useState<any>(null)
  const [performanceStats, setPerformanceStats] = useState<any>(null)
  const [healthStatus, setHealthStatus] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'test' | 'cache' | 'performance' | 'health'>('test')

  // Auto-refresh stats every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === 'cache') {
        setCacheStats(getCacheStats())
      } else if (activeTab === 'performance') {
        setPerformanceStats(getPerformanceMetrics())
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [activeTab])

  const runAPITest = async () => {
    setLoading(true)
    try {
      const result = await testLanguageAPI()
      setTestResult(result)
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setLoading(false)
    }
  }

  const testCustomText = async () => {
    if (!customText.trim()) return
    
    setLoading(true)
    try {
      const result = await checkGrammarAndSpelling(customText)
      const suggestions = result.suggestions
      setCustomResult({
        success: true,
        text: customText,
        suggestions,
        apiStatus: result.apiStatus,
        stats: {
          total: suggestions.length,
          grammar: suggestions.filter(s => s.type === 'grammar').length,
          spelling: suggestions.filter(s => s.type === 'spelling').length,
          style: suggestions.filter(s => s.type === 'style').length,
        }
      })
    } catch (error) {
      setCustomResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setLoading(false)
    }
  }

  const refreshCacheStats = () => {
    setCacheStats(getCacheStats())
  }

  const refreshPerformanceStats = () => {
    setPerformanceStats(getPerformanceMetrics())
  }

  const runHealthCheck = async () => {
    setLoading(true)
    try {
      const health = await performHealthCheck()
      setHealthStatus(health)
    } catch (error) {
      setHealthStatus({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setLoading(false)
    }
  }

  const sampleTexts = [
    "I has many errors in this sentence.",
    "She don't like when they goes there.",
    "The cat are running to the tree.",
    "Me and him is going to the store.",
    "There cat is very beautifull.",
    "This sentence have grammar mistake and spelling eror.",
    "Running to the store quickly.",
    "The book that I read yesterday was very interesting and I enjoyed it a lot."
  ]

  const TabButton: React.FC<{ tab: typeof activeTab, label: string }> = ({ tab, label }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`px-4 py-2 font-medium text-sm rounded-lg transition-colors ${
        activeTab === tab
          ? 'bg-blue-500 text-white'
          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Enhanced Grammar System Test Panel</h2>
        <div className="flex gap-2 mb-4">
          <TabButton tab="test" label="Testing" />
          <TabButton tab="cache" label="Cache Stats" />
          <TabButton tab="performance" label="Performance" />
          <TabButton tab="health" label="Health Check" />
        </div>
      </div>

      {activeTab === 'test' && (
        <div className="space-y-6">
          {/* API Test Section */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700">Backend API Test</h3>
              <button
                onClick={runAPITest}
                disabled={loading}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? 'Testing...' : 'Test API'}
              </button>
            </div>
            
            {testResult && (
              <div className="mt-4 p-4 bg-gray-50 rounded border">
                <pre className="text-sm overflow-x-auto">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Custom Text Test Section */}
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Custom Text Grammar Check</h3>
            
            <div className="mb-4">
              <h4 className="font-medium text-gray-600 mb-2">Sample texts (click to use):</h4>
              <div className="flex flex-wrap gap-2">
                {sampleTexts.map((sample, index) => (
                  <button
                    key={index}
                    onClick={() => setCustomText(sample)}
                    className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                  >
                    Sample {index + 1}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Enter text to check for grammar and spelling errors..."
                className="w-full h-32 p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              
              <button
                onClick={testCustomText}
                disabled={loading || !customText.trim()}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
              >
                {loading ? 'Checking...' : 'Check Grammar'}
              </button>
            </div>

            {customResult && (
              <div className="mt-4 p-4 bg-gray-50 rounded border">
                {customResult.success ? (
                  <div>
                    <div className="mb-3">
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                        customResult.apiStatus === 'api' ? 'bg-green-100 text-green-800' :
                        customResult.apiStatus === 'client-fallback' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        Source: {customResult.apiStatus === 'api' ? 'API' : 
                                customResult.apiStatus === 'client-fallback' ? 'Client Fallback' : 'Mixed'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4 mb-4 text-sm">
                      <div className="bg-white p-2 rounded border">
                        <div className="font-medium text-gray-600">Total Issues</div>
                        <div className="text-lg font-bold text-gray-800">{customResult.stats.total}</div>
                      </div>
                      <div className="bg-white p-2 rounded border">
                        <div className="font-medium text-red-600">Grammar</div>
                        <div className="text-lg font-bold text-red-700">{customResult.stats.grammar}</div>
                      </div>
                      <div className="bg-white p-2 rounded border">
                        <div className="font-medium text-orange-600">Spelling</div>
                        <div className="text-lg font-bold text-orange-700">{customResult.stats.spelling}</div>
                      </div>
                      <div className="bg-white p-2 rounded border">
                        <div className="font-medium text-blue-600">Style</div>
                        <div className="text-lg font-bold text-blue-700">{customResult.stats.style}</div>
                      </div>
                    </div>

                    {customResult.suggestions.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">Suggestions:</h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {customResult.suggestions.map((suggestion: any, index: number) => (
                            <div key={index} className="p-3 bg-white rounded border-l-4 border-l-red-400">
                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-xs font-medium px-2 py-1 rounded ${
                                  suggestion.type === 'grammar' ? 'bg-red-100 text-red-800' :
                                  suggestion.type === 'spelling' ? 'bg-orange-100 text-orange-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                  {suggestion.type}
                                </span>
                                <span className="text-xs text-gray-500">{suggestion.category}</span>
                              </div>
                              <div className="text-sm text-gray-700 mb-1">{suggestion.message}</div>
                              {suggestion.replacements.length > 0 && (
                                <div className="text-xs text-gray-600">
                                  Suggestions: {suggestion.replacements.join(', ')}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-red-600">
                    Error: {customResult.error}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'cache' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-700">Cache Statistics</h3>
            <div className="flex gap-2">
              <button
                onClick={refreshCacheStats}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Refresh
              </button>
              <button
                onClick={() => { clearAllCaches(); refreshCacheStats(); }}
                className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
              >
                Clear All
              </button>
            </div>
          </div>

          {cacheStats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(cacheStats).filter(([key]) => key !== 'rateLimiters').map(([cacheType, stats]: [string, any]) => (
                <div key={cacheType} className="bg-gray-50 p-4 rounded-lg border">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-700 capitalize">{cacheType} Cache</h4>
                    <button
                      onClick={() => { clearCacheByType(cacheType as any); refreshCacheStats(); }}
                      className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Size:</span>
                      <span className="font-medium">{stats.cacheSize}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Hit Rate:</span>
                      <span className="font-medium">{(stats.hitRate * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fuzzy Hit Rate:</span>
                      <span className="font-medium">{(stats.fuzzyHitRate * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Requests:</span>
                      <span className="font-medium">{stats.totalRequests}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cache Hits:</span>
                      <span className="font-medium text-green-600">{stats.hits}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fuzzy Hits:</span>
                      <span className="font-medium text-blue-600">{stats.fuzzyHits}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Misses:</span>
                      <span className="font-medium text-red-600">{stats.misses}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {cacheStats?.rateLimiters && (
            <div>
              <h4 className="font-medium text-gray-700 mb-3">Rate Limiters</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(cacheStats.rateLimiters).map(([limiterType, stats]: [string, any]) => (
                  <div key={limiterType} className="bg-gray-50 p-4 rounded-lg border">
                    <h5 className="font-medium text-gray-700 capitalize mb-2">{limiterType}</h5>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Failure Count:</span>
                        <span className="font-medium">{stats.failureCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Current Interval:</span>
                        <span className="font-medium">{stats.currentInterval}ms</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-700">Performance Metrics</h3>
            <div className="flex gap-2">
              <button
                onClick={refreshPerformanceStats}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Refresh
              </button>
              <button
                onClick={() => { resetPerformanceMetrics(); refreshPerformanceStats(); }}
                className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
              >
                Reset
              </button>
            </div>
          </div>

          {performanceStats && Object.keys(performanceStats).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(performanceStats).map(([operation, stats]: [string, any]) => (
                <div key={operation} className="bg-gray-50 p-4 rounded-lg border">
                  <h4 className="font-medium text-gray-700 mb-3">{operation}</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Calls:</span>
                      <span className="font-medium">{stats.calls}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Average Time:</span>
                      <span className="font-medium">{stats.averageTime.toFixed(0)}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Time:</span>
                      <span className="font-medium">{stats.totalTime.toFixed(0)}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Error Rate:</span>
                      <span className={`font-medium ${stats.errorRate > 0.1 ? 'text-red-600' : 'text-green-600'}`}>
                        {(stats.errorRate * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Errors:</span>
                      <span className="font-medium text-red-600">{stats.errors}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No performance data available. Run some tests to see metrics.
            </div>
          )}
        </div>
      )}

      {activeTab === 'health' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-700">System Health Check</h3>
            <button
              onClick={runHealthCheck}
              disabled={loading}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {loading ? 'Checking...' : 'Run Health Check'}
            </button>
          </div>

          {healthStatus && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-lg font-medium">Overall Status:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  healthStatus.status === 'healthy' ? 'bg-green-100 text-green-800' :
                  healthStatus.status === 'degraded' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {healthStatus.status}
                </span>
              </div>

              {healthStatus.services && (
                <div>
                  <h4 className="font-medium text-gray-700 mb-3">Services</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(healthStatus.services).map(([service, status]: [string, any]) => (
                      <div key={service} className="bg-gray-50 p-3 rounded-lg border">
                        <div className="flex items-center justify-between">
                          <span className="font-medium capitalize">{service}</span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            status === 'up' ? 'bg-green-100 text-green-800' :
                            status === 'slow' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {healthStatus.cache && (
                <div>
                  <h4 className="font-medium text-gray-700 mb-3">Cache Health</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(healthStatus.cache).map(([cacheType, stats]: [string, any]) => (
                      <div key={cacheType} className="bg-gray-50 p-3 rounded-lg border">
                        <h5 className="font-medium capitalize mb-2">{cacheType}</h5>
                        <div className="text-sm space-y-1">
                          <div>Size: {stats.size}</div>
                          <div>Hit Rate: {(stats.hitRate * 100).toFixed(1)}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default GrammarTestPanel 