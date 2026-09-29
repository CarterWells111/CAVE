import { roomReturnPath } from "./room-return-path";

test("only supported room paths survive the login return", () => {
  const token = "opaque_token-1234567890";
  expect(roomReturnPath(`/join?invite=${token}`)).toBe(`/join?invite=${token}`);
  expect(roomReturnPath("/rooms/start?scenario=pause")).toBe("/rooms/start?scenario=pause");
  expect(roomReturnPath("/rooms/room_123")).toBe("/rooms/room_123");
  expect(roomReturnPath("/join?invite=%ZZ")).toBeNull();
  expect(roomReturnPath("/join?invite=short")).toBeNull();
  expect(roomReturnPath("https://example.com/join?invite=opaque_token-1234567890")).toBeNull();
});
