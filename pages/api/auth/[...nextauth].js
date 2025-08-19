import NextAuth from 'next-auth'
import AzureADProvider from "next-auth/providers/azure-ad"

export default NextAuth({
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      tenantId: process.env.AZURE_AD_TENANT_ID,
    })
  ],
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Only allow specific users to access the email dashboard
      const allowedUsers = process.env.ALLOWED_USERS?.split(',').map(email => email.trim()) || [];
      
      if (user.email && allowedUsers.includes(user.email.toLowerCase())) {
        return true;
      }
      
      return false; // Deny access to unauthorized users
    },
    async redirect({ url, baseUrl }) {
      return baseUrl;
    },
    async session({ session, token }) {
      return session;
    },
    async jwt({ token, account }) {
      return token;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
})