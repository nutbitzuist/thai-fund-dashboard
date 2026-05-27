// ─────────────────────────────────────────────
// lib/errors.ts
// Structured error handling for Thai Fund Dashboard
// ─────────────────────────────────────────────

import { AppErrorCode, APP_ERRORS } from '@/types';
import { NextResponse } from 'next/server';

export class AppError extends Error {
  code: AppErrorCode;
  messageTh: string;
  statusCode: number;

  constructor(code: AppErrorCode, statusCode = 500, overrideMessage?: string) {
    const errorDef = APP_ERRORS[code];
    super(overrideMessage ?? errorDef.message);
    this.code = code;
    this.messageTh = errorDef.messageTh;
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

export function createErrorResponse(
  code: AppErrorCode,
  statusCode = 500,
  detail?: string
): NextResponse {
  const errorDef = APP_ERRORS[code];
  return NextResponse.json(
    {
      error: {
        code,
        message: errorDef.message,
        messageTh: errorDef.messageTh,
        detail: detail ?? null,
      },
    },
    { status: statusCode }
  );
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

export function handleRouteError(err: unknown): NextResponse {
  console.error('[Route Error]', err);

  if (isAppError(err)) {
    return createErrorResponse(err.code, err.statusCode);
  }

  if (err instanceof Error) {
    // Detect Prisma errors
    if (err.message.includes('prisma') || err.message.includes('database')) {
      return createErrorResponse('DATABASE_ERROR', 500);
    }
  }

  return createErrorResponse('DATABASE_ERROR', 500);
}
