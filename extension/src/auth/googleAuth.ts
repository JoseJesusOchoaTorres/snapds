import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { URL } from 'node:url';
import * as vscode from 'vscode';
import { createCodeChallenge, createCodeVerifier, createRandomState } from './pkce';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO = 'https://openidconnect.googleapis.com/v1/userinfo';
const SCOPES = 'openid email profile';

const SECRET_ACCESS = 'google.accessToken';
const SECRET_REFRESH = 'google.refreshToken';
const SECRET_EXPIRES = 'google.expiresAt';

export interface GoogleUser {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  id_token?: string;
  token_type: 'Bearer';
  scope?: string;
}

interface LoopbackHandle {
  port: number;
  redirectUri: string;
  codePromise: Promise<string>;
}

export class GoogleAuth {
  constructor(private ctx: vscode.ExtensionContext) {}

  private getClientId(): string {
    const id = vscode.workspace.getConfiguration('snapds').get<string>('googleClientId') ?? '';
    if (!id) {
      throw new Error(
        'Set "snapds.googleClientId" in Settings (use a Google "Desktop app" OAuth Client ID).',
      );
    }
    return id;
  }

  async signIn(): Promise<GoogleUser> {
    const clientId = this.getClientId();
    const verifier = createCodeVerifier();
    const challenge = createCodeChallenge(verifier);
    const state = createRandomState();

    const loopback = this.startLoopback(state);
    const authUrl = this.buildAuthUrl({
      clientId,
      redirectUri: loopback.redirectUri,
      codeChallenge: challenge,
      state,
    });
    await vscode.env.openExternal(vscode.Uri.parse(authUrl));

    const code = await loopback.codePromise;
    const tokens = await this.exchangeCode({
      clientId,
      code,
      verifier,
      redirectUri: loopback.redirectUri,
    });
    await this.persistTokens(tokens);
    return await this.fetchUser(tokens.access_token);
  }

  async signOut(): Promise<void> {
    await this.ctx.secrets.delete(SECRET_ACCESS);
    await this.ctx.secrets.delete(SECRET_REFRESH);
    await this.ctx.secrets.delete(SECRET_EXPIRES);
  }

  async isSignedIn(): Promise<boolean> {
    const refresh = await this.ctx.secrets.get(SECRET_REFRESH);
    return Boolean(refresh);
  }

  async getAccessToken(): Promise<string | undefined> {
    const expiresAt = Number((await this.ctx.secrets.get(SECRET_EXPIRES)) ?? 0);
    if (Date.now() < expiresAt - 60_000) {
      return await this.ctx.secrets.get(SECRET_ACCESS);
    }
    const refresh = await this.ctx.secrets.get(SECRET_REFRESH);
    if (!refresh) return undefined;
    const tokens = await this.refresh(refresh);
    await this.persistTokens(tokens);
    return tokens.access_token;
  }

  async getCurrentUser(): Promise<GoogleUser | undefined> {
    const token = await this.getAccessToken();
    if (!token) return undefined;
    try {
      return await this.fetchUser(token);
    } catch {
      return undefined;
    }
  }

  private buildAuthUrl(args: {
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    state: string;
  }): string {
    const u = new URL(AUTH_URL);
    u.searchParams.set('client_id', args.clientId);
    u.searchParams.set('redirect_uri', args.redirectUri);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('scope', SCOPES);
    u.searchParams.set('code_challenge', args.codeChallenge);
    u.searchParams.set('code_challenge_method', 'S256');
    u.searchParams.set('state', args.state);
    u.searchParams.set('access_type', 'offline');
    u.searchParams.set('prompt', 'consent');
    return u.toString();
  }

  private startLoopback(expectedState: string): LoopbackHandle {
    let resolveCode!: (code: string) => void;
    let rejectCode!: (err: Error) => void;
    const codePromise = new Promise<string>((resolve, reject) => {
      resolveCode = resolve;
      rejectCode = reject;
    });

    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1');
        if (url.pathname !== '/callback') {
          res.writeHead(404).end('Not found');
          return;
        }
        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');
        const err = url.searchParams.get('error');
        if (err || !code || returnedState !== expectedState) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Sign-in failed</h1><p>You may close this window.</p>');
          rejectCode(new Error(err ?? 'Invalid state or missing code'));
          server.close();
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Signed in.</h1><p>You may close this window and return to VS Code.</p>');
        resolveCode(code);
        server.close();
      } catch (e) {
        rejectCode(e as Error);
        server.close();
      }
    });

    server.on('error', (e) => rejectCode(e));
    server.listen(0, '127.0.0.1');
    const addr = server.address() as AddressInfo | null;
    if (!addr || typeof addr === 'string') {
      throw new Error('Failed to bind loopback server.');
    }
    const port = addr.port;
    return { port, redirectUri: `http://127.0.0.1:${port}/callback`, codePromise };
  }

  private async exchangeCode(args: {
    clientId: string;
    code: string;
    verifier: string;
    redirectUri: string;
  }): Promise<TokenResponse> {
    const body = new URLSearchParams({
      client_id: args.clientId,
      code: args.code,
      code_verifier: args.verifier,
      grant_type: 'authorization_code',
      redirect_uri: args.redirectUri,
    });
    const r = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!r.ok) throw new Error(`Token exchange failed: ${r.status} ${await r.text()}`);
    return (await r.json()) as TokenResponse;
  }

  private async refresh(refreshToken: string): Promise<TokenResponse> {
    const body = new URLSearchParams({
      client_id: this.getClientId(),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
    const r = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!r.ok) throw new Error(`Token refresh failed: ${r.status} ${await r.text()}`);
    const data = (await r.json()) as TokenResponse;
    if (!data.refresh_token) data.refresh_token = refreshToken;
    return data;
  }

  private async persistTokens(t: TokenResponse): Promise<void> {
    await this.ctx.secrets.store(SECRET_ACCESS, t.access_token);
    if (t.refresh_token) await this.ctx.secrets.store(SECRET_REFRESH, t.refresh_token);
    const expiresAt = Date.now() + (t.expires_in ?? 3600) * 1000;
    await this.ctx.secrets.store(SECRET_EXPIRES, String(expiresAt));
  }

  private async fetchUser(accessToken: string): Promise<GoogleUser> {
    const r = await fetch(USERINFO, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!r.ok) throw new Error(`userinfo failed: ${r.status}`);
    return (await r.json()) as GoogleUser;
  }
}
