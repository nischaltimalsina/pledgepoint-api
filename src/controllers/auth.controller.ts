import { Request, Response } from 'express';

export const authController = {
  async example(req: Request, res: Response) {
    res.send('auth controller working');
  }
};
