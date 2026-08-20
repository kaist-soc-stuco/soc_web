import * as ChannelService from "@channel.io/channel-web-sdk-loader";

export interface ChannelTalkBootOptions {
  pluginKey: string;
  memberId?: string;
  memberHash?: string;
  language?: "ko" | "en";
  profile?: {
    name: string;
    email: string;
  };
}

let scriptPromise: Promise<void> | null = null;

export function loadChannelTalkScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (!scriptPromise) {
    ChannelService.loadScript();
    scriptPromise = Promise.resolve();
  }

  return scriptPromise;
}

export function bootChannelTalk(options: ChannelTalkBootOptions): void {
  ChannelService.boot(options);
}

export function shutdownChannelTalk(): void {
  ChannelService.shutdown();
}

export function showChannelTalk(): void {
  ChannelService.showMessenger();
}
