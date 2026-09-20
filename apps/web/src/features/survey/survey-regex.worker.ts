self.onmessage = (event: MessageEvent<{ pattern: string; text: string }>) => {
  try { self.postMessage(new RegExp(event.data.pattern).test(event.data.text)); }
  catch { self.postMessage(false); }
};
export {};
