import { describe, it, expect } from 'vitest';
import { env, isFirebaseConfigured } from '@/config/env';

describe('env config', () => {
  it('exposes an API url string', () => {
    expect(typeof env.apiUrl).toBe('string');
    expect(env.apiUrl.length).toBeGreaterThan(0);
  });

  it('exposes a chat url string', () => {
    expect(typeof env.chatUrl).toBe('string');
  });

  it('has firebase shape', () => {
    expect(env.firebase).toHaveProperty('apiKey');
    expect(env.firebase).toHaveProperty('projectId');
    expect(env.firebase).toHaveProperty('appId');
  });

  it('isFirebaseConfigured reflects config completeness', () => {
    const result = isFirebaseConfigured();
    expect(typeof result).toBe('boolean');
  });
});
