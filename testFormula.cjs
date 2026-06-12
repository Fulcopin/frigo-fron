const fs = require('fs');

// Simple mock of formulaEngine behavior
function normalizeKey(k) {
  if (!k) return '';
  return k.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s\[\]*:\-.]/gi, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

const formula = "( (([BOLSA 1[*]] - ([FUNDA VP: PESO UND. (ONZ)] * [BOLSA 1[count]])) + ([BOLSA 2[*]] - ([FUNDA VP: PESO UND. (ONZ)] * [BOLSA 2[count]])) + ([BOLSA 3[*]] - ([FUNDA VP: PESO UND. (ONZ)] * [BOLSA 3[count]])) + ([BOLSA 4[*]] - ([FUNDA VP: PESO UND. (ONZ)] * [BOLSA 4[count]])) + ([BOLSA 5[*]] - ([FUNDA VP: PESO UND. (ONZ)] * [BOLSA 5[count]])) + ([BOLSA 6[*]] - ([FUNDA VP: PESO UND. (ONZ)] * [BOLSA 6[count]])) + ([BOLSA 7[*]] - ([FUNDA VP: PESO UND. (ONZ)] * [BOLSA 7[count]])) + ([BOLSA 8[*]] - ([FUNDA VP: PESO UND. (ONZ)] * [BOLSA 8[count]])) + ([BOLSA 9[*]] - ([FUNDA VP: PESO UND. (ONZ)] * [BOLSA 9[count]])) + ([BOLSA 10[*]] - ([FUNDA VP: PESO UND. (ONZ)] * [BOLSA 10[count]]))) / (([GLASEO: PORCENTAJE] / 100) + 1) ) / 16";

const rowData = {
  "FUNDA VP: PESO UND. (ONZ)": 1.5,
  "GLASEO: PORCENTAJE": 8.8,
  "__crossTableSums__": {
    "BOLSA 1": 10.5,
    "BOLSA 2": 0
  },
  "__crossTableCounts__": {
    "BOLSA 1": 1,
    "BOLSA 2": 0
  }
};

const rowKeys = Object.keys(rowData).filter(k => k !== 'id' && !k.startsWith('__'));
const normalizedKeyMap = {};
rowKeys.forEach(k => {
  normalizedKeyMap[normalizeKey(k)] = k;
});

// Mock ALL bolsa columns
for(let i=1; i<=10; i++) {
  const k = `BOLSA ${i}`;
  normalizedKeyMap[normalizeKey(k)] = k;
}

let expression2 = normalizeKey(formula);

Object.keys(normalizedKeyMap).sort((a,b) => b.length - a.length).forEach(normKey => {
  const origKey = normalizedKeyMap[normKey];
  const escaped = normKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // [*]
  const rx = new RegExp(escaped + '\\s*\\[\\*?\\]', 'gi');
  expression2 = expression2.replace(rx, () => {
    return String(rowData.__crossTableSums__[origKey] || 0);
  });
  
  // [count]
  const rxCount = new RegExp(escaped + '\\s*\\[count\\]', 'gi');
  expression2 = expression2.replace(rxCount, () => {
    return String(rowData.__crossTableCounts__[origKey] || 0);
  });
});

Object.keys(normalizedKeyMap).sort((a,b) => b.length - a.length).forEach(normKey => {
  const origKey = normalizedKeyMap[normKey];
  const escaped = normKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(escaped, 'gi');
  expression2 = expression2.replace(rx, () => {
    return String(rowData[origKey] || 0);
  });
});

console.log("Replaced:", expression2);

const sanitize = (expr) => expr.replace(/\s/g, '').replace(/\[/g, '(').replace(/\]/g, ')');
const sanitized = sanitize(expression2);

console.log("Sanitized:", sanitized);

try {
  console.log("Eval:", new Function('return (' + sanitized + ')')());
} catch(e) {
  console.error(e);
}
