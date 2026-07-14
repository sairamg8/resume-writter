import { useRef, useEffect } from 'react';
import {
  Bold, Italic, Underline, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Link,
} from 'lucide-react';

export default function RichTextEditor({ label, value, onChange, placeholder, rows = 3 }) {
  const ref = useRef(null);
  const isComposing = useRef(false);

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = value || '';
    }
  }, []); // only on mount — cursor resets if synced on every value change

  function exec(cmd, val = null) {
    ref.current?.focus();
    document.execCommand(cmd, false, val);
    onChange(ref.current?.innerHTML || '');
  }

  function insertLink() {
    const url = window.prompt('Paste URL (e.g. https://github.com/you):');
    if (url && url.trim()) exec('createLink', url.trim());
  }

  function onInput() {
    if (!isComposing.current) onChange(ref.current?.innerHTML || '');
  }

  const minH = `${rows * 1.7}rem`;

  return (
    <div>
      {label && <label className="block text-xs text-gray-500 mb-1">{label}</label>}
      <div className="border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">

        {/* Toolbar */}
        <div className="flex items-center flex-wrap gap-0.5 px-1.5 py-1 bg-gray-50 border-b border-gray-100">

          {/* Format group */}
          <Btn title="Bold (Ctrl+B)" onExec={() => exec('bold')}><Bold size={12} /></Btn>
          <Btn title="Italic (Ctrl+I)" onExec={() => exec('italic')}><Italic size={12} /></Btn>
          <Btn title="Underline (Ctrl+U)" onExec={() => exec('underline')}><Underline size={12} /></Btn>

          <Sep />

          {/* List group */}
          <Btn title="Bullet list" onExec={() => exec('insertUnorderedList')}><List size={12} /></Btn>
          <Btn title="Numbered list" onExec={() => exec('insertOrderedList')}><ListOrdered size={12} /></Btn>

          <Sep />

          {/* Link */}
          <Btn title="Insert link" onExec={insertLink}><Link size={12} /></Btn>

          <Sep />

          {/* Alignment group */}
          <Btn title="Align left" onExec={() => exec('justifyLeft')}><AlignLeft size={12} /></Btn>
          <Btn title="Align center" onExec={() => exec('justifyCenter')}><AlignCenter size={12} /></Btn>
          <Btn title="Align right" onExec={() => exec('justifyRight')}><AlignRight size={12} /></Btn>
          <Btn title="Justify" onExec={() => exec('justifyFull')}><AlignJustify size={12} /></Btn>
        </div>

        {/* Editable area */}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={onInput}
          onCompositionStart={() => { isComposing.current = true; }}
          onCompositionEnd={() => { isComposing.current = false; onInput(); }}
          className="px-3 py-2 text-sm focus:outline-none empty-placeholder rich-text-output"
          style={{ minHeight: minH }}
          data-placeholder={placeholder}
        />
      </div>
    </div>
  );
}

function Btn({ title, onExec, children }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onExec(); }}
      className="p-1 rounded text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-4 bg-gray-200 mx-0.5 self-center" />;
}
