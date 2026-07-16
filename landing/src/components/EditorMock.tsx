import { Icon } from './icons';

export function EditorMock() {
  return (
    <div
      className="editor"
      role="img"
      aria-label="The Snapds gallery in VS Code: dragging a Button component into a React file writes the JSX and merges its import automatically."
    >
      <div className="editor__bar" aria-hidden="true">
        <span className="editor__dot" style={{ background: '#ff5f57' }} />
        <span className="editor__dot" style={{ background: '#febc2e' }} />
        <span className="editor__dot" style={{ background: '#28c840' }} />
        <span className="editor__title">Toolbar.tsx — my-app</span>
      </div>

      <div className="editor__body">
        <aside className="editor__side" aria-hidden="true">
          <div className="editor__side-title">Components</div>
          <div className="tree-item tree-item--active">
            <Icon name="grid" size={15} /> @acme/ui
          </div>
          <div className="tree-item tree-item--drag">
            <Icon name="cursor" size={15} /> Button
          </div>
          <div className="tree-item">
            <Icon name="grid" size={15} /> Card
          </div>
          <div className="tree-item">
            <Icon name="grid" size={15} /> Badge
          </div>
          <div className="tree-item">
            <Icon name="grid" size={15} /> Avatar
          </div>
        </aside>

        <pre className="editor__code" aria-hidden="true">
          <div className="code-line">
            <span className="tok-key">import</span>
            {' { Card } '}
            <span className="tok-key">from</span> <span className="tok-str">'@acme/ui'</span>
            {';'}
          </div>
          <div className="code-line code-added">
            <span className="tok-key">import</span>
            {' { Button } '}
            <span className="tok-key">from</span> <span className="tok-str">'@acme/ui'</span>
            {';'}
          </div>
          <div className="code-line"> </div>
          <div className="code-line">
            <span className="tok-key">export function</span>{' '}
            <span className="tok-tag">Toolbar</span>
            {'() {'}
          </div>
          <div className="code-line">
            {'  '}
            <span className="tok-key">return</span> (
          </div>
          <div className="code-line">
            {'    <'}
            <span className="tok-tag">Card</span>
            {'>'}
          </div>
          <div className="code-line code-added">
            {'      <'}
            <span className="tok-tag">Button</span> <span className="tok-attr">variant</span>=
            <span className="tok-str">"primary"</span>
            {'>'}
          </div>
          <div className="code-line code-added">{'        Save changes'}</div>
          <div className="code-line code-added">
            {'      </'}
            <span className="tok-tag">Button</span>
            {'>'}
          </div>
          <div className="code-line">
            {'    </'}
            <span className="tok-tag">Card</span>
            {'>'}
          </div>
          <div className="code-line">{'  );'}</div>
          <div className="code-line">{'}'}</div>
        </pre>
      </div>
    </div>
  );
}
