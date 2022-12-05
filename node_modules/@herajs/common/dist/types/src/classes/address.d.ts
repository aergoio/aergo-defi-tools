/// <reference types="node" />
export declare type AddressInput = Address | string | Buffer | Uint8Array;
/**
 * A wrapper around addresses. Internally addresses are stored and sent as raw bytes,
 * but client-side they are displayed as base58-check encoded strings.
 * The encoding requires some computation, so you should only convert address objects to strings when needed.
 */
export default class Address {
    value: Buffer;
    encoded?: string;
    isName: boolean;
    constructor(address: AddressInput);
    asBytes(): Uint8Array;
    readonly bytes: Uint8Array;
    toJSON(): string;
    toString(): string;
    /**
     * Decode bs58check string into bytes
     */
    static decode(bs58string: string): Buffer;
    /**
     * Encode bytes into bs58check string
     */
    static encode(byteArray: Buffer): string;
    equal(_otherAddress: AddressInput): boolean;
    /**
     * Returns true if the address is empty, i.e. '' or empty buffer
     */
    isEmpty(): boolean;
    readonly length: number;
    isSystemAddress(): boolean;
    static isSystemName(name: string): boolean;
    static setSystemAddresses(addresses: string[]): void;
    private static valueEqual;
}
