declare module "react" {
  export type ReactNode = unknown;
  export type ComponentType<P = Record<string, unknown>> = (props: P) => ReactNode;
  export class Component<P = Record<string, unknown>> {
    readonly props: P;
    componentDidCatch(error: unknown): void;
    render(): ReactNode;
  }
  export const StrictMode: ComponentType<{ readonly children?: ReactNode }>;
  export function createElement<P>(
    component: ComponentType<P> | typeof Component | string,
    props?: P | null,
    ...children: ReactNode[]
  ): ReactNode;
  export function useEffect(effect: () => void, dependencies: readonly unknown[]): void;
}

declare module "react-dom/client" {
  export function createRoot(container: unknown): { render(tree: unknown): void };
}
