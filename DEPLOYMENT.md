# Deployment Guide: Vercel Blob Storage Migration

This application has been updated to use **Vercel Blob Storage** for persistent file storage, replacing the ephemeral filesystem approach that doesn't work with serverless functions.

## What Changed

### Before (Filesystem Storage)
- Files uploaded to `/public/mails/` directory
- Files disappeared between serverless function invocations
- Used local file system APIs (`fs.readFileSync`, etc.)

### After (Vercel Blob Storage)
- Files uploaded to Vercel Blob Storage (`@vercel/blob`)
- Files persist across all function invocations
- Files accessible via secure blob URLs
- Better scalability and performance

## Deployment Steps

### 1. Environment Setup

The application automatically uses Vercel's blob storage when deployed. No additional environment variables are required for blob storage - Vercel provides `BLOB_READ_WRITE_TOKEN` automatically in production.

### 2. Deploy to Vercel

```bash
# If not already connected to Vercel
npx vercel login
npx vercel link

# Deploy
npx vercel --prod
```

### 3. Environment Variables (Vercel Dashboard)

Set these in your Vercel project dashboard:

**Required:**
- `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
- `NEXTAUTH_URL`: Your production URL (e.g., `https://your-app.vercel.app`)

**OAuth Provider (Example for Microsoft Azure AD):**
- `AZURE_AD_CLIENT_ID`: Your Azure app client ID
- `AZURE_AD_CLIENT_SECRET`: Your Azure app client secret
- `AZURE_AD_TENANT_ID`: Your Azure tenant ID

### 4. Test the Deployment

1. **Upload Test**: Upload a CSV file and verify it appears in "Available Files"
2. **Persistence Test**: Refresh the page and verify files are still listed
3. **Download Test**: Click download button and verify file downloads correctly
4. **Analytics Test**: Select files and verify analytics load properly

## API Endpoints Updated

### Upload API (`/api/upload-csv`)
- Now uploads directly to Vercel Blob Storage
- Returns blob URL in response
- Handles up to 10MB files

### List API (`/api/list-csv-files`)
- Lists files from blob storage
- Analyzes CSV content for date ranges and record counts
- Returns blob URLs for direct access

### Download API (`/api/download-csv`) - NEW
- Provides secure file downloads
- Streams files from blob storage
- Maintains original filenames

### Delete API (`/api/delete-csv`) - NEW
- Removes files from blob storage
- Admin-only functionality (if implemented)

## File Structure Changes

### Frontend Updates
- File listings now use `file.url` instead of `file.path`
- Added download buttons for each file
- Updated analytics component to fetch from blob URLs

### Configuration Updates
- Updated `vercel.json` to remove filesystem routes
- Added function timeout configurations
- Removed dependency on `/public/mails/` directory

## Migration from Existing Deployment

If you have existing files in the filesystem:

1. **Backup existing files** from `/public/mails/` if needed
2. **Re-upload files** through the new interface after deployment
3. **Old files** in filesystem will be ignored (they don't persist anyway)

## Troubleshooting

### Files not persisting
- Verify you're running on Vercel (blob storage only works in Vercel environment)
- Check Vercel function logs for upload errors

### Upload failures
- Check file size (max 10MB)
- Verify CSV format
- Check authentication status

### Download not working
- Verify blob URLs are accessible
- Check browser network tab for errors
- Ensure proper authentication

### Analytics not loading
- Check that files have valid CSV structure
- Verify date columns exist in CSV
- Check browser console for fetch errors

## Performance Benefits

1. **Persistence**: Files now persist across all serverless invocations
2. **Scalability**: No filesystem size limits
3. **Performance**: Direct blob access for file downloads
4. **Reliability**: Built-in redundancy and backup
5. **Security**: Secure blob URLs with access control

## Cost Considerations

- Vercel Blob Storage: First 10 GB storage included on Pro plan
- See [Vercel Blob pricing](https://vercel.com/docs/storage/vercel-blob/usage-and-pricing) for details
- Much more cost-effective than previous filesystem approach that didn't work