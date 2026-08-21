export function transformarSnakeToCamel<T>(obj: T): T {
  if (Array.isArray(obj)) return obj.map(transformarSnakeToCamel) as T;
  if (obj !== null && typeof obj === "object" && obj.constructor === Object) {
    const transformed = Object.keys(obj).reduce<Record<string, unknown>>((acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, character: string) => character.toUpperCase());
      acc[camelKey] = transformarSnakeToCamel((obj as Record<string, unknown>)[key]);
      return acc;
    }, {});
    return transformed as T;
  }
  return obj;
}
