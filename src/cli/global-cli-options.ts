/** Root program options inherited by every command and subcommand (RFC-010). */
export interface GlobalCliOptions {
  readonly config?: string;
  readonly debug?: boolean;
}
