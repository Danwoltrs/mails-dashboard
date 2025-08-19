import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'

export default function Error() {
  const router = useRouter()
  const { error } = router.query

  return (
    <>
      <Head>
        <title>Authentication Error - Email Analytics Dashboard</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
            <p className="text-gray-600 mb-6">
              You don't have permission to access this email analytics dashboard.
              Only authorized Wolthers & Associates team members can sign in.
            </p>
            <div className="space-y-3">
              <Link 
                href="/auth/signin"
                className="block w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition duration-200 font-semibold text-center"
              >
                Try Again
              </Link>
              <p className="text-xs text-gray-500">
                Contact IT support if you believe you should have access.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}