var SpreadsheetGateway = (function () {
  function getSpreadsheet() {
    return SpreadsheetApp.openById(ScriptConfig.getSpreadsheetId());
  }

  function getSheet(sheetName) {
    var sheet = getSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      throw AppError.notFound("sheet_not_found", "sheet not found: " + sheetName);
    }
    return sheet;
  }

  function readObjects(sheetName) {
    var sheet = getSheet(sheetName);
    var values = sheet.getDataRange().getValues();
    if (!values || values.length === 0) {
      return [];
    }

    var headers = values[0];
    return values.slice(1).filter(hasAnyValue_).map(function (row) {
      return toObject_(headers, row);
    });
  }

  function appendObject(sheetName, record) {
    var sheet = getSheet(sheetName);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var row = headers.map(function (header) {
      return record[header] !== undefined ? record[header] : "";
    });
    sheet.appendRow(row);
  }

  function replaceAllObjects(sheetName, records) {
    var sheet = getSheet(sheetName);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
    }

    if (!records || records.length === 0) {
      return;
    }

    var rows = records.map(function (record) {
      return headers.map(function (header) {
        return record[header] !== undefined ? record[header] : "";
      });
    });

    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
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

  return {
    readObjects: readObjects,
    appendObject: appendObject,
    replaceAllObjects: replaceAllObjects
  };
})();
