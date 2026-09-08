/**
 * Browser implementation of React Native's Alert API.
 *
 * react-native-web's Alert is an empty stub, so validation messages and error
 * reports never reach the user on web. This maps the same call signature onto
 * window.confirm/alert.
 *
 * Buttons: a cancel-style button (or a second button) maps to confirm()'s
 * dismiss path; anything else runs its onPress. More than two buttons cannot be
 * represented faithfully by a native dialog, so the first non-cancel button
 * wins — matching how the app's own two-button prompts read.
 */

type AlertButton = {
  text?: string;
  onPress?: (value?: string) => void;
  style?: 'default' | 'cancel' | 'destructive';
};

function show(title?: string, message?: string, buttons?: AlertButton[]): void {
  const body = [title, message].filter(Boolean).join('\n\n');

  if (!buttons || buttons.length === 0) {
    window.alert(body);
    return;
  }

  const cancel = buttons.find((b) => b.style === 'cancel');
  const confirmButton = buttons.find((b) => b.style !== 'cancel');

  // Single button: acknowledge-only, so a plain alert is the honest mapping.
  if (buttons.length === 1) {
    window.alert(body);
    buttons[0].onPress?.();
    return;
  }

  const accepted = window.confirm(body);
  if (accepted) {
    confirmButton?.onPress?.();
  } else {
    cancel?.onPress?.();
  }
}

export const Alert = { alert: show };
