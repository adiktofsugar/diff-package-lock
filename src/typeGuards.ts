import type { ErrorWithCode } from './interfaces';

// From Tree.ts
export function isErrorWithCode(error: unknown): error is ErrorWithCode {
  return error instanceof Error && 'code' in error;
}