import { Request, Response, NextFunction } from 'express';

export const rate-limiter = (req: Request, res: Response, next: NextFunction) => {
  next();
};
