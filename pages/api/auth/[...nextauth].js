import NextAuth from 'next-auth'
import AzureADProvider from "next-auth/providers/azure-ad"

// Debug environment variables
console.log('NextAuth Environment Variables:', {
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  AZURE_AD_CLIENT_ID: process.env.AZURE_AD_CLIENT_ID ? 'SET' : 'NOT SET',
  AZURE_AD_CLIENT_SECRET: process.env.AZURE_AD_CLIENT_SECRET ? 'SET' : 'NOT SET',
  AZURE_AD_TENANT_ID: process.env.AZURE_AD_TENANT_ID ? 'SET' : 'NOT SET',
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'SET' : 'NOT SET'
});

export const authOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      tenantId: process.env.AZURE_AD_TENANT_ID,
    })
  ],
  // pages: {
  //   signIn: '/auth/signin',
  //   error: '/auth/error',
  // },
  debug: true,
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('User signed in:', user.email);
      // Allow all authenticated users - data access will be controlled at the content level
      return true;
    },
    async redirect({ url, baseUrl }) {
      return baseUrl;
    },
    async session({ session, token }) {
      // Add user role to session based on admin users list
      const adminUsers = process.env.ALLOWED_USERS?.split(',').map(email => email.trim().toLowerCase()) || [];
      session.user.isAdmin = session.user.email && adminUsers.includes(session.user.email.toLowerCase());
      session.user.role = session.user.isAdmin ? 'admin' : 'user';
      return session;
    },
    async jwt({ token, account }) {
      return token;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}

export default NextAuth(authOptions)