'use client';

import { useEffect, useState } from 'react';
import { Icon } from './icons';

/* ─── shared data ─────────────────────────────────────────────── */

const COMPONENTS = ['Button', 'Card', 'Badge', 'Avatar', 'Input'] as const;
type ComponentName = (typeof COMPONENTS)[number];

const PROPS: Record<ComponentName, { name: string; type: string; required?: boolean }[]> = {
  Button: [
    { name: 'variant', type: '"primary" | "ghost"', required: true },
    { name: 'size', type: '"sm" | "md" | "lg"' },
    { name: 'onClick', type: '() => void' },
    { name: 'disabled', type: 'boolean' },
    { name: 'children', type: 'ReactNode', required: true },
  ],
  Card: [
    { name: 'title', type: 'string', required: true },
    { name: 'padding', type: '"sm" | "md" | "lg"' },
    { name: 'shadow', type: 'boolean' },
    { name: 'children', type: 'ReactNode' },
  ],
  Badge: [
    { name: 'label', type: 'string', required: true },
    { name: 'color', type: '"blue" | "green" | "red"' },
    { name: 'dot', type: 'boolean' },
  ],
  Avatar: [
    { name: 'src', type: 'string' },
    { name: 'name', type: 'string', required: true },
    { name: 'size', type: '"sm" | "md" | "lg"' },
    { name: 'ring', type: 'boolean' },
  ],
  Input: [
    { name: 'placeholder', type: 'string' },
    { name: 'value', type: 'string', required: true },
    { name: 'onChange', type: '(v: string) => void', required: true },
    { name: 'error', type: 'string' },
    { name: 'disabled', type: 'boolean' },
  ],
};

const SKILL_LINES = [
  '# @acme/ui — Snapds skill',
  '',
  'components:',
  '  - name: Button',
  '    import: "@acme/ui"',
  '    props: [variant, size, onClick]',
  '    snippet: |',
  '      <Button variant="$1" size="$2">',
  '        $3',
  '      </Button>',
  '',
  '  - name: Badge',
  '    import: "@acme/ui"',
  '    props: [label, color, dot]',
  '    snippet: <Badge label="$1" />',
  '',
  '  - name: Avatar',
  '    import: "@acme/ui"',
  '    props: [name, size, src]',
  '    snippet: <Avatar name="$1" size="$2" />',
];

/* ─── Tab 1: Browse & Props ───────────────────────────────────── */

function BrowseDemo() {
  const [selected, setSelected] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Show props → wait 2.5 s → fade out → swap → fade in
    const tHide = setTimeout(() => setVisible(false), 2500);
    const tSwap = setTimeout(() => {
      setSelected((s) => (s + 1) % COMPONENTS.length);
      setVisible(true);
    }, 2900);
    return () => {
      clearTimeout(tHide);
      clearTimeout(tSwap);
    };
  }, [selected]);

  const name = COMPONENTS[selected];
  const props = PROPS[name];

  return (
    <div className="demo-shell">
      <div className="demo-sidebar">
        <div className="demo-sidebar__title">Components</div>
        {COMPONENTS.map((c, i) => (
          <div key={c} className={`demo-row${i === selected ? ' demo-row--active' : ''}`}>
            <Icon name="component" size={13} />
            {c}
          </div>
        ))}
      </div>

      <div className={`demo-props${visible ? ' demo-props--in' : ''}`}>
        <div className="demo-props__head">
          <span className="demo-props__name">{name}</span>
          <span className="demo-props__pkg">@acme/ui</span>
        </div>
        <table className="demo-props__table">
          <thead>
            <tr>
              <th>Prop</th>
              <th>Type</th>
              <th>Req</th>
            </tr>
          </thead>
          <tbody>
            {props.map((p) => (
              <tr key={p.name}>
                <td className="demo-props__prop">{p.name}</td>
                <td className="demo-props__type">{p.type}</td>
                <td>{p.required ? <span className="demo-props__req">✓</span> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Tab 2: Drag & Drop → Code ──────────────────────────────── */

const DROP_SEQUENCE = [
  { label: 'Badge', jsx: '<Badge label="New" color="blue" />' },
  { label: 'Avatar', jsx: '<Avatar name="Jane" size="md" />' },
  { label: 'Input', jsx: '<Input value={query} onChange={setQuery} />' },
] as const;

type DropStep = 'idle' | 'hover' | 'dragging' | 'dropped' | 'pause';

function DropDemo() {
  const [step, setStep] = useState<DropStep>('idle');
  const [seqIdx, setSeqIdx] = useState(0);
  const seq = DROP_SEQUENCE[seqIdx];

  useEffect(() => {
    const t: ReturnType<typeof setTimeout>[] = [];
    t.push(setTimeout(() => setStep('hover'), 600));
    t.push(setTimeout(() => setStep('dragging'), 1400));
    t.push(setTimeout(() => setStep('dropped'), 2300));
    t.push(setTimeout(() => setStep('pause'), 3100));
    t.push(
      setTimeout(() => {
        setStep('idle');
        setSeqIdx((i) => (i + 1) % DROP_SEQUENCE.length);
      }, 4800),
    );
    return () => t.forEach(clearTimeout);
  }, [seqIdx]);

  const showCode = step === 'dropped' || step === 'pause';

  return (
    <div className="demo-shell">
      <div className="demo-sidebar">
        <div className="demo-sidebar__title">Components</div>
        {COMPONENTS.map((c) => {
          const isTarget = c === seq.label;
          const isDragging = isTarget && step === 'dragging';
          return (
            <div
              key={c}
              className={[
                'demo-row',
                isTarget && step === 'hover' ? 'demo-row--hover' : '',
                isDragging ? 'demo-row--dragging' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <Icon name="component" size={13} />
              {c}
              {isDragging && <Icon name="grip" size={13} className="tree-item__grip" />}
            </div>
          );
        })}
      </div>

      <pre className="demo-code">
        <div className="demo-code__line">
          <span className="tok-key">import</span>
          {' { Card } '}
          <span className="tok-key">from</span> <span className="tok-str">'@acme/ui'</span>;
        </div>
        {showCode && (
          <div className="demo-code__line demo-code__line--added">
            <span className="tok-key">import</span>
            {` { ${seq.label} } `}
            <span className="tok-key">from</span> <span className="tok-str">'@acme/ui'</span>;
          </div>
        )}
        <div className="demo-code__line"> </div>
        <div className="demo-code__line">
          <span className="tok-key">export function </span>
          <span className="tok-tag">Toolbar</span>
          {'() {'}
        </div>
        <div className="demo-code__line">
          {'  '}
          <span className="tok-key">return</span>
          {' ('}
        </div>
        <div className="demo-code__line">
          {'    <'}
          <span className="tok-tag">Card</span>
          {'>'}
        </div>
        {showCode ? (
          <div className="demo-code__line demo-code__line--added">
            {'      '}
            {seq.jsx}
          </div>
        ) : (
          <div
            className={`demo-drop-target${step === 'dragging' ? ' demo-drop-target--active' : ''}`}
          >
            drop here
          </div>
        )}
        <div className="demo-code__line">
          {'    </'}
          <span className="tok-tag">Card</span>
          {'>'}
        </div>
        <div className="demo-code__line">{'  );'}</div>
        <div className="demo-code__line">{'}'}</div>
      </pre>
    </div>
  );
}

/* ─── Tab 3: Quick Component Search ─────────────────────────── */

const SEARCH_QUERY = 'butt';
const SEARCH_RESULTS = [
  { name: 'Button', pkg: '@acme/ui', jsx: '<Button variant="primary" />' },
  { name: 'ButtonGroup', pkg: '@acme/ui', jsx: '<ButtonGroup>…</ButtonGroup>' },
  { name: 'IconButton', pkg: '@acme/ui', jsx: '<IconButton icon="…" />' },
] as const;

type SearchStep = 'idle' | 'typing' | 'results' | 'selecting' | 'injected' | 'pause';

function SearchDemo() {
  const [step, setStep] = useState<SearchStep>('idle');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const t: ReturnType<typeof setTimeout>[] = [];

    if (step === 'idle') {
      t.push(setTimeout(() => setStep('typing'), 900));
    }

    if (step === 'typing') {
      SEARCH_QUERY.split('').forEach((_, i) => {
        t.push(setTimeout(() => setQuery(SEARCH_QUERY.slice(0, i + 1)), i * 130));
      });
      t.push(setTimeout(() => setStep('results'), SEARCH_QUERY.length * 130 + 300));
    }

    if (step === 'results') {
      t.push(setTimeout(() => setStep('selecting'), 700));
    }

    if (step === 'selecting') {
      t.push(setTimeout(() => setStep('injected'), 500));
    }

    if (step === 'injected') {
      t.push(setTimeout(() => setStep('pause'), 100));
    }

    if (step === 'pause') {
      t.push(
        setTimeout(() => {
          setStep('idle');
          setQuery('');
        }, 3200),
      );
    }

    return () => t.forEach(clearTimeout);
  }, [step]);

  const showResults = step === 'results' || step === 'selecting' || step === 'injected' || step === 'pause';
  const showInjected = step === 'injected' || step === 'pause';

  return (
    <div className="demo-search-shell">
      <div className="demo-palette">
        <div className="demo-palette__bar">
          <Icon name="bolt" size={13} className="demo-palette__icon" />
          <span className="demo-palette__query">
            {query || <span className="demo-palette__placeholder">Search components…</span>}
            {step === 'typing' && <span className="demo-cursor">▋</span>}
          </span>
          <span className="demo-palette__kbd">⌃⌥⌘K</span>
          <span className="demo-palette__kbd demo-palette__kbd--win">Ctrl+Shift+Alt+K</span>
        </div>

        {showResults && (
          <div className="demo-palette__results">
            {SEARCH_RESULTS.map((r, i) => (
              <div
                key={r.name}
                className={`demo-palette__item${i === 0 && (step === 'selecting' || showInjected) ? ' demo-palette__item--active' : ''}`}
              >
                <Icon name="component" size={12} />
                <span className="demo-palette__item-name">{r.name}</span>
                <span className="demo-palette__item-pkg">{r.pkg}</span>
                <span className="demo-palette__item-jsx">{r.jsx}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <pre className="demo-code">
        <div className="demo-code__line">
          <span className="tok-key">import</span>
          {' { Card } '}
          <span className="tok-key">from</span> <span className="tok-str">'@acme/ui'</span>;
        </div>
        {showInjected && (
          <div className="demo-code__line demo-code__line--added">
            <span className="tok-key">import</span>
            {' { Button } '}
            <span className="tok-key">from</span> <span className="tok-str">'@acme/ui'</span>;
          </div>
        )}
        <div className="demo-code__line"> </div>
        <div className="demo-code__line">
          <span className="tok-key">export function </span>
          <span className="tok-tag">Toolbar</span>
          {'() {'}
        </div>
        <div className="demo-code__line">
          {'  '}
          <span className="tok-key">return</span>
          {' ('}
        </div>
        <div className="demo-code__line">
          {'    <'}
          <span className="tok-tag">Card</span>
          {'>'}
        </div>
        {showInjected ? (
          <div className="demo-code__line demo-code__line--added">
            {'      <'}
            <span className="tok-tag">Button</span>
            {' variant="'}
            <span className="tok-str">primary</span>
            {'" />'}
          </div>
        ) : (
          <div className="demo-code__line">
            {'      '}
            {(step === 'idle' || step === 'typing' || step === 'results' || step === 'selecting') && (
              <span className="demo-cursor">▋</span>
            )}
          </div>
        )}
        <div className="demo-code__line">
          {'    </'}
          <span className="tok-tag">Card</span>
          {'>'}
        </div>
        <div className="demo-code__line">{'  );'}</div>
        <div className="demo-code__line">{'}'}</div>
      </pre>
    </div>
  );
}

/* ─── Tab 4: Skill Generation ────────────────────────────────── */

const SKILL_COMPONENTS: ComponentName[] = ['Button', 'Badge', 'Avatar'];
type SkillStep = 'selecting' | 'ready' | 'generating' | 'done';

function SkillDemo() {
  const [step, setStep] = useState<SkillStep>('selecting');
  const [checked, setChecked] = useState<ComponentName[]>([]);
  const [lineCount, setLineCount] = useState(0);

  useEffect(() => {
    const t: ReturnType<typeof setTimeout>[] = [];

    if (step === 'selecting') {
      SKILL_COMPONENTS.forEach((name, i) => {
        t.push(
          setTimeout(
            () => {
              setChecked((prev) => [...prev, name]);
            },
            700 + i * 500,
          ),
        );
      });
      t.push(setTimeout(() => setStep('ready'), 700 + SKILL_COMPONENTS.length * 500 + 400));
    }

    if (step === 'generating') {
      setLineCount(0);
      SKILL_LINES.forEach((_, i) => {
        t.push(setTimeout(() => setLineCount(i + 1), i * 95));
      });
      t.push(setTimeout(() => setStep('done'), SKILL_LINES.length * 95 + 400));
    }

    if (step === 'done') {
      t.push(
        setTimeout(() => {
          setStep('selecting');
          setChecked([]);
          setLineCount(0);
        }, 3500),
      );
    }

    return () => t.forEach(clearTimeout);
  }, [step]);

  return (
    <div className="demo-shell">
      <div className="demo-sidebar">
        <div className="demo-sidebar__title">Export skill</div>
        {COMPONENTS.map((c) => {
          const isChecked = checked.includes(c);
          return (
            <div
              key={c}
              className={`demo-row demo-row--check${isChecked ? ' demo-row--checked' : ''}`}
            >
              <span className="demo-checkbox">{isChecked ? '✓' : ''}</span>
              {c}
            </div>
          );
        })}
        <button
          className={`demo-generate-btn${step === 'ready' ? ' demo-generate-btn--active' : ''}`}
          onClick={() => {
            if (step === 'ready') setStep('generating');
          }}
        >
          <Icon name="sparkles" size={13} />
          Generate skill
        </button>
      </div>

      <div className="demo-skill-output">
        {step === 'generating' || step === 'done' ? (
          <>
            <div className="demo-skill-output__bar">
              <Icon name="file" size={13} />
              <span>snapds.skill.yaml</span>
              {step === 'done' && (
                <span className="demo-skill-output__badge">
                  <Icon name="check" size={11} /> saved
                </span>
              )}
            </div>
            <pre className="demo-skill-output__code">
              {SKILL_LINES.slice(0, lineCount).map((line, i) => (
                <div key={i} className="demo-code__line">
                  {line || ' '}
                </div>
              ))}
              {step === 'generating' && <span className="demo-cursor">▋</span>}
            </pre>
          </>
        ) : (
          <div className="demo-skill-empty">
            {step === 'ready' ? (
              <>
                <Icon name="sparkles" size={28} />
                <span>Ready — click Generate</span>
              </>
            ) : (
              <>
                <Icon name="layers" size={28} />
                <span>Select components to export</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Tabs wrapper ────────────────────────────────────────────── */

const TABS = [
  { id: 'browse', label: 'Browse & Props', icon: 'grid' as const },
  { id: 'drop', label: 'Drop to Code', icon: 'cursor' as const },
  { id: 'search', label: 'Quick Search', icon: 'bolt' as const },
  { id: 'skill', label: 'Generate Skill', icon: 'sparkles' as const },
];

export function DemoShowcase() {
  const [active, setActive] = useState('browse');

  return (
    <section id="demo" className="section section--ruled">
      <div className="container">
        <div className="section__head">
          <p className="eyebrow">See it in action</p>
          <h2 className="section__title">Every workflow, zero context switching</h2>
          <p className="section__lead">
            Everything happens inside VS Code — browse, drop, generate — without touching a browser
            or a docs page.
          </p>
        </div>

        <div className="demo-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`demo-tab${active === t.id ? ' demo-tab--active' : ''}`}
              onClick={() => setActive(t.id)}
            >
              <Icon name={t.icon} size={15} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="demo-panel glass">
          <div className="demo-panel__bar" aria-hidden="true">
            <span className="editor__dot" style={{ background: '#ff5f57' }} />
            <span className="editor__dot" style={{ background: '#febc2e' }} />
            <span className="editor__dot" style={{ background: '#28c840' }} />
            <span className="demo-panel__title">Snapds — VS Code</span>
          </div>
          {active === 'browse' && <BrowseDemo />}
          {active === 'drop' && <DropDemo />}
          {active === 'search' && <SearchDemo />}
          {active === 'skill' && <SkillDemo />}
        </div>
      </div>
    </section>
  );
}
