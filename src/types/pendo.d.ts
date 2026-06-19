interface PendoAgent {
  initialize(options?: { visitor?: { id?: string } & Record<string, unknown> }): void;
  track(event: string, properties?: Record<string, string | number | boolean>): void;
}

// eslint-disable-next-line no-var -- ambient global declaration requires `var`
declare var pendo: PendoAgent | undefined;
