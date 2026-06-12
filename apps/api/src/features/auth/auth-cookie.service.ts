import { Injectable } from "@nestjs/common";
import { Response } from "express";

import {
  AUTH_ACCESS_COOKIE_NAME,
  AUTH_ACCESS_TOKEN_TTL_SECONDS,
  AUTH_REFRESH_COOKIE_NAME,
  AUTH_REFRESH_TOKEN_TTL_SECONDS,
  AUTH_SESSION_COOKIE_NAME,
} from "./auth.tokens";

@Injectable()
export class AuthCookieService {
  private getCookieOptions(maxAgeMs: number) {
    const isProd = process.env.NODE_ENV === "production";

    return {
      httpOnly: true,
      maxAge: maxAgeMs,
      path: "/",
      sameSite: "lax" as const,
      secure: isProd,
    };
  }

  setAuthCookies(
    response: Response,
    payload: {
      accessToken?: string;
      refreshToken?: string;
      sessionId?: string;
    },
  ): void {
    if (payload.accessToken) {
      response.cookie(
        AUTH_ACCESS_COOKIE_NAME,
        payload.accessToken,
        this.getCookieOptions(AUTH_ACCESS_TOKEN_TTL_SECONDS * 1000),
      );
    }

    if (payload.refreshToken) {
      response.cookie(
        AUTH_REFRESH_COOKIE_NAME,
        payload.refreshToken,
        this.getCookieOptions(AUTH_REFRESH_TOKEN_TTL_SECONDS * 1000),
      );
    }

    if (payload.sessionId) {
      response.cookie(
        AUTH_SESSION_COOKIE_NAME,
        payload.sessionId,
        this.getCookieOptions(AUTH_REFRESH_TOKEN_TTL_SECONDS * 1000),
      );
    }
  }

  clearAuthCookies(response: Response): void {
    const options = this.getCookieOptions(0);
    response.clearCookie(AUTH_ACCESS_COOKIE_NAME, options);
    response.clearCookie(AUTH_REFRESH_COOKIE_NAME, options);
    response.clearCookie(AUTH_SESSION_COOKIE_NAME, options);
  }
}
