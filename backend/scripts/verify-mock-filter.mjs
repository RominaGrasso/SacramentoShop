/**
 * Manual check: admin mock filter (default exclude, includeMock=true shows all).
 * Run: npm run check:mock-filter
 */
import { isMockPaymentRecord, listPayments } from "../store.js";

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exitCode = 1;
    throw new Error(message);
  }
  console.log("OK:", message);
}

const mockBySession = {
  sessionId: "mock_abc123",
  paymentUrl: "https://secure.plexo.com.uy/should-still-be-mock"
};
const mockByHandy = {
  sessionId: "real-looking-id",
  paymentUrl: "https://pago.handy.uy/details/?sessionId=mock_x"
};
const mockByNonPlexo = {
  sessionId: "sess_test_1",
  paymentUrl: "https://example.com/pay"
};
const realPlexo = {
  sessionId: "2ee5a42d02894179b639883630c1fa7f",
  paymentUrl: "https://secure.plexo.com.uy/2ee5a42d02894179b639883630c1fa7f"
};

assert(isMockPaymentRecord(mockBySession), "mock_ sessionId → mock");
assert(isMockPaymentRecord(mockByHandy), "pago.handy.uy → mock");
assert(isMockPaymentRecord(mockByNonPlexo), "non-Plexo paymentUrl → mock");
assert(!isMockPaymentRecord(realPlexo), "secure.plexo.com.uy → real");

const allInStore = listPayments({ includeMock: true, limit: 500 });
const realOnly = listPayments({ limit: 500 });
const mockCountInStore = allInStore.total - realOnly.total;

assert(realOnly.total <= allInStore.total, "real-only total <= full store total");
assert(
  allInStore.items.some((x) => isMockPaymentRecord(x)) || mockCountInStore === 0,
  "includeMock=true includes mock rows when store has mocks"
);
assert(
  !realOnly.items.some((x) => isMockPaymentRecord(x)),
  "default listPayments excludes every mock row"
);

console.log("");
console.log("Store snapshot (local PAYMENT_STORE_DIR or backend/data):");
console.log("  all (includeMock=true):", allInStore.total);
console.log("  real only (default):   ", realOnly.total);
console.log("  hidden mocks:          ", mockCountInStore);

if (process.exitCode) {
  process.exit(process.exitCode);
}
