import { google } from "googleapis";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/business.manage",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

export const getOAuthClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  const projectId = clientId?.split('-')[0];

  console.log('[getOAuthClient] Environment variables:', {
    clientId: clientId ? `${clientId.substring(0, 20)}...` : 'NOT SET',
    clientSecret: clientSecret ? `${clientSecret.substring(0, 10)}...` : 'NOT SET',
    redirectUri: redirectUri || 'NOT SET',
    projectId: projectId || 'UNKNOWN',
  });

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google OAuth environment variables are not set.");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

export const buildGoogleAuthUrl = (state: Record<string, string>) => {
  const client = getOAuthClient();
  
  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    scope: GOOGLE_SCOPES,
    include_granted_scopes: true,
    prompt: "consent",
    state: JSON.stringify(state),
  });

  console.log('[buildGoogleAuthUrl] Generated URL:', authUrl);
  console.log('[buildGoogleAuthUrl] Client ID from URL:', authUrl.match(/client_id=([^&]+)/)?.[1]);
  
  return authUrl;
};
