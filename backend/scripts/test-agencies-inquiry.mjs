import assert from "node:assert/strict";
import { validateAgenciesInquiryBody } from "../agenciesInquiryRoute.js";

const valid = {
  name: "Jane Doe",
  company: "Example Travel",
  country: "Argentina",
  email: "jane@example.com",
  companyType: "travel_agency",
  privacyAccepted: true,
  interests: ["tours"],
  passengerTypes: ["groups"]
};

assert.equal(validateAgenciesInquiryBody(valid).ok, true);

const missingName = { ...valid, name: "" };
assert.equal(validateAgenciesInquiryBody(missingName).ok, false);

const badEmail = { ...valid, email: "not-an-email" };
assert.equal(validateAgenciesInquiryBody(badEmail).ok, false);

const noPrivacy = { ...valid, privacyAccepted: false };
assert.equal(validateAgenciesInquiryBody(noPrivacy).ok, false);

console.log("agencies inquiry validation tests: ok");
