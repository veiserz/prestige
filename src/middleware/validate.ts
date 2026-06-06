import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodType, ZodTypeDef } from 'zod';

export class ValidationError extends Error {
  constructor(public errors: z.ZodError) {
    super('Validation failed');
    this.name = 'ValidationError';
  }
}

export function validate<TOutput, TInput = TOutput>(
  schema: ZodType<TOutput, ZodTypeDef, TInput>,
  target: 'body' | 'params' | 'query'
) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req[target];
      req[target] = schema.parse(data);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new ValidationError(error));
      } else {
        next(error);
      }
    }
  };
}
