import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './validate.js';
import { Prisma } from '@prisma/client';

export interface ErrorResponse {
  error: string;
  message: string;
  details?: any;
}

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error('Error:', err);

  if (err instanceof ValidationError) {
    const details = err.errors.errors.map(e => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Invalid request data',
      details,
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: 'ConflictError',
        message: 'Resource already exists',
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        error: 'NotFoundError',
        message: 'Resource not found',
      });
    }
  }

  if (err.message === 'User not found') {
    return res.status(404).json({
      error: 'NotFoundError',
      message: err.message,
    });
  }

  // Default 500 error
  res.status(500).json({
    error: 'InternalServerError',
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : err.message,
  });
}
