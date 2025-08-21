// Debug endpoint to check NextAuth configuration
export default function handler(req, res) {
  const config = {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT SET',
    AZURE_AD_CLIENT_ID: process.env.AZURE_AD_CLIENT_ID ? 'SET (length: ' + process.env.AZURE_AD_CLIENT_ID.length + ')' : 'NOT SET',
    AZURE_AD_CLIENT_SECRET: process.env.AZURE_AD_CLIENT_SECRET ? 'SET (length: ' + process.env.AZURE_AD_CLIENT_SECRET.length + ')' : 'NOT SET',
    AZURE_AD_TENANT_ID: process.env.AZURE_AD_TENANT_ID ? 'SET (length: ' + process.env.AZURE_AD_TENANT_ID.length + ')' : 'NOT SET',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'SET (length: ' + process.env.NEXTAUTH_SECRET.length + ')' : 'NOT SET',
  };

  // Check if CLIENT_ID looks like a GUID
  if (process.env.AZURE_AD_CLIENT_ID) {
    const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    config.CLIENT_ID_IS_VALID_GUID = guidPattern.test(process.env.AZURE_AD_CLIENT_ID);
  }

  res.status(200).json({
    message: 'NextAuth Debug Info',
    timestamp: new Date().toISOString(),
    config
  });
}