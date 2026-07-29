type Classe = string | false | null | undefined;

/** Concatène des classes conditionnelles. */
export function cn(...classes: Classe[]): string {
  return classes.filter(Boolean).join(" ");
}
