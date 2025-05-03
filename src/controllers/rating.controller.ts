import { Request, Response } from 'express';

export const ratingController = {
  async example(req: Request, res: Response) {
    res.send('rating controller working');
  }
};
