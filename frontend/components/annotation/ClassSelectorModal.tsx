/**
 * Class Selector Modal
 *
 * Modal dialog for selecting a class after drawing an annotation
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useAnnotationStore } from '@/lib/stores/annotationStore';

interface ClassSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (classId: string, className: string) => void;
  position?: { x: number; y: number };
}

export default function ClassSelectorModal({
  isOpen,
  onClose,
  onSelect,
  position,
}: ClassSelectorModalProps) {
  const { project } = useAnnotationStore();
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get classes from project
  const classes = project?.classes ? Object.entries(project.classes) : [];

  // Filter classes by search
  const filteredClasses = classes.filter(([_, classInfo]) =>
    classInfo.name.toLowerCase().includes(search.toLowerCase())
  );

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setSearch('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredClasses.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredClasses.length > 0) {
            const [classId, classInfo] = filteredClasses[selectedIndex];
            onSelect(classId, classInfo.name);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        // Number keys 1-9 for quick selection
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          e.preventDefault();
          const index = parseInt(e.key) - 1;
          if (index < filteredClasses.length) {
            const [classId, classInfo] = filteredClasses[index];
            onSelect(classId, classInfo.name);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredClasses, selectedIndex, onSelect, onClose]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        ref={modalRef}
        className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl w-[400px] max-h-[600px] flex flex-col"
        style={
          position
            ? {
                position: 'fixed',
                top: position.y,
                left: position.x,
                transform: 'translate(10px, 10px)',
              }
            : undefined
        }
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Select Class</h2>
          <p className="text-xs text-gray-400 mt-1">
            Use arrow keys to navigate, Enter to select, or press 1-9 for quick selection
          </p>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-700">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search classes..."
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
          />
        </div>

        {/* Class List */}
        <div className="flex-1 overflow-y-auto">
          {filteredClasses.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400">
              {search ? 'No classes match your search' : 'No classes available'}
            </div>
          ) : (
            <div className="p-2">
              {filteredClasses.map(([classId, classInfo], index) => (
                <button
                  key={classId}
                  onClick={() => onSelect(classId, classInfo.name)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    index === selectedIndex
                      ? 'bg-violet-500/20 border border-violet-500'
                      : 'hover:bg-gray-700 border border-transparent'
                  }`}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  {/* Color indicator */}
                  <div
                    className="w-4 h-4 rounded flex-shrink-0"
                    style={{ backgroundColor: classInfo.color }}
                  />

                  {/* Class name */}
                  <span className="flex-1 text-white">{classInfo.name}</span>

                  {/* Shortcut hint (for first 9 classes) */}
                  {index < 9 && (
                    <span className="text-xs text-gray-500 font-mono">
                      {index + 1}
                    </span>
                  )}

                  {/* Selected indicator */}
                  {index === selectedIndex && (
                    <span className="text-violet-400 text-sm">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
