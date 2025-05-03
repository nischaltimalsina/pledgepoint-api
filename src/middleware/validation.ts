import { Request, Response, NextFunction } from 'express';

export const validation_middleware = (req: Request, res: Response, next: NextFunction) => {
  next();
};
