/** Entidade Usuário — modelo canônico de domínio (sem senha em respostas). */
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

/** Criação de usuário (aquele que o sistema persiste). */
export interface NewUser {
  name: string;
  email: string;
  /** Hash da senha — nunca armazenar texto puro. */
  passwordHash: string;
}

export interface AuthTokens {
  accessToken: string;
}

/** Respostas da API de autenticação. */
export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

/** Credenciais recebidas no login. */
export interface LoginCredentials {
  email: string;
  password: string;
}
