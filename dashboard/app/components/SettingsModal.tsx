'use client'

import { useEffect } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import type { Locale } from '../i18n/translations'

interface HealthData {
  status: string
  ollama: string
  database: string
  diskUsage: string
  factCount: number
  entityCount: number
  mode: string
  profile: string
  dbSize: string
  timestamp: string
}

export default function SettingsModal({
  isOpen,
  onClose,
  health,
}: {
  isOpen: boolean
  onClose: () => void
  health: HealthData | null
}) {
  const { locale, setLocale, t } = useLocale()

  useEffect(() => {
    if (!isOpen) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-100">{t('settings.title')}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Language */}
        <div className="mb-6">
          <label className="text-sm font-medium text-gray-400 mb-2 block">
            {t('settings.language')}
          </label>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2.5 text-gray-100 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="en">English</option>
            <option value="ja">日本語</option>
          </select>
        </div>

        {/* System Info */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-3">{t('settings.systemInfo')}</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('settings.mode')}</span>
              <span className="text-gray-300">{health?.mode?.toUpperCase() || '-'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('settings.profile')}</span>
              <span className="text-gray-300">{health?.profile || '-'}</span>
            </div>
          </div>
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="w-full bg-gray-800 hover:bg-gray-700 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          {t('settings.close')}
        </button>
      </div>
    </div>
  )
}
