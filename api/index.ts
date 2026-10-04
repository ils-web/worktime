import app from '../packages/api/src/app';

export default function handler(req: any, res: any) {
  return app(req, res);
}


