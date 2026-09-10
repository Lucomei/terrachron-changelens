export function chooseModelClient({ localBaseUrl = '', createLocal, createAgnes }) {
  return localBaseUrl.trim() ? createLocal(localBaseUrl) : createAgnes();
}
