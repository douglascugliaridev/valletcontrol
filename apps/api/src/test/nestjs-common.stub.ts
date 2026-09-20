/**
 * Stub minimalista para isolar os testes unitários do framework NestJS.
 * Os use cases e hasher usam apenas o decorator `@Injectable()`, que nesta
 * implementação é um pass-through — os testes instanciam as classes direto.
 */
const noopDecorator = (target: unknown) => target;

export const Injectable = () => noopDecorator;
export const InjectableOf = noopDecorator;
export const Module = () => noopDecorator;
export const Global = () => noopDecorator;
export const Controller = () => noopDecorator;
export const ControllerOf = noopDecorator;
export const Get = () => noopDecorator;
export const Post = () => noopDecorator;
export const Put = () => noopDecorator;
export const Patch = () => noopDecorator;
export const Delete = () => noopDecorator;
export const Body = () => noopDecorator;
export const Param = () => noopDecorator;
export const Query = () => noopDecorator;
export const Headers = () => noopDecorator;
export const HttpCode = () => noopDecorator;
