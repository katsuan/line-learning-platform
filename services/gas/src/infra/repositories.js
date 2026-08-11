var TenantSheetRepository = (function () {
  function findByTenantId(tenantId) {
    return SpreadsheetGateway.readObjects(DomainConstants.SHEETS.TENANTS).find(function (row) {
      return row.tenant_id === tenantId;
    }) || null;
  }

  return {
    findByTenantId: findByTenantId
  };
})();

var UserSheetRepository = (function () {
  function findByUserId(userId) {
    return SpreadsheetGateway.readObjects(DomainConstants.SHEETS.USERS).find(function (row) {
      return row.user_id === userId;
    }) || null;
  }

  return {
    findByUserId: findByUserId
  };
})();

var MembershipSheetRepository = (function () {
  function findFirstActiveByTenantId(tenantId) {
    return SpreadsheetGateway.readObjects(DomainConstants.SHEETS.MEMBERSHIPS).find(function (row) {
      return row.tenant_id === tenantId && row.status === DomainConstants.MEMBERSHIP_STATUS.ACTIVE;
    }) || null;
  }

  return {
    findFirstActiveByTenantId: findFirstActiveByTenantId
  };
})();

var FeatureEntitlementSheetRepository = (function () {
  function listByTenantId(tenantId) {
    return SpreadsheetGateway.readObjects(DomainConstants.SHEETS.FEATURE_ENTITLEMENTS).filter(function (row) {
      return row.tenant_id === tenantId;
    });
  }

  return {
    listByTenantId: listByTenantId
  };
})();
