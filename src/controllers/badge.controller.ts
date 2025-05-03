import { Request, Response } from 'express';

export const badgeController = {
  async example(req: Request, res: Response) {
    res.send('badge controller working');
  }
};
