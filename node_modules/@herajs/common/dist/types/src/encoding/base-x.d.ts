/**
 * This is a Typescript port of the base-x package
 */
/// <reference types="node" />
export interface BaseEncoder {
    encode(source: Buffer): string;
    decode(source: string): Buffer;
    decodeUnsafe(source: string): Buffer | undefined;
}
export default function base(ALPHABET: string): BaseEncoder;
