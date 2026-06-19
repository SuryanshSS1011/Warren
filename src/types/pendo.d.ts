interface PendoAgent {
  track(event: string, properties?: Record<string, string | number | boolean>): void;
}

declare var pendo: PendoAgent | undefined;
