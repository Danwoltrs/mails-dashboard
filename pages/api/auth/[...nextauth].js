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
      console.log('NextAuth signIn callback:', { 
        userEmail: user.email, 
        allowedUsers: process.env.ALLOWED_USERS 
      });
      
      // Temporarily allow all users for debugging
      console.log('Allowing user for debugging:', user.email);
      return true;
      
      // Only allow specific users to access the email dashboard
      // const allowedUsers = process.env.ALLOWED_USERS?.split(',').map(email => email.trim()) || [];
      
      // if (user.email && allowedUsers.includes(user.email.toLowerCase())) {
      //   console.log('User authorized:', user.email);
      //   return true;
      // }
      
      // console.log('User not authorized:', user.email);
      // return false; // Deny access to unauthorized users
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
}

export default NextAuth(authOptions)