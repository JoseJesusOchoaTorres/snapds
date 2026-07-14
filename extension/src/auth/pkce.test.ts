import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCodeChallenge, createCodeVerifier, createRandomState } from './pkce';

/** base64url uses only [A-Za-z0-9-_] and carries no padding. */
const isBase64Url = (s: string) => /^[A-Za-z0-9\-_]+$/.test(s);

test('createCodeVerifier is a padding-free base64url string of the expected length', () => {
  const verifier = createCodeVerifier();
  assert.ok(isBase64Url(verifier), `not base64url: ${verifier}`);
  // 32 random bytes → 43 base64url chars (no '=' padding).
  assert.equal(verifier.length, 43);
});

test('createCodeVerifier returns a fresh value on each call', () => {
  assert.notEqual(createCodeVerifier(), createCodeVerifier());
});

test('createCodeChallenge matches the RFC 7636 Appendix B test vector', () => {
  // From RFC 7636: verifier → S256 challenge.
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  const expected = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
  assert.equal(createCodeChallenge(verifier), expected);
});

test('createCodeChallenge is deterministic and base64url', () => {
  const verifier = createCodeVerifier();
  const a = createCodeChallenge(verifier);
  const b = createCodeChallenge(verifier);
  assert.equal(a, b);
  assert.ok(isBase64Url(a));
  // SHA-256 digest (32 bytes) → 43 base64url chars.
  assert.equal(a.length, 43);
});

test('createRandomState is a fresh, padding-free base64url string', () => {
  const s1 = createRandomState();
  const s2 = createRandomState();
  assert.ok(isBase64Url(s1));
  assert.ok(isBase64Url(s2));
  assert.notEqual(s1, s2);
});
