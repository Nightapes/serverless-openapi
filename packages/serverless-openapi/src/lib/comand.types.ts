export type CommandsDefinition = Record<
  string,
  {
    lifecycleEvents?: string[];
    commands?: CommandsDefinition;
    usage?: string;
    options?: {
      [name: string]: {
        type: string;
        usage: string;
        required?: boolean;
        shortcut?: string;
      };
    };
  }
>;
