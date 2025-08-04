// __tests__/create-escrow.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import CreateEscrow from '@/app/create-escrow/page'
import { supabase } from '@/lib/supabase'

jest.mock('next/navigation')
jest.mock('@/lib/supabase')

describe('CreateEscrow', () => {
  const mockPush = jest.fn()
  
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush })
    ;(supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'test-user', email: 'test@example.com' } }
    })
  })

  it('renders create escrow form', async () => {
    render(<CreateEscrow />)
    
    await waitFor(() => {
      expect(screen.getByText('Create New Escrow')).toBeInTheDocument()
      expect(screen.getByPlaceholderText("Enter the seller's email")).toBeInTheDocument()
    })
  })

  it('handles form submission', async () => {
    // @ts-ignore
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'new-escrow-id' })
    })

    render(<CreateEscrow />)
    
    await waitFor(() => {
      fireEvent.change(screen.getByPlaceholderText("Enter the seller's email"), {
        target: { value: 'seller@example.com' }
      })
      fireEvent.change(screen.getByPlaceholderText('0.00'), {
        target: { value: '100' }
      })
      fireEvent.click(screen.getByText('Create Middleman Ticket'))
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/escrow/new-escrow-id')
    })
  })
})