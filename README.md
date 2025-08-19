# Email Analytics Dashboard - mails.wolthers.com

A Next.js dashboard for analyzing email analytics data for Wolthers & Associates team members.

## Features

- **Secure Authentication**: Azure AD integration with user restrictions
- **CSV Upload**: Drag-and-drop file upload functionality  
- **Email Analytics**: Interactive charts and visualizations
- **Real-time Analysis**: Instant processing of uploaded CSV files
- **Responsive Design**: Works on desktop and mobile devices

## Authorized Users

Only the following team members can access this dashboard:
- Daniel Wolthers
- Tom Sullivan  
- Rasmus Wolthers
- Svenn Wolthers

## Setup Instructions

1. **Environment Variables**: Configure the following in Vercel:
   ```
   NEXTAUTH_URL=https://mails.wolthers.com
   NEXTAUTH_SECRET=[generate-random-secret]
   AZURE_AD_CLIENT_ID=[your-azure-client-id]
   AZURE_AD_CLIENT_SECRET=[your-azure-client-secret]
   AZURE_AD_TENANT_ID=[your-azure-tenant-id]
   ALLOWED_USERS=daniel@wolthers.com,tom@wolthers.com,rasmus@wolthers.com,svenn@wolthers.com
   ```

2. **Domain Configuration**: Set up the custom domain `mails.wolthers.com` in Vercel

3. **Azure AD Setup**: Configure the redirect URI in Azure AD to `https://mails.wolthers.com/api/auth/callback/azure-ad`

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Deployment

The dashboard is automatically deployed to Vercel when changes are pushed to the main branch.

## CSV File Format

The dashboard can analyze CSV files with email data containing columns such as:
- Timestamp/Date columns
- Sender/From columns  
- Recipient/To columns
- Status/Result columns

The system automatically detects and analyzes these columns to provide insights.