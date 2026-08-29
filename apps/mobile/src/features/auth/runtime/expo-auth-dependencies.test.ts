import { createExpoAuthDependencies } from "./expo-auth-dependencies";

test("uses Expo native randomness when the Expo Go runtime has no global Web Crypto", () => {
  const randomBytes = jest.fn((length: number) => (
    Uint8Array.from({ length }, (_, index) => index)
  ));
  const previous = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: undefined });
  try {
    const dependencies = createExpoAuthDependencies({ randomBytes });

    expect(dependencies.createRequestId()).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
    expect(randomBytes).toHaveBeenCalledWith(16);
  } finally {
    if (previous === undefined) delete (globalThis as { crypto?: Crypto }).crypto;
    else Object.defineProperty(globalThis, "crypto", previous);
  }
});
