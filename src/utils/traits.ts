type DeepReplaceArray<T, K extends string, R> = T extends (infer U)[] ? DeepReplace<U, K, R>[] : never;

type DeepReplaceObject<T, K extends string, R, Replaced = Replace<T, K, R>> = {
    [U in keyof Replaced]: DeepReplace<Replaced[U], K, R>;
};

export type Replace<T, K extends string, R> = T extends Record<K, unknown> ? Omit<T, K> & Record<K, R> : T;

export type DeepReplace<T, K extends string, R> = T extends Object ? DeepReplaceObject<T, K, R>
    : T extends unknown[] ? DeepReplaceArray<T, K, R>
    : T;
