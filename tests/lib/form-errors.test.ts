import { describe, expect, it, vi, beforeEach } from 'vitest';
import { toastFirstError } from '@/lib/form-errors';

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

import { toast } from 'sonner';

describe('toastFirstError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const translate = (key: string) => {
    const dict: Record<string, string> = {
      'validation.required': 'Required',
      'validation.email': 'Invalid email',
      'notifications.validationFailed': 'Please review the fields before saving.',
    };
    return dict[key] ?? key;
  };

  it('calls toast.error with the fallback title when errors are non-empty', () => {
    const handler = toastFirstError(translate);
    handler({ firstName: { message: 'validation.required', type: 'required' } });
    expect(toast.error).toHaveBeenCalledWith(
      'Please review the fields before saving.',
      expect.objectContaining({ description: 'Required' }),
    );
  });

  it('walks nested errors (e.g. companyUser.subtype)', () => {
    const handler = toastFirstError(translate);
    handler({
      companyUser: {
        subtype: { message: 'validation.required', type: 'required' },
      } as never,
    });
    expect(toast.error).toHaveBeenCalledWith(
      'Please review the fields before saving.',
      expect.objectContaining({ description: 'Required' }),
    );
  });

  it('falls back to the raw key when translation returns the key itself', () => {
    const noopTranslate = (k: string) => k;
    const handler = toastFirstError(noopTranslate);
    handler({ email: { message: 'validation.email', type: 'required' } });
    expect(toast.error).toHaveBeenCalledWith(
      'notifications.validationFailed',
      expect.objectContaining({ description: 'validation.email' }),
    );
  });

  it('still shows the fallback toast even when no field has a message', () => {
    const handler = toastFirstError(translate);
    handler({ email: { type: 'required' } as never });
    expect(toast.error).toHaveBeenCalledWith(
      'Please review the fields before saving.',
      expect.objectContaining({ description: undefined }),
    );
  });
});
