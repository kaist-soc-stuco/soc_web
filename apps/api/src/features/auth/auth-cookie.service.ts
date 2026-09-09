import { Injectable } from "@nestjs/common";
import type { Request, Response } from "express";

import {
  AUTH_ACCESS_COOKIE_NAME,
  AUTH_ACCESS_TOKEN_TTL_SECONDS,
  AUTH_LOGIN_TRANSACTION_COOKIE_NAME,
  AUTH_REFRESH_COOKIE_NAME,
  AUTH_REFRESH_TOKEN_TTL_SECONDS,
  AUTH_SESSION_COOKIE_NAME,
  AUTH_SSO_TRANSACTION_COOKIE_NAME,
} from "./auth.tokens";

@Injectable()
export class AuthCookieService {
  private getCookieOptions(maxAgeMs: number, request?: Request) {
    return {
      httpOnly: true,
      maxAge: maxAgeMs,
      path: "/",
      sameSite: "lax" as const,
      // Production can still be served over plain HTTP behind a local or
      // campus reverse proxy. Use the original request protocol so the
      // browser can actually store the session cookie in that deployment.
      secure: process.env.NODE_ENV === "production" || Boolean(request?.secure),
    };
  }

  private getSsoTransactionOptions(request?: Request) {
    const secure = process.env.NODE_ENV === "production" || Boolean(request?.secure);
    return {
      ...this.getCookieOptions(5 * 60 * 1000, request),
      sameSite: secure ? ("none" as const) : ("lax" as const),
      secure,
    };
  }

  setSsoTransactionCookie(
    response: Response,
    transaction: string,
    request?: Request,
  ): void {
    response.cookie(
      AUTH_SSO_TRANSACTION_COOKIE_NAME,
      transaction,
      this.getSsoTransactionOptions(request),
    );
  }

  clearSsoTransactionCookie(response: Response, request?: Request): void {
    response.clearCookie(
      AUTH_SSO_TRANSACTION_COOKIE_NAME,
      this.getSsoTransactionOptions(request),
    );
  }

  setLoginTransactionCookie(
    response: Response,
    transaction: string,
    request?: Request,
  ): void {
    response.cookie(
      AUTH_LOGIN_TRANSACTION_COOKIE_NAME,
      transaction,
      this.getCookieOptions(10 * 60 * 1000, request),
    );
  }

  clearLoginTransactionCookie(response: Response, request?: Request): void {
    response.clearCookie(
      AUTH_LOGIN_TRANSACTION_COOKIE_NAME,
      this.getCookieOptions(0, request),
    );
  }

  setAuthCookies(
    response: Response,
    payload: {
      accessToken?: string;
      refreshToken?: string;
      sessionId?: string;
    },
    request?: Request,
  ): void {
    if (payload.accessToken) {
      response.cookie(
        AUTH_ACCESS_COOKIE_NAME,
        payload.accessToken,
        this.getCookieOptions(AUTH_ACCESS_TOKEN_TTL_SECONDS * 1000, request),
      );
    }

    if (payload.refreshToken) {
      response.cookie(
        AUTH_REFRESH_COOKIE_NAME,
        payload.refreshToken,
        this.getCookieOptions(AUTH_REFRESH_TOKEN_TTL_SECONDS * 1000, request),
      );
    }

    if (payload.sessionId) {
      response.cookie(
        AUTH_SESSION_COOKIE_NAME,
        payload.sessionId,
        this.getCookieOptions(AUTH_REFRESH_TOKEN_TTL_SECONDS * 1000, request),
      );
    }
  }

  clearAuthCookies(response: Response, request?: Request): void {
    const options = this.getCookieOptions(0, request);
    response.clearCookie(AUTH_ACCESS_COOKIE_NAME, options);
    response.clearCookie(AUTH_REFRESH_COOKIE_NAME, options);
    response.clearCookie(AUTH_SESSION_COOKIE_NAME, options);
  }
}
