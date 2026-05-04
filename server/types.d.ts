import type { JwtPayload } from './index'

declare global {
  namespace Express {
    interface Request {
      auth?: JwtPayload
    }
  }
}

export {}
