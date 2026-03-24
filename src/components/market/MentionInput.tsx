import { useState, useRef, useCallback, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CommentService } from '@/services/CommentService';
import { cn } from '@/lib/utils';

interface MentionUser {
  user_id: string;
  display_name: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onMentionsChange: (mentions: string[]) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  minHeight?: string;
}

export function MentionInput({
  value,
  onChange,
  onMentionsChange,
  placeholder = 'Escreva seu comentário...',
  autoFocus = false,
  className,
  minHeight = '80px',
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<MentionUser[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionsRef = useRef<Map<string, string>>(new Map()); // displayName -> userId

  // Debounced search
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const searchUsers = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await CommentService.searchUsersForMention(query);
      setSuggestions(results);
      setSelectedIndex(0);
    } catch (error) {
      console.error('Error searching users:', error);
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const cursor = e.target.selectionStart || 0;

    // Find @ symbol before cursor
    const beforeCursor = text.slice(0, cursor);
    const atIndex = beforeCursor.lastIndexOf('@');

    if (atIndex !== -1 && atIndex < cursor) {
      const query = beforeCursor.slice(atIndex + 1);
      // Only show suggestions if no space after @
      if (!query.includes(' ') && !query.includes('\n')) {
        setMentionQuery(query);
        setMentionStartIndex(atIndex);
        setShowSuggestions(true);

        // Debounce search
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
        }
        searchTimeoutRef.current = setTimeout(() => {
          searchUsers(query);
        }, 300);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }

    onChange(text);
  };

  const selectMention = (user: MentionUser) => {
    if (mentionStartIndex === -1) return;

    const before = value.slice(0, mentionStartIndex);
    const after = value.slice(mentionStartIndex + mentionQuery.length + 1);
    const newValue = `${before}@${user.display_name} ${after}`;

    // Track the mention
    mentionsRef.current.set(user.display_name, user.user_id);

    onChange(newValue);
    setShowSuggestions(false);
    setSuggestions([]);
    setMentionQuery('');
    setMentionStartIndex(-1);

    // Update mentions list
    updateMentionsList(newValue);

    // Focus back on textarea
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursor = mentionStartIndex + user.display_name.length + 2;
        textareaRef.current.setSelectionRange(newCursor, newCursor);
      }
    }, 0);
  };

  const updateMentionsList = useCallback((text: string) => {
    const mentionRegex = /@(\w+)/g;
    const matches = text.matchAll(mentionRegex);
    const userIds: string[] = [];

    for (const match of matches) {
      const displayName = match[1];
      const userId = mentionsRef.current.get(displayName);
      if (userId && !userIds.includes(userId)) {
        userIds.push(userId);
      }
    }

    onMentionsChange(userIds);
  }, [onMentionsChange]);

  // Update mentions when value changes externally
  useEffect(() => {
    updateMentionsList(value);
  }, [value, updateMentionsList]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        break;
      case 'Enter':
        if (suggestions[selectedIndex]) {
          e.preventDefault();
          selectMention(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        break;
      case 'Tab':
        if (suggestions[selectedIndex]) {
          e.preventDefault();
          selectMention(suggestions[selectedIndex]);
        }
        break;
    }
  };

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn('resize-none', className)}
        style={{ minHeight }}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 top-full mt-1 w-64 p-1 bg-popover border border-border rounded-md shadow-md z-50">
          {isSearching ? (
            <div className="p-2 text-sm text-muted-foreground text-center">
              Buscando...
            </div>
          ) : (
            <div className="space-y-0.5">
              {suggestions.map((user, index) => (
                <button
                  key={user.user_id}
                  onClick={() => selectMention(user)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors text-left',
                    index === selectedIndex
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  )}
                >
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs">
                      {user.display_name[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium truncate">@{user.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
