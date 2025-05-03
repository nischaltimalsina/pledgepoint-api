import { Request, Response } from 'express';

export const districtController = {
  async example(req: Request, res: Response) {
    res.send('district controller working');
  }
};
