import { useState } from 'react'
import { useSession } from 'next-auth/react'

export default function AdminModal({ isOpen, onClose }) {
  const { data: session } = useSession()

  if (!isOpen || !session?.user?.isAdmin) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" 
          onClick={onClose}
        ></div>

        {/* Modal */}
        <div className="inline-block w-full max-w-2xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Admin Panel - User Access Control</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 focus:outline-none"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Admin Users (Can See All Email Data)</h3>
              <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3">
                <div className="space-y-2">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full mr-3"></div>
                    <span className="text-sm text-emerald-800 font-medium">daniel@wolthers.com</span>
                    <span className="ml-2 text-xs text-emerald-600 bg-emerald-100 px-2 py-1 rounded">hardcoded admin</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full mr-3"></div>
                    <span className="text-sm text-emerald-800 font-medium">rasmus@wolthers.com</span>
                    <span className="ml-2 text-xs text-emerald-600 bg-emerald-100 px-2 py-1 rounded">hardcoded admin</span>
                  </div>
                  {process.env.ALLOWED_USERS?.split(',').map(email => email.trim()).filter(email => email).map(email => (
                    <div key={email} className="flex items-center">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full mr-3"></div>
                      <span className="text-sm text-emerald-800">{email}</span>
                      <span className="ml-2 text-xs text-emerald-600 bg-emerald-100 px-2 py-1 rounded">from environment</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Regular Users (See Only Their Own Data)</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
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
              <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                <div className="space-y-2 text-sm">
                  <div><strong>User:</strong> {session.user.email}</div>
                  <div><strong>Role:</strong> 
                    <span className={`ml-2 px-3 py-1 rounded-full text-xs font-medium ${
                      session.user.isAdmin 
                        ? 'bg-emerald-100 text-emerald-800' 
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
      </div>
    </div>
  )
}