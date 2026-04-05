import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import DashboardPage from '@/app/page'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      json: async () => ({ conversations: [], count: 0 }),
    })
  )
})

describe('DashboardPage', () => {
  it('renders the dashboard heading', () => {
    render(<DashboardPage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'SLM Dashboard'
    )
  })

  it('renders all four health status cards', () => {
    render(<DashboardPage />)
    expect(screen.getAllByText('Status').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Ollama').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Database').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Disk Usage').length).toBeGreaterThanOrEqual(1)
  })

  it('renders search input and button', () => {
    render(<DashboardPage />)
    const inputs = screen.getAllByPlaceholderText('Search conversations...')
    expect(inputs.length).toBeGreaterThanOrEqual(1)
    const buttons = screen.getAllByText('Search')
    expect(buttons.length).toBeGreaterThanOrEqual(1)
  })

  it('shows loading state initially', () => {
    render(<DashboardPage />)
    const loadingTexts = screen.getAllByText('loading...')
    expect(loadingTexts.length).toBeGreaterThanOrEqual(1)
  })
})
