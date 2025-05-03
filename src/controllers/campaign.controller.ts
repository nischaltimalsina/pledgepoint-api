import { Request, Response } from 'express';

export const campaignController = {
  async example(req: Request, res: Response) {
    res.send('campaign controller working');
  }
};
