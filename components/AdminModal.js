import { useState } from 'react'
import { useSession } from 'next-auth/react'

export default function AdminModal({ isOpen, onClose }) {
  const { data: session } = useSession()

  if (!isOpen || !session?.user?.isAdmin) return null

  const envAdmins = process.env.ALLOWED_USERS
    ? process.env.ALLOWED_USERS.split(',').map(email => email.trim()).filter(email => email)
    : []

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" 
          onClick={onClose}
        ></div>

        {/* Modal */}
        <div className="inline-block w-full max-w-2xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg border border-emerald-100">
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-emerald-100">
            <h2 className="text-xl font-semibold text-gray-800">Admin Panel - User Access Control</h2>
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
              <h3 className="text-sm font-medium text-gray-700 mb-3">Admin Users (Can See All Email Data)</h3>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="space-y-3">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-emerald-600 rounded-full mr-3"></div>
                    <span className="text-sm text-gray-800 font-medium">daniel@wolthers.com</span>
                    <span className="ml-2 text-xs text-gray-600 bg-white px-2 py-1 rounded border">hardcoded admin</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-emerald-600 rounded-full mr-3"></div>
                    <span className="text-sm text-gray-800 font-medium">rasmus@wolthers.com</span>
                    <span className="ml-2 text-xs text-gray-600 bg-white px-2 py-1 rounded border">hardcoded admin</span>
                  </div>
                  {envAdmins.map(email => (
                    <div key={email} className="flex items-center">
                      <div className="w-2 h-2 bg-emerald-600 rounded-full mr-3"></div>
                      <span className="text-sm text-gray-800">{email}</span>
                      <span className="ml-2 text-xs text-gray-600 bg-white px-2 py-1 rounded border">from environment</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Regular Users (See Only Their Own Data)</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-gray-800">
                  All other authenticated Microsoft/Azure AD users will have regular access and can only see their own email data.
                </p>
                <div className="mt-2 text-xs text-gray-600">
                  Examples: vinicius@company.com, other@domain.com, etc.
                </div>
              </div>
            </div>

            <div className="border-t border-emerald-100 pt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Current Session</h3>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="space-y-3 text-sm">
                  <div className="text-gray-800"><strong>User:</strong> {session.user.email}</div>
                  <div className="text-gray-800"><strong>Role:</strong> 
                    <span className={`ml-2 px-3 py-1 rounded-full text-xs font-medium ${
                      session.user.isAdmin 
                        ? 'bg-emerald-100 text-gray-800 border border-emerald-200' 
                        : 'bg-blue-100 text-gray-800 border border-blue-200'
                    }`}>
                      {session.user.role}
                    </span>
                  </div>
                  <div className="text-gray-800"><strong>Can Access All Data:</strong> {session.user.isAdmin ? 'Yes' : 'No'}</div>
                </div>
              </div>
            </div>

            <div className="border-t border-emerald-100 pt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">How It Works</h3>
              <div className="text-sm text-gray-700 space-y-2 bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p>• <strong className="text-gray-800">Admin users</strong> see all email analytics data from all users</p>
                <p>• <strong className="text-gray-800">Regular users</strong> only see analytics for emails where they are sender/recipient</p>
                <p>• <strong className="text-gray-800">Authentication</strong> is open to all valid Microsoft/Azure AD accounts</p>
                <p>• <strong className="text-gray-800">Data filtering</strong> happens automatically based on user role</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}