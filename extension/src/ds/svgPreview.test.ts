import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractSvgMarkup } from './svgPreview';

test('extracts inline svg, renaming JSX attrs and injecting xmlns', () => {
  const src = `
    export function ArrowIcon(props) {
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="lucide">
          <path d="M5 12h14" strokeLinecap="round" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    }`;
  const out = extractSvgMarkup(src);
  assert.ok(out, 'expected markup');
  assert.match(out, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(out, /viewBox="0 0 24 24"/);
  assert.match(out, /fill="none"/);
  assert.match(out, /stroke-width="2"/); // strokeWidth -> stroke-width
  assert.match(out, /class="lucide"/); // className -> class
  assert.match(out, /<path d="M5 12h14" stroke-linecap="round"\/>/);
  assert.match(out, /<circle cx="12" cy="12" r="3"\/>/);
});

test('drops spreads, dynamic attrs, and event handlers', () => {
  const src = `
    const Icon = (props) => (
      <svg viewBox="0 0 24 24" fill={color} {...props} onClick={handleClick}>
        <path d="M1 1" />
      </svg>
    );`;
  const out = extractSvgMarkup(src);
  assert.ok(out);
  assert.doesNotMatch(out, /onClick/i);
  assert.doesNotMatch(out, /color/); // dynamic fill dropped
  assert.match(out, /viewBox="0 0 24 24"/); // static kept
  assert.match(out, /<path d="M1 1"\/>/);
});

test('strips non-whitelisted tags (script, a) and their subtrees, plus href', () => {
  const src = `
    export const Danger = () => (
      <svg viewBox="0 0 10 10">
        <script>alert(1)</script>
        <a href="http://evil.example"><path d="M0 0" /></a>
        <path d="M1 1" fill="currentColor" />
      </svg>
    );`;
  const out = extractSvgMarkup(src);
  assert.ok(out);
  assert.doesNotMatch(out, /script/i);
  assert.doesNotMatch(out, /alert/);
  assert.doesNotMatch(out, /evil\.example/);
  assert.doesNotMatch(out, /href/);
  assert.doesNotMatch(out, /<a[\s>]/);
  assert.match(out, /<path d="M1 1" fill="currentColor"\/>/); // sibling survives
  assert.doesNotMatch(out, /M0 0/); // path nested under <a> is dropped with it
});

test('strips lowercase event-handler attributes (onload/onclick/onmouseover)', () => {
  const src = `
    export const Sneaky = () => (
      <svg viewBox="0 0 10 10" onload="alert(1)">
        <rect width="10" height="10" onmouseover="alert(2)" onclick="alert(3)" />
        <path d="M1 1" />
      </svg>
    );`;
  const out = extractSvgMarkup(src);
  assert.ok(out);
  assert.doesNotMatch(out, /onload/i);
  assert.doesNotMatch(out, /onmouseover/i);
  assert.doesNotMatch(out, /onclick/i);
  assert.doesNotMatch(out, /alert/);
  assert.match(out, /<rect width="10" height="10"\/>/); // element survives, handlers gone
});

test('strips the style attribute (can carry url() fetches / redressing CSS)', () => {
  const src = `
    export const Styled = () => (
      <svg viewBox="0 0 10 10">
        <rect width="10" height="10" style="background:url('http://evil.example/x')" />
      </svg>
    );`;
  const out = extractSvgMarkup(src);
  assert.ok(out);
  assert.doesNotMatch(out, /style=/);
  assert.doesNotMatch(out, /evil\.example/);
});

test('selects the svg of the named component in a multi-component file', () => {
  const src = `
    export const First = () => (
      <svg viewBox="0 0 24 24"><path d="M1 1" /></svg>
    );
    export const Second = () => (
      <svg viewBox="0 0 24 24"><path d="M2 2" /></svg>
    );`;
  const first = extractSvgMarkup(src, 'First');
  const second = extractSvgMarkup(src, 'Second');
  assert.ok(first && second);
  assert.match(first, /M1 1/);
  assert.doesNotMatch(first, /M2 2/);
  assert.match(second, /M2 2/);
  assert.doesNotMatch(second, /M1 1/);
  // Unknown name and no name both fall back to the first svg.
  assert.match(extractSvgMarkup(src, 'Missing') ?? '', /M1 1/);
  assert.match(extractSvgMarkup(src) ?? '', /M1 1/);
});

test('drops xlink:href (JSX xlinkHref) external references', () => {
  const src = `
    export const Sprite = () => (
      <svg viewBox="0 0 24 24"><use xlinkHref="http://evil.example/sprite#x" /></svg>
    );`;
  const out = extractSvgMarkup(src);
  assert.ok(out);
  assert.doesNotMatch(out, /xlink/i);
  assert.doesNotMatch(out, /evil\.example/);
  assert.match(out, /<use\/>/);
});

test('returns undefined for a component with no inline svg (wraps another icon)', () => {
  const src = `
    import { Home } from 'lucide-react';
    export const HomeIcon = (props) => <Home {...props} />;`;
  assert.equal(extractSvgMarkup(src), undefined);
});

test('returns undefined for an svg with no drawable children', () => {
  const src = `export const Empty = () => <svg viewBox="0 0 1 1"></svg>;`;
  assert.equal(extractSvgMarkup(src), undefined);
});

test('returns undefined on unparseable / empty input', () => {
  assert.equal(extractSvgMarkup(''), undefined);
  assert.equal(extractSvgMarkup('const x = ('), undefined);
});

test('returns undefined when a valid svg is followed by a syntax error', () => {
  // createSourceFile recovers a partial AST here; the trailing broken statement
  // must still make the whole extraction bail out rather than preview the svg.
  const src = `
    export const Icon = () => <svg viewBox="0 0 24 24"><path d="M1 1" /></svg>;
    const x = (`;
  assert.equal(extractSvgMarkup(src), undefined);
});
