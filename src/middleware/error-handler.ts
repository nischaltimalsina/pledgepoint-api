import { Request, Response, NextFunction } from 'express';

export const error-handler = (req: Request, res: Response, next: NextFunction) => {
  next();
};
