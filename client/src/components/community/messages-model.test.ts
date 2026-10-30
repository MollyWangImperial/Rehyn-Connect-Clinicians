import { describe, expect, it } from "vitest";
import { markMessagesNoticeRead, MESSAGES_NOTICE_KEY, messagesNotice, messagesNoticeDue } from "./messages-model";

// "Before you message": shown once on this device, the first time messages are opened.

/** A stand-in for the browser's storage. `broken` throws, as a browser does when storage is off. */
function storage(broken = false): Storage {
  const kept = new Map<string, string>();
  const fail = () => { throw new Error("storage is off"); };
  return {
    get length() { return kept.size; },
    key: index => [...kept.keys()][index] ?? null,
    getItem: key => (broken ? fail() : kept.get(key) ?? null),
    setItem: (key, value) => { if (broken) fail(); kept.set(key, value); },
    removeItem: key => { kept.delete(key); },
    clear: () => kept.clear(),
  };
}

describe("the first-open notice", () => {
  it("is due until it has been read, then never again on this device", () => {
    const device = storage();
    expect(messagesNoticeDue(device)).toBe(true);
    expect(markMessagesNoticeRead(device)).toBe(true);
    expect(messagesNoticeDue(device)).toBe(false);
    expect(device.getItem(MESSAGES_NOTICE_KEY)).toBe("1");
    // A fresh device (or a cleared browser) asks again.
    expect(messagesNoticeDue(storage())).toBe(true);
  });

  it("shows again where the device can't remember, and not at all where there is no device", () => {
    const off = storage(true);
    expect(messagesNoticeDue(off)).toBe(true);
    expect(markMessagesNoticeRead(off)).toBe(false);
    expect(messagesNoticeDue(off)).toBe(true);
    // A server, or a test: nothing to show.
    expect(messagesNoticeDue(null)).toBe(false);
    expect(messagesNoticeDue(undefined)).toBe(false);
    expect(markMessagesNoticeRead(null)).toBe(false);
  });

  it("says who can read messages, and asks for one tap", () => {
    expect(messagesNotice.title).toBe("Before you message");
    expect(messagesNotice.text).toBe("The Rehyn team can access messages sent here, to keep the network safe. Do not share patient-identifiable information in messages.");
    expect(messagesNotice.button).toBe("OK, I understand");
  });
});
