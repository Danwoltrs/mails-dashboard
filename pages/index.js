import { useSession, signIn } from 'next-auth/react'
import { useState } from 'react'
import Head from 'next/head'
import EmailAnalyticsShell from '../components/EmailAnalyticsShell'
import AdminModal from '../components/AdminModal'

export default function Dashboard() {
  const { data: session, status } = useSession()
  const [showAdminModal, setShowAdminModal] = useState(false)

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-600">Loading…</div>
      </div>
    )
  }

  if (!session) {
    return (
      <>
        <Head>
          <title>Email Analytics — Sign In</title>
          <meta name="description" content="Email Analytics Dashboard for Wolthers & Associates" />
        </Head>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-emerald-100">
          <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 border border-emerald-200">
            <div className="text-center mb-8">
              <div className="mb-6">
                <div className="inline-block bg-emerald-800 rounded-lg p-4">
                  <img
                    src="https://wolthers.com/images/wolthers-logo-off-white.svg"
                    alt="Wolthers & Associates"
                    className="h-8 w-auto"
                  />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Analytics</h1>
              <p className="text-gray-600">Staff Communication Dashboard</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => signIn('azure-ad')}
                className="w-full bg-emerald-700 text-white px-4 py-3 rounded-lg hover:bg-emerald-800 transition duration-200 font-semibold shadow-md"
              >
                Sign in with Microsoft
              </button>
              <p className="text-xs text-gray-500 text-center">
                Or try:{' '}
                <a
                  href="/api/auth/signin/azure-ad"
                  className="text-emerald-700 hover:underline"
                >
                  Direct Microsoft Sign-in
                </a>
              </p>
            </div>
          </div>
        </div>
      </>
    )
  }

  if (!session.user?.isAdmin) {
    return (
      <>
        <Head>
          <title>Email Analytics — Wolthers &amp; Associates</title>
        </Head>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <svg className="w-32 h-32 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
          </svg>
        </div>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Email Analytics — Wolthers &amp; Associates</title>
        <meta name="description" content="Email Analytics Dashboard for Wolthers & Associates" />
      </Head>
      <EmailAnalyticsShell session={session} onOpenAdmin={() => setShowAdminModal(true)} />
      <AdminModal isOpen={showAdminModal} onClose={() => setShowAdminModal(false)} />
    </>
  )
}
