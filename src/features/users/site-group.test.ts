import { describe, it, expect } from 'vitest';
import { userFormSchema, DEFAULT_USER_VALUES } from './schemas';

describe('operator site group assignment', () => {
  it('preserves the selected group in the user payload', () => {
    const result = userFormSchema.parse({ ...DEFAULT_USER_VALUES, firstName: 'Operador', lastName: 'Teste', email: 'op@example.test', client: 'client', siteGroup: 'group-1' });
    expect(result).toHaveProperty('siteGroup', 'group-1');
  });
});
