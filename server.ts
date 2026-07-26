import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import axios from 'axios';
import cookieSession from 'cookie-session';
import dotenv from 'dotenv';
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const getAppDirname = () => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      return path.dirname(fileURLToPath(import.meta.url));
    }
  } catch (error) {
    // ignore
  }
  return typeof __dirname !== 'undefined' ? __dirname : process.cwd();
};

const _dirname = getAppDirname();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(cookieSession({
    name: 'session',
    keys: ['calendar-sync-secret-key'],
    maxAge: 24 * 60 * 60 * 1000,
    secure: false, // Permite funcionamento mais estável no ambiente de teste do AI Studio
    sameSite: 'lax',
    httpOnly: true
  }));

  // --- CONFIGURATION HELPERS ---
  const SECRETS_FILE = path.join(_dirname, 'secrets.json');
  
  const getKeys = () => {
    let localSecrets: any = {};
    if (fs.existsSync(SECRETS_FILE)) {
      try {
        localSecrets = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf8'));
      } catch (e) {
        console.error('Erro ao ler secrets.json:', e);
      }
    }

    return {
      googleId: (localSecrets.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID)?.trim(),
      googleSecret: (localSecrets.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET)?.trim(),
      mapsKey: (localSecrets.GOOGLE_MAPS_PLATFORM_KEY || process.env.GOOGLE_MAPS_PLATFORM_KEY)?.trim()
    };
  };

  const getKeysSummary = () => {
    const k = getKeys();
    return {
      google: k.googleId ? `${k.googleId.substring(0, 10)}... (len: ${k.googleId.length})` : 'MISSING'
    };
  };

  const getRedirectUri = (req: any, provider: string) => {
    // Prefer x-forwarded-host and x-forwarded-proto from the proxy
    const forwardedHost = req.get('x-forwarded-host');
    const forwardedProto = req.get('x-forwarded-proto');
    const standardHost = req.get('host');
    
    const host = forwardedHost || standardHost;
    
    // Default to https in production environments (run.app), http for localhost
    let protocol = forwardedProto || (host?.includes('localhost') || host?.includes('127.0.0.1') ? 'http' : 'https');
    
    // Ensure protocol is just 'http' or 'https' (sometimes it's a list)
    if (protocol.includes(',')) protocol = protocol.split(',')[0].trim();

    // Remove potential port and list from host
    let cleanHost = host?.split(',')[0].trim();
    
    // CRITICAL: Google rejects standard ports (80/443) explicitly in the URI for .run.app
    // We must strip any port if it's not localhost
    if (cleanHost && !cleanHost.includes('localhost') && !cleanHost.includes('127.0.0.1')) {
      cleanHost = cleanHost.split(':')[0];
      // Force HTTPS for all Cloud Run / AI Studio / Google domains
      if (
        cleanHost.endsWith('.app') || 
        cleanHost.endsWith('.dev') || 
        cleanHost.includes('googleusercontent.com') ||
        cleanHost.includes('aistudio.google.com')
      ) {
        protocol = 'https';
      }
    }
    
    const redirectUri = `${protocol}://${cleanHost}/auth/${provider}/callback`;
    
    console.log(`[OAuth] Final Redirect URI for Google: ${redirectUri}`);
    return redirectUri;
  };

  // --- GOOGLE OAUTH ---
  app.get('/api/auth/google/url', (req, res) => {
    const keys = getKeys();
    console.log('--- GOOGLE AUTH URL REQUEST ---');
    console.log('Host Header:', req.get('host'));
    console.log('X-Forwarded-Host:', req.get('x-forwarded-host'));
    console.log('Full URL:', req.protocol + '://' + req.get('host') + req.originalUrl);
    
    if (!keys.googleId || !keys.googleSecret) {
      console.warn('[Google OAuth] Missing keys in /url request');
      return res.status(400).json({ error: 'Chaves do Google não configuradas. Verifique a aba API.' });
    }

    const redirectUri = getRedirectUri(req, 'google');
    console.log(`[Google OAuth] Final Redirect URI to be sent: ${redirectUri}`);
    
    const oAuth2Client = new google.auth.OAuth2(keys.googleId, keys.googleSecret, redirectUri);
    const scopes = [
      'https://www.googleapis.com/auth/calendar', 
      'https://www.googleapis.com/auth/gmail.send',
      'profile', 
      'email'
    ];
    const url = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
    res.json({ url, redirectUri });
  });

  // --- GOOGLE CALENDARS LIST ---
  app.get('/api/google/calendars', async (req, res) => {
    const email = req.query.email as string;
    const accounts = (req.session as any).googleAccounts || [];
    const account = accounts.find((a: any) => a.email === email);
    
    if (!account) {
      return res.status(401).json({ error: 'Conta Google não encontrada ou conectada' });
    }

    const keys = getKeys();
    if (!keys.googleId || !keys.googleSecret) {
      return res.status(401).json({ error: 'Chaves do Google não configuradas no servidor.' });
    }

    try {
      const auth = new google.auth.OAuth2(keys.googleId, keys.googleSecret);
      auth.setCredentials(account.tokens);
      const calendar = google.calendar({ version: 'v3', auth });
      const response = await calendar.calendarList.list();
      res.json(response.data.items || []);
    } catch (error: any) {
      console.error('Error listing Google calendars:', error.response?.data || error.message);
      res.status(500).json({ error: 'Erro ao listar agendas' });
    }
  });

  app.get(['/auth/google/callback', '/auth/google/callback/'], async (req, res) => {
    console.log('--- GOOGLE AUTH CALLBACK RECEIVED ---');
    console.log('Query Params:', JSON.stringify(req.query, null, 2));
    
    const code = req.query.code as string;
    const keys = getKeys();
    const redirectUri = getRedirectUri(req, 'google');
    console.log(`[Google Callback] Using Redirect URI for token exchange: ${redirectUri}`);
    
    if (!keys.googleId || !keys.googleSecret) {
      console.error('Google Auth Error: Client ID or Client Secret is missing in callback.');
      return res.status(500).send('Erro na configuração das chaves do Google no servidor.');
    }

    try {
      const oAuth2Client = new google.auth.OAuth2(keys.googleId, keys.googleSecret, redirectUri);
      const { tokens } = await oAuth2Client.getToken(code);
      oAuth2Client.setCredentials(tokens);

      const oauth2 = google.oauth2({ version: 'v2', auth: oAuth2Client });
      if (!oauth2 || !oauth2.userinfo) {
        throw new Error('Falha ao inicializar o serviço Google OAuth2.');
      }
      const userInfo = await oauth2.userinfo.get();
      const email = userInfo.data.email;

      if (!email) throw new Error('Could not get user email');

      // Strip tokens to avoid 4KB cookie limit
      const strippedTokens = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date,
        scope: tokens.scope
      };

      // Manage multiple accounts
      let accounts = (req.session as any).googleAccounts || [];
      const existingIndex = accounts.findIndex((a: any) => a.email === email);
      
      if (existingIndex > -1) {
        accounts[existingIndex].tokens = strippedTokens;
      } else {
        accounts.push({ email, tokens: strippedTokens });
      }

      (req.session as any).googleAccounts = accounts;
      console.log(`Google account ${email} saved to session.`);
      
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', provider: 'google', email: '${email}' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Conexão com a conta ${email} realizada com sucesso!</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('Google Auth Error:', error);
      res.status(500).send('Erro na autenticação com Google.');
    }
  });

  // --- SYNC ENDPOINT ---
  app.post('/api/sync/calendar', async (req, res) => {
    const { event, platforms } = req.body;
    const results: any = {};
    const keys = getKeys();

    // Google Sync
    if (platforms.google && (req.session as any).googleAccounts) {
      const accounts = (req.session as any).googleAccounts || [];
      const account = accounts.find((a: any) => a.email === platforms.googleAccountEmail);
      
      if (account) {
        if (!keys.googleId || !keys.googleSecret) {
          console.error('Google Sync Error: Missing keys');
          results.google = { status: 'error', message: 'Credenciais do Google não configuradas no servidor.' };
        } else {
          console.log('Iniciando Sync Google para:', event.title, 'na conta:', account.email);
          try {
            const auth = new google.auth.OAuth2(keys.googleId, keys.googleSecret);
            auth.setCredentials(account.tokens);
          const calendar = google.calendar({ version: 'v3', auth });

          // Build request body with timezone support
          const startDateTime = event.start;
          const endDateTime = event.end;
          
          console.log('Dados recebidos para Sync:', { startDateTime, endDateTime });

          // Se as datas não tiverem offset, assume America/Sao_Paulo (Comum para PT-BR)
          const timeZone = 'America/Sao_Paulo';

          const requestBody: any = {
            summary: event.title || 'Sem título',
            description: event.description,
            start: { 
              dateTime: startDateTime.includes(':') && startDateTime.split(':').length === 2 ? `${startDateTime}:00` : startDateTime,
              timeZone: startDateTime.includes('Z') || startDateTime.match(/[+-]\d{2}:?\d{2}$/) ? undefined : timeZone
            },
            end: { 
              dateTime: endDateTime.includes(':') && endDateTime.split(':').length === 2 ? `${endDateTime}:00` : endDateTime,
              timeZone: endDateTime.includes('Z') || endDateTime.match(/[+-]\d{2}:?\d{2}$/) ? undefined : timeZone
            },
            location: event.address
          };

          // Adicionar Recorrência Google
          if (event.isRecurrent && event.recurrenceType) {
            const freqMap: any = { 
              daily: 'DAILY', 
              weekly: 'WEEKLY', 
              monthly: 'MONTHLY', 
              yearly: 'YEARLY' 
            };
            const freq = freqMap[event.recurrenceType];
            if (freq) {
              let rrule = `RRULE:FREQ=${freq}`;
              if (event.recurrenceUntil) {
                // Formato Google: YYYYMMDDTHHMMSSZ
                const until = event.recurrenceUntil.replace(/-/g, '') + 'T235959Z';
                rrule += `;UNTIL=${until}`;
              }
              requestBody.recurrence = [rrule];
            }
          }

          // Adicionar Lembrete
          if (event.hasReminder && event.reminderMinutes !== undefined) {
            requestBody.reminders = {
              useDefault: false,
              overrides: [
                { method: 'popup', minutes: event.reminderMinutes }
              ]
            };
          }

          console.log('Enviando para Google (Body):', JSON.stringify(requestBody, null, 2));

          const insertRes = await calendar.events.insert({
            calendarId: platforms.googleCalendarId || 'primary',
            requestBody
          });
          
          console.log('Resposta do Google:', insertRes.data.htmlLink);
          
          console.log('Evento salvo com sucesso no Google Calendar');
          results.google = { 
            status: 'success', 
            id: insertRes.data.id, 
            link: insertRes.data.htmlLink 
          };
        } catch (error: any) {
          const errorData = error.response?.data || {};
          console.error('Google Sync Error Details:', errorData);
          
          let friendlyMessage = error.message;
          if (errorData.error === 'invalid_client') {
            friendlyMessage = 'Erro nas credenciais: O Client ID ou Secret do Google está incorreto ou foi excluído. Verifique a aba API nas Configurações.';
          } else if (errorData.error === 'invalid_grant') {
            friendlyMessage = 'Acesso expirado ou revogado. Por favor, desconecte e conecte sua conta Google novamente nas Configurações.';
          } else if (errorData.error?.message) {
            friendlyMessage = errorData.error.message;
          }
          
          results.google = { status: 'error', message: friendlyMessage, raw: errorData };
        }
      }
    }
  }

    res.json(results);
  });

  // Check connection status
  app.get('/api/auth/status', (req, res) => {
    const keys = getKeys();
    const googleAccounts = (req.session as any).googleAccounts || [];
    res.json({
      google: googleAccounts.length > 0,
      googleAccounts: googleAccounts.map((a: any) => a.email),
      config: {
        google: !!keys.googleId && !!keys.googleSecret,
        maps: !!keys.mapsKey,
        mapsKey: keys.mapsKey // Expose the key to the client
      }
    });
  });

  // Save Config Keys
  app.post('/api/config/keys', (req, res) => {
    const { googleId, googleSecret, mapsKey } = req.body;
    
    // Read current
    let secrets: any = {};
    if (fs.existsSync(SECRETS_FILE)) {
      secrets = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf8'));
    }

    // Update only sent ones
    if (googleId !== undefined) secrets.GOOGLE_CLIENT_ID = googleId;
    if (googleSecret !== undefined) secrets.GOOGLE_CLIENT_SECRET = googleSecret;
    if (mapsKey !== undefined) secrets.GOOGLE_MAPS_PLATFORM_KEY = mapsKey;

    fs.writeFileSync(SECRETS_FILE, JSON.stringify(secrets, null, 2));
    res.json({ success: true });
  });

  app.post('/api/auth/google/logout', (req, res) => {
    const { email } = req.body;
    let accounts = (req.session as any).googleAccounts || [];
    if (email) {
      accounts = accounts.filter((a: any) => a.email !== email);
    } else {
      accounts = [];
    }
    (req.session as any).googleAccounts = accounts;
    res.json({ success: true });
  });

  // --- DELETE SYNC ENDPOINT ---
  app.post('/api/sync/calendar/delete', async (req, res) => {
    const { googleEventId, email, calendarId } = req.body;
    const keys = getKeys();

    if (!googleEventId || !email) {
      return res.status(400).json({ error: 'ID do evento ou e-mail faltando.' });
    }

    const accounts = (req.session as any).googleAccounts || [];
    const account = accounts.find((a: any) => a.email === email);

    if (!account) {
      return res.status(401).json({ error: 'Conta Google não encontrada no sistema.' });
    }

    if (!keys.googleId || !keys.googleSecret) {
      return res.status(500).json({ error: 'Credenciais do Google não configuradas no servidor.' });
    }

    try {
      const auth = new google.auth.OAuth2(keys.googleId, keys.googleSecret);
      auth.setCredentials(account.tokens);
      const calendar = google.calendar({ version: 'v3', auth });

      console.log(`Tentando deletar evento ${googleEventId} na agenda ${calendarId || 'primary'} para ${email}`);

      await calendar.events.delete({
        calendarId: calendarId || 'primary',
        eventId: googleEventId
      });

      console.log('Evento deletado no Google Calendar com sucesso:', googleEventId);
      res.json({ success: true });
    } catch (error: any) {
      const errorData = error.response?.data?.error || error;
      console.error('Google Delete Sync Error Details:', JSON.stringify(errorData, null, 2));
      
      // Se o erro for 404, o evento já não existe no Google, então podemos considerar sucesso na exclusão
      if (error.response?.status === 404) {
        console.log('Evento não encontrado no Google (404), ignorando pois já deve ter sido removido.');
        return res.json({ success: true, note: 'Event already gone from Google' });
      }

      res.status(500).json({ 
        error: error.response?.data?.error?.message || error.message,
        details: errorData
      });
    }
  });

  // --- GMAIL SEND ENDPOINT ---
  app.post('/api/email/send', async (req, res) => {
    const { from, to, subject, body } = req.body;
    const keys = getKeys();

    if (!from || !to || !subject || !body) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando (from, to, subject, body).' });
    }

    const accounts = (req.session as any).googleAccounts || [];
    const account = accounts.find((a: any) => a.email === from);

    if (!account) {
      return res.status(401).json({ error: `A conta ${from} não está conectada. Por favor, conecte-a em Configurações.` });
    }

    if (!keys.googleId || !keys.googleSecret) {
      return res.status(500).json({ error: 'Credenciais do Google não configuradas no servidor.' });
    }

    try {
      const auth = new google.auth.OAuth2(keys.googleId, keys.googleSecret);
      auth.setCredentials(account.tokens);
      const gmail = google.gmail({ version: 'v1', auth });

      // Build RFC822 message
      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
      const messageParts = [
        `From: "Church Control System" <${from}>`,
        `To: ${to}`,
        `Subject: ${utf8Subject}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Date: ${new Date().toUTCString()}`,
        '',
        body
      ];
      const message = messageParts.join('\r\n');

      // Encoding is part of the Gmail API requirement (base64url)
      const encodedMessage = Buffer.from(message, 'utf-8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });

      console.log(`E-mail enviado de ${from} para ${to}`);
      res.json({ success: true });
    } catch (error: any) {
      const errorDetail = error.response?.data || error.message;
      console.error('Gmail Send Error:', JSON.stringify(errorDetail, null, 2));
      res.status(500).json({ 
        error: error.response?.data?.error?.message || error.message,
        details: error.response?.data?.error // Envia detalhes para o frontend ajudar no debug
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const buildPath = path.join(process.cwd(), 'dist');
    app.use(express.static(buildPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(buildPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
