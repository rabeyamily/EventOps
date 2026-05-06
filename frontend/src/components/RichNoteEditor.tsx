'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface RichNoteEditorProps {
  content: string;
  onChange: (html: string) => void;
  saving?: boolean;
  saved?: boolean;
  placeholder?: string;
  compact?: boolean;
}

const FONT_COLORS = [
  { label: 'Black', value: '#000000' },
  { label: 'Dark Gray', value: '#4b5563' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Orange', value: '#ea580c' },
  { label: 'Green', value: '#16a34a' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Purple', value: '#7c3aed' },
  { label: 'Pink', value: '#db2777' },
];

interface ActiveFormats {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikeThrough: boolean;
}

export default function RichNoteEditor({ content, onChange, saving, saved, placeholder, compact = false }: RichNoteEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [currentFontColor, setCurrentFontColor] = useState('#4b5563');
  const [isEditorEmpty, setIsEditorEmpty] = useState(true);
  const [activeFormats, setActiveFormats] = useState<ActiveFormats>({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
  });
  const isInternalChange = useRef(false);

  const updateActiveFormats = useCallback(() => {
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
    });
  }, []);

  const saveSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editorRef.current) return;
    const range = selection.getRangeAt(0);
    if (editorRef.current.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    if (!savedRangeRef.current) return;
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(savedRangeRef.current);
  }, []);

  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      if (editorRef.current.innerHTML !== content) {
        editorRef.current.innerHTML = content || '';
      }
    }
    const plain = (editorRef.current?.textContent || '').replace(/\u00a0/g, ' ').trim();
    setIsEditorEmpty(plain.length === 0);
    isInternalChange.current = false;
  }, [content]);

  useEffect(() => {
    const handleSelectionChange = () => {
      if (editorRef.current?.contains(document.activeElement) ||
          editorRef.current === document.activeElement) {
        saveSelection();
        updateActiveFormats();
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [saveSelection, updateActiveFormats]);

  useEffect(() => {
    const onDocumentMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-color-picker-group]')) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener('mousedown', onDocumentMouseDown);
    return () => document.removeEventListener('mousedown', onDocumentMouseDown);
  }, []);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      isInternalChange.current = true;
      const plain = (editorRef.current.textContent || '').replace(/\u00a0/g, ' ').trim();
      setIsEditorEmpty(plain.length === 0);
      onChange(editorRef.current.innerHTML);
      updateActiveFormats();
    }
  }, [onChange, updateActiveFormats]);

  const execCmd = useCallback((command: string, value?: string) => {
    restoreSelection();
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
    updateActiveFormats();
  }, [onChange, restoreSelection, updateActiveFormats]);

  const applyFontColor = useCallback((color: string) => {
    execCmd('styleWithCSS', 'true');
    execCmd('foreColor', color);
    setCurrentFontColor(color);
    setShowColorPicker(false);
  }, [execCmd]);

  const ToolBtn = ({ active, onClick, children, title }: {
    active?: boolean;
    onClick: () => void;
    children: React.ReactNode;
    title: string;
  }) => (
    <button
      type="button"
      onPointerDown={(e) => { e.preventDefault(); onClick(); }}
      onMouseDown={(e) => { e.preventDefault(); }}
      onClick={(e) => { e.preventDefault(); }}
      title={title}
      className={`relative flex items-center justify-center w-8 h-8 rounded text-base transition-all duration-150
        ${active
          ? 'bg-[#57068c] text-white shadow-sm'
          : 'text-gray-700 hover:bg-gray-200 hover:text-gray-900'
        }`}
    >
      {children}
    </button>
  );

  return (
    <div className="rounded-lg border border-gray-300 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[#57068c]/20 focus-within:border-[#57068c]/50 transition">
      {/* Toolbar */}
      <div className={`flex items-center gap-0.5 border-b border-gray-300 bg-gray-50 flex-wrap ${compact ? 'px-2 py-1.5' : 'px-2 py-1.5'}`}>
        <ToolBtn active={activeFormats.bold} onClick={() => execCmd('bold')} title="Bold (Ctrl+B)">
          <span className="font-bold text-sm">B</span>
        </ToolBtn>
        <ToolBtn active={activeFormats.italic} onClick={() => execCmd('italic')} title="Italic (Ctrl+I)">
          <span className="italic text-sm font-serif">I</span>
        </ToolBtn>
        <ToolBtn active={activeFormats.underline} onClick={() => execCmd('underline')} title="Underline (Ctrl+U)">
          <span className="underline text-sm">U</span>
        </ToolBtn>
        <ToolBtn active={activeFormats.strikeThrough} onClick={() => execCmd('strikeThrough')} title="Strikethrough">
          <span className="line-through text-sm">S</span>
        </ToolBtn>

        <div className="w-px h-5 bg-gray-400 mx-1" />

        {/* Font Color */}
        <div className="relative" data-color-picker-group>
          <ToolBtn
            active={showColorPicker}
            onClick={() => { setShowColorPicker(!showColorPicker); }}
            title="Font Color"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5.5 15.5L10 4.5l4.5 11" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 12.2h6" strokeLinecap="round" />
            </svg>
            <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full" style={{ backgroundColor: currentFontColor }} />
          </ToolBtn>
          {showColorPicker && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-2 flex gap-1.5">
              {FONT_COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    applyFontColor(c.value);
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => e.preventDefault()}
                  className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-125 ${currentFontColor === c.value ? 'border-[#57068c]' : 'border-gray-200 hover:border-gray-400'}`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Editor area */}
      <div className="relative">
        {isEditorEmpty && (
          <div
            className={`${compact ? 'px-2.5 pt-2.5 text-sm' : 'px-3 pt-3 text-sm'} absolute inset-0 text-gray-500 pointer-events-none`}
          >
            {placeholder || 'Write here...'}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onKeyUp={updateActiveFormats}
          onMouseUp={updateActiveFormats}
          onBlur={() => { setShowColorPicker(false); }}
          className={`${compact ? 'min-h-[92px] max-h-[220px] p-2.5 text-sm' : 'min-h-[120px] max-h-[300px] p-3 text-sm'} overflow-y-auto text-gray-900 outline-none`}
        />
      </div>
    </div>
  );
}
