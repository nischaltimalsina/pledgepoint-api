import { Request, Response, NextFunction } from 'express';

export const gamification_middleware = (req: Request, res: Response, next: NextFunction) => {
  next();
};
