var SpreadsheetGateway = (function () {
  function getSpreadsheet() {
    var cached = RequestContext.getCache("spreadsheet", "workbook");
    if (cached) {
      return cached;
    }
    return RequestContext.putCache("spreadsheet", "workbook", SpreadsheetApp.openById(ScriptConfig.getSpreadsheetId()));
  }

  function getSheet(sheetName) {
    var cached = RequestContext.getCache("sheet", sheetName);
    if (cached) {
      return cached;
    }

    var sheet = getSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      throw AppError.notFound("sheet_not_found", "sheet not found: " + sheetName);
    }
    return RequestContext.putCache("sheet", sheetName, sheet);
  }

  function getHeaders_(sheetName) {
    var cached = RequestContext.getCache("headers", sheetName);
    if (cached) {
      return cached;
    }

    var sheet = getSheet(sheetName);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    return RequestContext.putCache("headers", sheetName, headers);
  }

  function readObjects(sheetName) {
    var cached = RequestContext.getCache("rows", sheetName);
    if (cached) {
      return cached;
    }

    var sheet = getSheet(sheetName);
    var values = sheet.getDataRange().getValues();
    if (!values || values.length === 0) {
      return [];
    }

    var headers = values[0];
    var rows = values.slice(1).filter(hasAnyValue_).map(function (row) {
      return toObject_(headers, row);
    });
    return RequestContext.putCache("rows", sheetName, rows);
  }

  function appendObject(sheetName, record) {
    appendObjects(sheetName, [record]);
  }

  function appendObjects(sheetName, records) {
    if (!records || records.length === 0) {
      return;
    }

    var sheet = getSheet(sheetName);
    var headers = getHeaders_(sheetName);
    var rows = records.map(function (record) {
      return headers.map(function (header) {
        return record[header] !== undefined ? record[header] : "";
      });
    });

    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
    invalidateSheetCache_(sheetName);
  }

  function replaceAllObjects(sheetName, records) {
    var sheet = getSheet(sheetName);
    var headers = getHeaders_(sheetName);

    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
    }

    if (!records || records.length === 0) {
      invalidateSheetCache_(sheetName);
      return;
    }

    var rows = records.map(function (record) {
      return headers.map(function (header) {
        return record[header] !== undefined ? record[header] : "";
      });
    });

    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    invalidateSheetCache_(sheetName);
  }

  function hasAnyValue_(row) {
    return row.some(function (value) {
      return value !== "";
    });
  }

  function toObject_(headers, row) {
    return headers.reduce(function (acc, header, index) {
      acc[header] = row[index];
      return acc;
    }, {});
  }

  function invalidateSheetCache_(sheetName) {
    RequestContext.clearCache("rows", sheetName);
    RequestContext.clearCache("headers", sheetName);
    RequestContext.clearCache("sheet", sheetName);
  }

  return {
    readObjects: readObjects,
    appendObject: appendObject,
    appendObjects: appendObjects,
    replaceAllObjects: replaceAllObjects
  };
})();
