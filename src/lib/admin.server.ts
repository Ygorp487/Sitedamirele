export function assertAdmin(user: string, password: string) {
  const expectedUser = process.env["ADMIN_USER"]?.trim().toLowerCase();
  const expectedPassword = process.env["ADMIN_PASSWORD"];
  if (!expectedUser || !expectedPassword) {
    throw new Error("Painel administrativo ainda não foi configurado.");
  }
  if (user.trim().toLowerCase() !== expectedUser || password !== expectedPassword) {
    throw new Error("Usuário ou senha incorretos.");
  }
}
