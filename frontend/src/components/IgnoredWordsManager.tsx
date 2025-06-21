import React, { useState, useEffect } from 'react'
import { ignoredWordsService, IgnoredWord } from '../services/ignoredWordsService'
import toast from 'react-hot-toast'

interface IgnoredWordsManagerProps {
  isOpen: boolean
  onClose: () => void
}

export const IgnoredWordsManager: React.FC<IgnoredWordsManagerProps> = ({ isOpen, onClose }) => {
  const [ignoredWords, setIgnoredWords] = useState<IgnoredWord[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Load ignored words when modal opens
  useEffect(() => {
    if (isOpen) {
      loadIgnoredWords()
    }
  }, [isOpen])

  const loadIgnoredWords = async () => {
    setLoading(true)
    try {
      const words = await ignoredWordsService.loadIgnoredWords()
      setIgnoredWords(words)
    } catch (error) {
      console.error('Failed to load ignored words:', error)
      toast.error('Failed to load ignored words')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveWord = async (wordId: string, word: string) => {
    const confirmed = window.confirm(`Remove "${word}" from ignored words? It will be marked as misspelled again.`)
    if (!confirmed) return

    const success = await ignoredWordsService.removeIgnoredWord(wordId)
    if (success) {
      toast.success(`"${word}" removed from ignored words`)
      // Reload the list
      loadIgnoredWords()
    } else {
      toast.error('Failed to remove word')
    }
  }

  const handleClearAll = async () => {
    const confirmed = window.confirm('Remove all ignored words? They will all be marked as misspelled again.')
    if (!confirmed) return

    const success = await ignoredWordsService.clearAllIgnoredWords()
    if (success) {
      toast.success('All ignored words cleared')
      setIgnoredWords([])
    } else {
      toast.error('Failed to clear ignored words')
    }
  }

  const filteredWords = ignoredWords.filter(word =>
    word.word.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Ignored Words ({ignoredWords.length})
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <input
            type="text"
            placeholder="Search ignored words..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>

        {ignoredWords.length > 0 && (
          <div className="mb-4 flex justify-end">
            <button
              onClick={handleClearAll}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors"
            >
              Clear All
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : filteredWords.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              {searchTerm ? 'No words match your search' : 'No ignored words yet'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredWords.map((word) => (
                <div
                  key={word.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {word.word}
                      </span>
                      {word.is_proper_noun && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                          Proper Noun
                        </span>
                      )}
                      {word.document_type && (
                        <span className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">
                          {word.document_type}
                        </span>
                      )}
                    </div>
                    {word.context && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                        Context: {word.context}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Added: {new Date(word.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveWord(word.id, word.word)}
                    className="ml-4 px-3 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-800 dark:text-red-200 rounded transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 