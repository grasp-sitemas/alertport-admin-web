import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock sessionStorage / localStorage for tests
const storage = new Map<string, string>();
const storageMock = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
  clear: () => storage.clear(),
  key: () => null,
  length: 0,
};

Object.defineProperty(window, 'sessionStorage', { value: storageMock });
Object.defineProperty(window, 'localStorage', { value: storageMock });

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));
