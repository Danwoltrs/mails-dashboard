import { getProviders, signIn, getSession } from "next-auth/react"
import { getServerSideProps } from "next"
import Head from "next/head"

export default function SignIn({ providers }) {
  return (
    <>
      <Head>
        <title>Sign In - Email Analytics Dashboard</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Email Analytics</h1>
            <p className="text-gray-600">Wolthers & Associates</p>
            <p className="text-sm text-gray-500 mt-4">
              Please sign in to access the email analytics dashboard
            </p>
          </div>
          
          {Object.values(providers).map((provider) => (
            <div key={provider.name} className="mb-4">
              <button
                onClick={() => signIn(provider.id)}
                className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition duration-200 font-semibold"
              >
                Sign in with {provider.name}
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export async function getServerSideProps(context) {
  const session = await getSession(context)
  
  // If user is already signed in, redirect to dashboard
  if (session) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    }
  }

  const providers = await getProviders()
  
  return {
    props: {
      providers,
    },
  }
}