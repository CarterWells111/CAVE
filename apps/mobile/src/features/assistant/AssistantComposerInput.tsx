import { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { TextInput, type TextInputProps } from "react-native";

type Selection = { start: number; end: number };
export type AssistantComposerReplacement = {
  revision: string | number;
  text: string;
  focus?: boolean;
  selection?: Selection;
};
export type AssistantComposerReplaceOptions = {
  focus?: boolean;
  selection?: Selection;
  /** External history operations already update their own draft. */
  emitChange?: boolean;
};
export type AssistantComposerInputHandle = {
  getText(): string;
  getSelection(): Selection | null;
  replaceText(text: string, options?: AssistantComposerReplaceOptions): void;
  clear(options?: Pick<AssistantComposerReplaceOptions, "emitChange">): void;
  focus(): void;
  blur(): void;
};
export type AssistantComposerInputProps = Omit<TextInputProps, "value" | "defaultValue" | "selection" | "onChangeText"> & {
  /** Read once; history echoes after native edits must never become a value prop. */
  initialValue?: string;
  /** Change revision only for an explicit external operation, never for keystrokes. */
  replacement?: AssistantComposerReplacement;
  onChangeText(text: string): void;
};

type NativeDraft = {
  generation: number;
  externalRevision: string | number | undefined;
  text: string;
  focus: boolean;
  selection: Selection | undefined;
};
const constrainSelection = (selection: Selection, text: string): Selection => ({
  start: Math.max(0, Math.min(text.length, selection.start)),
  end: Math.max(0, Math.min(text.length, selection.end)),
});

/** Native owns composition and selection. JS only replaces text for explicit actions. */
export const AssistantComposerInput = forwardRef<AssistantComposerInputHandle, AssistantComposerInputProps>(function AssistantComposerInput({
  initialValue = "", replacement, onChangeText, onSelectionChange, editable = true, readOnly, autoFocus, ...props
}, forwardedRef) {
  const input = useRef<TextInput>(null);
  const [nativeDraft, setNativeDraft] = useState<NativeDraft>(() => ({
    generation: 0, externalRevision: replacement?.revision,
    text: replacement?.text ?? initialValue, focus: replacement?.focus ?? false,
    selection: replacement?.selection,
  }));
  const generation = useRef(0);
  const text = useRef(nativeDraft.text);
  const selection = useRef<Selection | null>(nativeDraft.selection ?? null);
  const change = useRef(onChangeText);
  const selectionChange = useRef(onSelectionChange);
  const canEdit = useRef(editable && !readOnly);
  change.current = onChangeText;
  selectionChange.current = onSelectionChange;
  canEdit.current = editable && !readOnly;

  if (replacement && !Object.is(replacement.revision, nativeDraft.externalRevision)) {
    const nextGeneration = ++generation.current;
    text.current = replacement.text;
    selection.current = replacement.selection ? constrainSelection(replacement.selection, replacement.text) : null;
    // Render-time reset prevents an old conversation from reaching a committed frame.
    setNativeDraft({ generation: nextGeneration, externalRevision: replacement.revision,
      text: replacement.text, focus: replacement.focus ?? false, selection: selection.current ?? undefined });
  }

  const replaceText = useCallback((next: string, options: AssistantComposerReplaceOptions = {}) => {
    const nextGeneration = ++generation.current;
    const nextSelection = constrainSelection(options.selection ?? { start: next.length, end: next.length }, next);
    const focus = options.focus ?? input.current?.isFocused?.() ?? false;
    text.current = next;
    selection.current = nextSelection;
    setNativeDraft(current => ({ ...current, generation: nextGeneration, text: next, focus, selection: nextSelection }));
    if (options.emitChange !== false) change.current(next);
  }, []);
  useImperativeHandle(forwardedRef, () => ({
    getText: () => text.current,
    getSelection: () => selection.current,
    replaceText,
    clear: options => replaceText("", options),
    focus: () => input.current?.focus(),
    blur: () => input.current?.blur(),
  }), [replaceText]);
  useLayoutEffect(() => {
    if (nativeDraft.focus) input.current?.focus();
    if (nativeDraft.selection) {
      const next = constrainSelection(nativeDraft.selection, nativeDraft.text);
      input.current?.setSelection?.(next.start, next.end);
    }
  }, [nativeDraft]);

  const inputGeneration = nativeDraft.generation;
  return <TextInput
    {...props}
    key={inputGeneration}
    ref={input}
    defaultValue={nativeDraft.text}
    editable={editable}
    readOnly={readOnly}
    autoFocus={autoFocus || nativeDraft.focus}
    onChangeText={next => {
      if (generation.current !== inputGeneration || !canEdit.current) return;
      text.current = next;
      change.current(next);
    }}
    onSelectionChange={event => {
      if (generation.current !== inputGeneration) return;
      selection.current = event.nativeEvent.selection;
      selectionChange.current?.(event);
    }}
  />;
});
