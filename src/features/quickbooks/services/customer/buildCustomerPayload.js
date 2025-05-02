function buildCustomerPayload(firstName, lastName, email) {
  const fullName = `${firstName} ${lastName}`;
  return {
    fullName,
    payload: {
      GivenName: firstName,
      FamilyName: lastName,
      DisplayName: fullName,
      PrimaryEmailAddr: { Address: email }
    }
  };
}

module.exports = buildCustomerPayload;
