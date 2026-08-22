import { readFile } from "node:fs/promises";

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { msToDate, nowMs } from "@soc/shared";
import jwt from "jsonwebtoken";

export interface GoogleCalendarEventResource {
  id?: string;
  etag?: string;
  summary?: string;
  description?: string;
  location?: string;
  start: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  end: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  extendedProperties?: {
    private?: Record<string, string>;
  };
}

interface GoogleServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
}

export class GoogleCalendarApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "GoogleCalendarApiError";
  }
}

export class GoogleCalendarConflictError extends GoogleCalendarApiError {
  constructor(message = "google_calendar_etag_conflict") {
    super(412, message);
    this.name = "GoogleCalendarConflictError";
  }
}

@Injectable()
export class GoogleCalendarClient {
  private readonly logger = new Logger(GoogleCalendarClient.name);
  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.configService.get<string>("GOOGLE_SERVICE_ACCOUNT_KEY_FILE")?.trim());
  }

  async upsertEvent(input: {
    calendarId: string;
    eventId?: string | null;
    etag?: string | null;
    resource: GoogleCalendarEventResource;
  }): Promise<{ eventId: string; etag: string | null }> {
    const resource = {
      ...input.resource,
      ...(input.eventId ? { id: input.eventId } : {}),
    };

    if (input.eventId) {
      try {
        const updated = await this.send<GoogleCalendarEventResource>(
          "PATCH",
          this.eventUrl(input.calendarId, input.eventId),
          resource,
          input.etag ? { "If-Match": input.etag } : undefined,
        );
        return this.readIdentity(updated, input.eventId);
      } catch (error) {
        if (error instanceof GoogleCalendarApiError && error.statusCode === 412) {
          throw new GoogleCalendarConflictError();
        }
        if (!(error instanceof GoogleCalendarApiError && error.statusCode === 404)) {
          throw error;
        }
      }
    }

    try {
      const created = await this.send<GoogleCalendarEventResource>(
        "POST",
        this.collectionUrl(input.calendarId),
        resource,
      );
      return this.readIdentity(created, input.eventId ?? undefined);
    } catch (error) {
      // A deterministic event id makes a retry safe. If another request won
      // the race, fetch the existing event and update it instead of creating a
      // duplicate.
      if (!(error instanceof GoogleCalendarApiError && error.statusCode === 409)) {
        throw error;
      }
      if (!input.eventId) throw error;

      const existing = await this.send<GoogleCalendarEventResource>(
        "GET",
        this.eventUrl(input.calendarId, input.eventId),
      );
      try {
        const updated = await this.send<GoogleCalendarEventResource>(
          "PATCH",
          this.eventUrl(input.calendarId, input.eventId),
          resource,
          existing.etag ? { "If-Match": existing.etag } : undefined,
        );
        return this.readIdentity(updated, input.eventId);
      } catch (patchError) {
        if (patchError instanceof GoogleCalendarApiError && patchError.statusCode === 412) {
          throw new GoogleCalendarConflictError();
        }
        throw patchError;
      }
    }
  }

  async deleteEvent(input: {
    calendarId: string;
    eventId: string;
    etag?: string | null;
  }): Promise<void> {
    try {
      await this.send<unknown>(
        "DELETE",
        this.eventUrl(input.calendarId, input.eventId),
        undefined,
        input.etag ? { "If-Match": input.etag } : undefined,
      );
    } catch (error) {
      if (error instanceof GoogleCalendarApiError && error.statusCode === 404) return;
      if (error instanceof GoogleCalendarApiError && error.statusCode === 412) {
        throw new GoogleCalendarConflictError();
      }
      throw error;
    }
  }

  private async send<T>(
    method: string,
    url: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    const token = await this.getAccessToken();
    const requestUrl = method === "GET" || method === "DELETE"
      ? url
      : `${url}${url.includes("?") ? "&" : "?"}sendUpdates=none`;
    const response = await fetch(requestUrl, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15_000),
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new GoogleCalendarApiError(
        response.status,
        `google_calendar_http_${response.status}${responseText ? `: ${safeErrorText(responseText)}` : ""}`,
      );
    }

    if (!responseText) return undefined as T;
    try {
      return JSON.parse(responseText) as T;
    } catch {
      throw new Error("google_calendar_invalid_response");
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > nowMs() + 60_000) {
      return this.cachedToken.value;
    }

    const keyFile = this.configService.get<string>("GOOGLE_SERVICE_ACCOUNT_KEY_FILE")?.trim();
    if (!keyFile) throw new Error("google_service_account_file_not_configured");

    let account: GoogleServiceAccount;
    try {
      account = JSON.parse(await readFile(keyFile, "utf8")) as GoogleServiceAccount;
    } catch (error) {
      throw new Error(
        `google_service_account_file_unreadable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (!account.client_email || !account.private_key) {
      throw new Error("google_service_account_file_invalid");
    }

    const now = Math.floor(nowMs() / 1000);
    const assertion = jwt.sign(
      {
        iss: account.client_email,
        scope: "https://www.googleapis.com/auth/calendar.events",
        aud: account.token_uri ?? "https://oauth2.googleapis.com/token",
        iat: now - 30,
        exp: now + 3_600,
      },
      account.private_key,
      { algorithm: "RS256" },
    );
    const tokenUri = account.token_uri ?? "https://oauth2.googleapis.com/token";
    const response = await fetch(tokenUri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = (await response.json()) as GoogleTokenResponse;
    if (!response.ok || !payload.access_token) {
      this.logger.warn(`Google service-account token request failed with HTTP ${response.status}`);
      throw new Error("google_service_account_token_failed");
    }

    this.cachedToken = {
      value: payload.access_token,
      expiresAt: nowMs() + Math.max((payload.expires_in ?? 3_600) - 60, 60) * 1_000,
    };
    return payload.access_token;
  }

  private collectionUrl(calendarId: string): string {
    return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  }

  private eventUrl(calendarId: string, eventId: string): string {
    return `${this.collectionUrl(calendarId)}/${encodeURIComponent(eventId)}`;
  }

  private readIdentity(
    resource: GoogleCalendarEventResource,
    fallbackId?: string,
  ): { eventId: string; etag: string | null } {
    const eventId = resource.id ?? fallbackId;
    if (!eventId) throw new Error("google_calendar_event_id_missing");
    return { eventId, etag: resource.etag ?? null };
  }
}

function safeErrorText(value: string): string {
  try {
    const parsed = JSON.parse(value) as { error?: { message?: string } };
    return (parsed.error?.message ?? "unknown_error").slice(0, 300);
  } catch {
    return value.replace(/\s+/g, " ").slice(0, 300);
  }
}
