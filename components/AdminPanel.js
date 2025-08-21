import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

export default function AdminPanel() {
  const { data: session } = useSession()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session?.user?.isAdmin) {
      fetchUsers()
    }
  }, [session])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const getAdminUsers = () => {
    const hardcodedAdmins = ['daniel@wolthers.com']
    const envAdmins = process.env.ALLOWED_USERS?.split(',').map(email => email.trim().toLowerCase()) || []
    return [...hardcodedAdmins, ...envAdmins]
  }

  if (!session?.user?.isAdmin) {
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Admin Panel - User Access Control</h2>
      
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Admin Users (Can See All Email Data)</h3>
          <div className="bg-green-50 rounded-md p-3">
            <div className="space-y-1">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                <span className="text-sm text-green-800 font-medium">daniel@wolthers.com</span>
                <span className="ml-2 text-xs text-green-600">(hardcoded admin)</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                <span className="text-sm text-green-800 font-medium">rasmus@wolthers.com</span>
                <span className="ml-2 text-xs text-green-600">(hardcoded admin)</span>
              </div>
              {process.env.ALLOWED_USERS?.split(',').map(email => email.trim()).filter(email => email).map(email => (
                <div key={email} className="flex items-center">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                  <span className="text-sm text-green-800">{email}</span>
                  <span className="ml-2 text-xs text-green-600">(from environment)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Regular Users (See Only Their Own Data)</h3>
          <div className="bg-blue-50 rounded-md p-3">
            <p className="text-sm text-blue-800">
              All other authenticated Microsoft/Azure AD users will have regular access and can only see their own email data.
            </p>
            <div className="mt-2 text-xs text-blue-600">
              Examples: vinicius@company.com, other@domain.com, etc.
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Current Session</h3>
          <div className="bg-gray-50 rounded-md p-3">
            <div className="space-y-1 text-sm">
              <div><strong>User:</strong> {session.user.email}</div>
              <div><strong>Role:</strong> 
                <span className={`ml-1 px-2 py-1 rounded text-xs font-medium ${
                  session.user.isAdmin 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {session.user.role}
                </span>
              </div>
              <div><strong>Can Access All Data:</strong> {session.user.isAdmin ? 'Yes' : 'No'}</div>
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">How It Works</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <p>• <strong>Admin users</strong> see all email analytics data from all users</p>
            <p>• <strong>Regular users</strong> only see analytics for emails where they are sender/recipient</p>
            <p>• Authentication is open to all valid Microsoft/Azure AD accounts</p>
            <p>• Data filtering happens automatically based on user role</p>
          </div>
        </div>
      </div>
    </div>
  )
}