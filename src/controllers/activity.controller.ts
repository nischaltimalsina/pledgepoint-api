import { Request, Response } from 'express';

export const activityController = {
  async example(req: Request, res: Response) {
    res.send('activity controller working');
  }
};
