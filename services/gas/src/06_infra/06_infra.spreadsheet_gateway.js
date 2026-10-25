// スプレッドシートの読み書きの土台。
// 中身：SpreadsheetGateway（シートを1行目の見出しで物の一覧として読む・足す・入れかえる。1回の呼び出しの中では覚えておく）。
// 呼ぶところ：06_infra.repositories.js と 09_setup.sheets.js。
var SpreadsheetGateway = (function () {
  // スプレッドシートを開く（SPREADSHEET_ID）
  function getSpreadsheet() {
    var cached = RequestContext.getCache("spreadsheet", "workbook");
    if (cached) {
      return cached;
    }
    return RequestContext.putCache("spreadsheet", "workbook", SpreadsheetApp.openById(ScriptConfig.getSpreadsheetId()));
  }

  // シートを名前で開く（なければ sheet_not_found）
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

  // シートの見出し（1行目）
  function getHeaders_(sheetName) {
    var cached = RequestContext.getCache("headers", sheetName);
    if (cached) {
      return cached;
    }

    var sheet = getSheet(sheetName);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    return RequestContext.putCache("headers", sheetName, headers);
  }

  // シートを、見出しを名前にした物の一覧として読む（空の行は飛ばす）
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

  // 1行足す
  function appendObject(sheetName, record) {
    appendObjects(sheetName, [record]);
  }

  // まとめて足す（外から来た文字は safeCell で式にならないように）
  function appendObjects(sheetName, records) {
    if (!records || records.length === 0) {
      return;
    }

    var sheet = getSheet(sheetName);
    var headers = getHeaders_(sheetName);
    var rows = toRows_(headers, records);

    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
    invalidateSheetCache_(sheetName);
  }

  // 見出しの下を全部消して、入れかえる（はじめの準備だけで使う）
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

    var rows = toRows_(headers, records);

    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    invalidateSheetCache_(sheetName);
  }

  // 物の一覧を、見出しの順の行にする
  function toRows_(headers, records) {
    return records.map(function (record) {
      return headers.map(function (header) {
        // 外から来た文字が = + - @ で始まっても、式として動かないようにする
        return record[header] !== undefined ? safeCell(record[header]) : "";
      });
    });
  }

  // 行に、空でないところがあるか
  function hasAnyValue_(row) {
    return row.some(function (value) {
      return value !== "";
    });
  }

  // 行を、見出しを名前にした物にする
  function toObject_(headers, row) {
    return headers.reduce(function (acc, header, index) {
      acc[header] = row[index];
      return acc;
    }, {});
  }

  // そのシートについて覚えたものを捨てる（書いたあと）
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
