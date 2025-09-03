"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

interface Profile {
  id: string
  username: string | null
  email: string | null
  created_at: string
}

export default function DebugPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [localStorageData, setLocalStorageData] = useState<{
    pendingUsername: string
    pendingEmail: string
    refCode: string
  }>({ pendingUsername: '', pendingEmail: '', refCode: '' })

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        console.log('DebugPage: Fetching profiles...')
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, email, created_at')
          .order('created_at', { ascending: false })
          .limit(20)

        if (error) {
          console.error('DebugPage: Error fetching profiles:', error)
          setError(error.message)
        } else {
          console.log('DebugPage: Profiles fetched:', data)
          setProfiles(data || [])
        }
      } catch (err) {
        console.error('DebugPage: Exception fetching profiles:', err)
        setError('Failed to fetch profiles')
      } finally {
        setLoading(false)
      }
    }

    const checkLocalStorage = () => {
      try {
        const pendingUsername = localStorage.getItem('medius_pending_username') || ''
        const pendingEmail = localStorage.getItem('medius_pending_email') || ''
        const refCode = localStorage.getItem('medius_ref_code') || ''
        setLocalStorageData({ pendingUsername, pendingEmail, refCode })
        console.log('DebugPage: localStorage data:', { pendingUsername, pendingEmail, refCode })
      } catch (e) {
        console.warn('DebugPage: Error reading localStorage:', e)
      }
    }

    fetchProfiles()
    checkLocalStorage()
  }, [])

  const clearLocalStorage = () => {
    try {
      localStorage.removeItem('medius_pending_username')
      localStorage.removeItem('medius_pending_email')
      localStorage.removeItem('medius_ref_code')
      setLocalStorageData({ pendingUsername: '', pendingEmail: '', refCode: '' })
      console.log('DebugPage: Cleared localStorage')
    } catch (e) {
      console.warn('DebugPage: Error clearing localStorage:', e)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <h1 className="text-2xl font-bold mb-6">Debug - Authentication Data</h1>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-2xl font-bold mb-6">Debug - Authentication Data</h1>

      <div className="space-y-8">
        {/* localStorage Data */}
        <div className="bg-gray-900 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">localStorage Data</h2>
          <div className="space-y-2">
            <p><strong>Pending Username:</strong> "{localStorageData.pendingUsername}"</p>
            <p><strong>Pending Email:</strong> "{localStorageData.pendingEmail}"</p>
            <p><strong>Referral Code:</strong> "{localStorageData.refCode}"</p>
          </div>
          <button
            onClick={clearLocalStorage}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Clear localStorage
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Error</h2>
            <p>{error}</p>
          </div>
        )}

        {/* Profiles Data */}
        <div className="bg-gray-900 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Recent Profiles (Last 20)</h2>
          <div className="space-y-2">
            {profiles.map((profile) => (
              <div key={profile.id} className="bg-gray-800 p-4 rounded border-l-4 border-orange-500">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <strong>ID:</strong><br />
                    <span className="text-sm text-gray-300">{profile.id}</span>
                  </div>
                  <div>
                    <strong>Username:</strong><br />
                    <span className="text-sm text-green-400">"{profile.username || 'NULL'}"</span>
                  </div>
                  <div>
                    <strong>Email:</strong><br />
                    <span className="text-sm text-blue-400">"{profile.email || 'NULL'}"</span>
                  </div>
                  <div>
                    <strong>Created:</strong><br />
                    <span className="text-sm text-gray-300">
                      {new Date(profile.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {profiles.length === 0 && (
            <p className="text-gray-400">No profiles found</p>
          )}
        </div>

        {/* Issues to Check */}
        <div className="bg-yellow-900 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Potential Issues to Check</h2>
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li>Look for profiles where username looks like an email (contains @)</li>
            <li>Look for profiles where email looks like a username (no @, short)</li>
            <li>Check if pending localStorage data matches what you expect</li>
            <li>Verify that usernames are lowercase and trimmed</li>
          </ul>
        </div>

        {/* Console Logging Reminder */}
        <div className="bg-blue-900 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Debugging Tips</h2>
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li>Open browser console to see detailed logging from auth flows</li>
            <li>Look for "ensureUsernameForSession", "handleEmailSubmit", and "AuthCallback" logs</li>
            <li>Check network tab for API calls to understand data flow</li>
            <li>Test sign-up, sign-in, and OAuth flows while monitoring logs</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
